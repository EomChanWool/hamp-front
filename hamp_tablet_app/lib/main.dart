// ============================================================================
// Flutter 태블릿 앱: 사내 React 웹(WebView) + 네이티브 카메라 QR/바코드 스캔 브리지
//
// [연결 구조]
//   1) React 화면의 "카메라 스캔" 버튼 클릭
//        -> window.NativeBridge.postMessage('scan')      (JavaScriptChannel)
//   2) Flutter가 메시지를 받아 카메라 스캔 화면(QrScanScreen)을 띄움
//   3) 스캔 화면에서 코드를 "여러 개" 모은 뒤 [완료]를 누르면
//        -> Flutter가 웹에 CustomEvent('native-qr') 를 "값마다 한 번씩" 순차 dispatch
//        -> React 훅(useNativeQrScan)이 값을 받아 서버로 전송 (기존 로직 그대로)
//   4) 서버가 기존 하드웨어 스캐너 때와 똑같이 SSE 'scan' 이벤트를 흘려줌
//        -> 기존 화면 로직이 그대로 동작 (React 화면 수정 없음)
// [필요 설정]
//   - Android: INTERNET/CAMERA 권한 + usesCleartextTraffic="true" (http 주소 사용 시)
//   - iOS: NSCameraUsageDescription + NSAppTransportSecurity 예외 (http 주소 사용 시)
// ============================================================================

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// 웹 주소. 빌드 시 `--dart-define=WEB_URL=http://...` 로 덮어쓸 수 있음
const String kWebUrl = String.fromEnvironment(
  'WEB_URL',
  defaultValue: 'http://192.168.0.102:5173/work',
);

/// 인식할 코드 종류. 라벨이 QR뿐이면 qrCode 만 남기면 인식이 더 빠르고 정확함
const List<BarcodeFormat> kScanFormats = [
  BarcodeFormat.qrCode,
  BarcodeFormat.code128,
  BarcodeFormat.code39,
  BarcodeFormat.ean13,
];

/// React 와 약속한 이름 (React 쪽 nativeBridge.ts 의 값과 반드시 같아야 함)
const String kChannelName = 'NativeBridge'; // window.NativeBridge
const String kScanRequestMessage = 'scan'; // postMessage('scan')
const String kScanEventName = 'native-qr'; // window 'native-qr' 이벤트

/// 여러 값을 웹으로 순차 전송할 때 값 사이의 간격(ms).
/// 웹/서버에서 연속 입력 시 유실·덮어쓰기가 생기면 이 값을 늘려 보세요.
const int kSendIntervalMs = 150;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TabletApp());
}

class TabletApp extends StatelessWidget {
  const TabletApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: WebPageScreen(),
    );
  }
}

class WebPageScreen extends StatefulWidget {
  const WebPageScreen({super.key});

  @override
  State<WebPageScreen> createState() => _WebPageScreenState();
}

class _WebPageScreenState extends State<WebPageScreen> {
  late final WebViewController _web;

  bool _pageLoaded = false;
  String? _pageError;

  /// 스캔 화면이 이미 열려 있을 때(또는 전송 중일 때) 중복으로 열리는 것을 막음
  bool _scanning = false;

  /// [변경] 종료 확인 다이얼로그가 이미 떠 있을 때 중복으로 열리는 것을 막음
  bool _exitDialogOpen = false;

  @override
  void initState() {
    super.initState();

    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
    // ── [연결 1] React -> Flutter : window.NativeBridge.postMessage('scan') ──
      ..addJavaScriptChannel(
        kChannelName,
        onMessageReceived: (JavaScriptMessage msg) {
          if (msg.message == kScanRequestMessage) {
            _openScanner();
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() {
              _pageLoaded = false;
              _pageError = null;
            });
          },
          onPageFinished: (_) {
            if (!mounted) return;
            setState(() => _pageLoaded = true);
          },
          onWebResourceError: (error) {
            // favicon, 이미지 등 "부가 리소스" 오류에는 에러 화면을 띄우지 않음
            if (!mounted || error.isForMainFrame != true) return;
            setState(() => _pageError = error.description);
          },
        ),
      )
      ..loadRequest(Uri.parse(kWebUrl));
  }

  /// 카메라 스캔 화면을 열고, 결과(여러 개)를 웹으로 전달
  Future<void> _openScanner() async {
    if (_scanning || !mounted) return;
    _scanning = true;

    try {
      // 스캔 화면이 String 하나가 아니라 List<String> 을 돌려줌
      final List<String>? values = await Navigator.of(context).push<List<String>>(
        MaterialPageRoute(builder: (_) => const QrScanScreen()),
      );

      // 사용자가 뒤로가기로 취소했거나, 아무것도 인식하지 않은 경우
      if (!mounted || values == null || values.isEmpty) return;

      // 값마다 native-qr 이벤트를 한 번씩 순차 발생.
      // React 훅은 기존처럼 "값 하나씩" 받아 서버로 보내므로 수정할 필요 없음.
      for (final String v in values) {
        if (!mounted) return;
        await _sendToWeb(v);
        // 연속 처리 시 웹 상태 덮어쓰기/서버 요청 유실 방지용 간격
        await Future.delayed(const Duration(milliseconds: kSendIntervalMs));
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('스캔 처리 중 오류가 발생했습니다: $e')),
      );
    } finally {
      _scanning = false;
    }
  }

  /// ── [연결 2] Flutter -> React : window 에 'native-qr' CustomEvent 발생 ──
  /// jsonEncode 로 감싸서 따옴표/줄바꿈/특수문자가 있어도 JS 문법이 깨지지 않게 함
  Future<void> _sendToWeb(String value) async {
    final String detail = jsonEncode({'value': value});

    await _web.runJavaScript('''
      window.dispatchEvent(
        new CustomEvent('$kScanEventName', { detail: $detail })
      );
    ''');
  }

  // ── [변경] 뒤로가기 / 종료 처리 ─────────────────────────────────────────

  /// 하드웨어 뒤로가기와 화면 버튼이 함께 쓰는 공통 로직:
  /// 웹 히스토리가 있으면 한 단계 뒤로, 없으면 종료 확인 다이얼로그
  Future<void> _handleBack() async {
    if (await _web.canGoBack()) {
      await _web.goBack();
      return;
    }
    await _confirmExit();
  }

  /// 앱 종료 확인 다이얼로그
  Future<void> _confirmExit() async {
    if (_exitDialogOpen || !mounted) return;
    _exitDialogOpen = true;

    try {
      final bool? exit = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('앱 종료'),
          content: const Text('앱을 종료하시겠습니까?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('취소'),
            ),
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('종료'),
            ),
          ],
        ),
      );

      if (exit == true) {
        await SystemNavigator.pop(); // Android 에서 앱 종료
      }
    } finally {
      _exitDialogOpen = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    // 웹 안에서 페이지 이동 후 Android 뒤로가기를 누르면
    // 앱이 바로 종료되지 않고 웹 히스토리를 먼저 되돌림.
    // 더 돌아갈 곳이 없으면 종료 확인 다이얼로그를 띄움.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _handleBack();
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _web),
              if (!_pageLoaded && _pageError == null)
                const Align(
                  alignment: Alignment.topCenter,
                  child: LinearProgressIndicator(),
                ),
              if (_pageError != null) _buildErrorView(),
              // [변경] 화면 내 뒤로가기/종료 버튼 (반투명, 웹 UI를 최소한만 가림)
              // 위치를 바꾸려면 left/bottom 값을 조정하세요.
              Positioned(
                left: 8,
                bottom: 8,
                child: Opacity(
                  opacity: 0.6,
                  child: FloatingActionButton.small(
                    heroTag: 'back_or_exit',
                    tooltip: '뒤로가기 / 종료',
                    onPressed: _handleBack,
                    child: const Icon(Icons.arrow_back),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off, size: 48),
            const SizedBox(height: 12),
            const Text('웹 페이지를 열 수 없습니다.'),
            const SizedBox(height: 8),
            Text(_pageError!),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _pageError = null;
                  _pageLoaded = false;
                });
                _web.loadRequest(Uri.parse(kWebUrl));
              },
              child: const Text('다시 시도'),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// 카메라 스캔 화면
// ============================================================================
class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    formats: kScanFormats,
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back, // 태블릿 후면 카메라. 전면이면 front 로 변경
  );

  final Set<String> _values = <String>{};

  /// [완료]를 여러 번 눌러 pop 이 두 번 호출되지 않도록 막음
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose(); // 카메라 자원 반드시 해제
    super.dispose();
  }

  /// 한 프레임에 여러 코드가 보이면 capture.barcodes 에 전부 들어옴.
  void _onDetect(BarcodeCapture capture) {
    if (_done) return;

    bool changed = false;
    for (final barcode in capture.barcodes) {
      final String? value = barcode.rawValue;
      if (value == null || value.isEmpty) continue;

      if (_values.add(value)) changed = true; // 새 값일 때만 true
    }

    if (changed) {
      HapticFeedback.lightImpact();
      setState(() {}); // 개수/목록 갱신
    }
  }

  /// 완료: 모은 값을 List 로 돌려주고 화면 닫기
  void _finish() {
    if (_done || _values.isEmpty) return;
    _done = true;
    Navigator.of(context).pop(_values.toList());
  }

  /// 목록에서 개별 삭제 (잘못 인식된 값 제거용)
  void _remove(String value) {
    setState(() => _values.remove(value));
  }

  /// 전체 초기화
  void _clear() {
    setState(() => _values.clear());
  }

  @override
  Widget build(BuildContext context) {
    // 목록 표시용 복사본 (순서 유지)
    final List<String> items = _values.toList();

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text('QR 코드 스캔 (${_values.length}개)'),
        actions: [
          // 어두운 현장용 손전등
          IconButton(
            icon: const Icon(Icons.flashlight_on),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            // 카메라 권한 거부 등의 오류 안내 (mobile_scanner 6.x 시그니처)
            errorBuilder: (context, error) {
              final denied =
                  error.errorCode == MobileScannerErrorCode.permissionDenied;
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    denied
                        ? '카메라 권한이 거부되었습니다.\n설정에서 카메라 권한을 허용해 주세요.'
                        : '카메라를 사용할 수 없습니다. (${error.errorCode.name})',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
              );
            },
          ),
          // 조준 가이드 (터치를 막지 않도록 IgnorePointer)
          IgnorePointer(
            child: Center(
              child: Container(
                width: 320,
                height: 320,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white, width: 3),
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
          // 하단 패널: 인식 개수 / 목록 / 모두 지우기 / 완료 버튼
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _buildBottomPanel(items),
          ),
        ],
      ),
    );
  }

  /// 인식 결과 요약 + 완료 버튼 패널
  Widget _buildBottomPanel(List<String> items) {
    return Container(
      color: Colors.black87,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Text(
                  '${items.length}개 인식됨',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: items.isEmpty ? null : _clear,
                  child: const Text('모두 지우기'),
                ),
              ],
            ),
            if (items.isNotEmpty)
              ConstrainedBox(
                // 목록이 길어져도 카메라 화면을 과하게 가리지 않도록 높이 제한
                constraints: const BoxConstraints(maxHeight: 140),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: items.length,
                  itemBuilder: (context, index) {
                    final String v = items[index];
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Text(
                        '${index + 1}',
                        style: const TextStyle(color: Colors.white70),
                      ),
                      title: Text(
                        v,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.close, color: Colors.white70),
                        onPressed: () => _remove(v),
                      ),
                    );
                  },
                ),
              ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: items.isEmpty ? null : _finish,
                child: Text(
                  items.isEmpty ? '코드를 비춰 주세요' : '완료 (${items.length}개 전송)',
                  style: const TextStyle(fontSize: 18),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
