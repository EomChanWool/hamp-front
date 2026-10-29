import { useEffect, useRef } from 'react';
import {
  NATIVE_QR_EVENT,
  isNativeApp,
  requestNativeScan,
  type NativeQrDetail,
} from '@/utils/nativeBridge';

/**
 * 앱 카메라로 스캔된 값을 받는 훅 (Flutter -> React).
 *
 * - onScan 은 매 렌더마다 바뀌어도 되도록 ref 에 보관 (이벤트 리스너를 다시 등록하지 않음)
 * - 화면을 벗어나면 리스너가 자동 해제되므로, 해당 화면에서만 스캔 값을 받는다
 *
 * 사용:
 *   const { isNative, startScan } = useNativeQrScan(async (barcode) => { ... });
 */
export function useNativeQrScan(onScan: (value: string) => void) {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const handler = (event: Event) => {
      const value = (event as CustomEvent<NativeQrDetail>).detail?.value;
      if (typeof value === 'string' && value.trim() !== '') {
        onScanRef.current(value.trim());
      }
    };

    window.addEventListener(NATIVE_QR_EVENT, handler);
    return () => window.removeEventListener(NATIVE_QR_EVENT, handler);
  }, []);

  return { isNative: isNativeApp(), startScan: requestNativeScan };
}
