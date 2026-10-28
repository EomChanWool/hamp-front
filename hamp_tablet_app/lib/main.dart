import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:webview_flutter/webview_flutter.dart';

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
  late final WebViewController webController;

  // 실제 사내 React 페이지 주소로 변경하세요.
  static const String webUrl = 'http://192.168.0.102:5173';

  bool pageLoaded = false;
  bool scanning = false;
  String? pageError;

  @override
  void initState() {
    super.initState();

    webController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() {
              pageLoaded = false;
              pageError = null;
            });
          },
          onPageFinished: (_) {
            if (!mounted) return;
            setState(() {
              pageLoaded = true;
            });
          },
          onWebResourceError: (error) {
            if (!mounted) return;

            setState(() {
              pageError = error.description;
            });
          },
        ),
      )
      ..loadRequest(Uri.parse(webUrl));
  }

  Future<void> scanQr() async {
    if (scanning) return;

    setState(() {
      scanning = true;
    });

    try {
      final result = await Navigator.of(context)
          .push<String>(MaterialPageRoute(builder: (_) => const QrScreen()));

      if (!mounted || result == null) return;

      // QR 문자열을 JSON으로 인코딩하여 JavaScript에 안전하게 전달합니다.
      final qrJson = jsonEncode(result);

      // React가 아직 수신 함수를 등록하지 않았어도 값을 보관합니다.
      await webController.runJavaScript('''
        (function() {
          const qrValue = $qrJson;

          if (typeof window.onNativeQrScanned === 'function') {
            window.onNativeQrScanned(qrValue);
          } else {
            window.__pendingNativeQrValue = qrValue;
            console.log('React QR 수신 함수 등록 대기 중');
          }
        })();
      ''');

      if (!mounted) return;

      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('QR 코드를 전달했습니다.')));
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('QR 전달 실패: $e')));
    } finally {
      if (mounted) {
        setState(() {
          scanning = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: webController),
            if (!pageLoaded && pageError == null)
              const Align(
                alignment: Alignment.topCenter,
                child: LinearProgressIndicator(),
              ),
            if (pageError != null)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.wifi_off, size: 48),
                      const SizedBox(height: 12),
                      const Text('웹 페이지를 열 수 없습니다.'),
                      const SizedBox(height: 8),
                      Text(pageError!),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () {
                          setState(() {
                            pageError = null;
                            pageLoaded = false;
                          });
                          webController.reload();
                        },
                        child: const Text('다시 시도'),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: scanning ? null : scanQr,
        icon: const Icon(Icons.qr_code_scanner),
        label: Text(scanning ? '스캔 중...' : 'QR 스캔'),
      ),
    );
  }
}

class QrScreen extends StatefulWidget {
  const QrScreen({super.key});

  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  bool scanned = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('QR 코드 스캔')),
      body: MobileScanner(
        onDetect: (capture) {
          if (scanned || capture.barcodes.isEmpty) return;

          final value = capture.barcodes.first.rawValue;

          if (value == null || value.isEmpty) return;

          scanned = true;
          Navigator.of(context).pop(value);
        },
      ),
    );
  }
}
