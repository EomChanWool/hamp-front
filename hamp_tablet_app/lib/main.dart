// ============================================================================
// Flutter 태블릿 앱: 사내 React 웹(WebView) + 네이티브 카메라 QR/바코드 스캔 브리지
//
// [연결 구조]
//   1) React 화면의 "카메라 스캔" 버튼 클릭
//        -> window.NativeBridge.postMessage('scan')      (JavaScriptChannel)
//   2) Flutter가 메시지를 받아 카메라 스캔 화면(QrScanScreen)을 띄움
//   3) 스캔 성공 -> Flutter가 웹에 CustomEvent('native-qr') 를 dispatch
//        -> React 훅(useNativeQrScan)이 값을 받아 서버로 전송
//   4) 서버가 기존 하드웨어 스캐너 때와 똑같이 SSE 'scan' 이벤트를 흘려줌
//        -> 기존 화면 로직이 그대로 동작 (React 화면 수정 최소화)
//
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

  /// 스캔 화면이 이미 열려 있을 때 중복으로 열리는 것을 막음
  bool _scanning = false;

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

  /// 카메라 스캔 화면을 열고, 결과를 웹으로 전달
  Future<void> _openScanner() async {
    if (_scanning || !mounted) return;
    _scanning = true;

    try {
      final String? value = await Navigator.of(context).push<String>(
        MaterialPageRoute(builder: (_) => const QrScanScreen()),
      );

      // 사용자가 뒤로가기로 취소한 경우
      if (!mounted || value == null) return;

      await _sendToWeb(value);
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

  @override
  Widget build(BuildContext context) {
    // 웹 안에서 페이지 이동 후 Android 뒤로가기를 누르면
    // 앱이 바로 종료되지 않고 웹 히스토리를 먼저 되돌림
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _web.canGoBack()) {
          await _web.goBack();
        }
        // 더 돌아갈 곳이 없을 때 앱을 종료하려면 아래 주석 해제
        // else { SystemNavigator.pop(); }
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
            ],
          ),
        ),
        // 스캔 버튼은 React 화면 안에 있으므로 Flutter 쪽 FAB는 두지 않음
        // (웹 UI를 가리지 않음). 테스트용으로 필요하면 아래 주석 해제
        // floatingActionButton: FloatingActionButton(
        //   onPressed: _openScanner,
        //   child: const Icon(Icons.qr_code_scanner),
        // ),
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
// 카메라 스캔 화면: 한 번 인식하면 값을 들고 pop
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

  /// 같은 프레임에서 여러 번 감지돼도 pop 이 두 번 호출되지 않도록 막음
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose(); // 카메라 자원 반드시 해제
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_done) return;

    for (final barcode in capture.barcodes) {
      final String? value = barcode.rawValue;
      if (value == null || value.isEmpty) continue;

      _done = true;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(value);
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('QR 코드 스캔'),
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
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white, width: 3),
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
