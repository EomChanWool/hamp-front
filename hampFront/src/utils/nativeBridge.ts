/**
 * Flutter 앱(WebView)과 통신하기 위한 브리지.
 *
 * Flutter 쪽 main.dart 의 아래 상수와 이름이 반드시 같아야 한다.
 *   kChannelName        = 'NativeBridge'  -> window.NativeBridge
 *   kScanRequestMessage = 'scan'
 *   kScanEventName      = 'native-qr'
 *
 * 일반 브라우저에서는 window.NativeBridge 가 없으므로
 * isNativeApp() 가 false 가 되어 "카메라 스캔" 버튼이 자동으로 숨겨진다.
 */

declare global {
  interface Window {
    NativeBridge?: { postMessage: (message: string) => void };
  }
}

export const NATIVE_QR_EVENT = 'native-qr';

/** 앱(WebView) 안에서 실행 중인지 */
export const isNativeApp = (): boolean =>
  typeof window !== 'undefined' && !!window.NativeBridge;

/** 앱에 카메라 스캔 화면을 열어 달라고 요청 (React -> Flutter) */
export const requestNativeScan = (): void => {
  window.NativeBridge?.postMessage('scan');
};

export interface NativeQrDetail {
  value: string;
}
