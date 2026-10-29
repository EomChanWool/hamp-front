import { QrCodeIcon } from '@heroicons/react/24/outline';
import './NativeScanButton.css';

interface NativeScanButtonProps {
  /** 앱(WebView) 안에서 열렸는지. false 면 아무것도 렌더링하지 않음 */
  isNative: boolean;
  onClick: () => void;
  disabled?: boolean;
}

/** 앱 안에서만 보이는 "카메라 스캔" 버튼 */
export function NativeScanButton({ isNative, onClick, disabled }: NativeScanButtonProps) {
  if (!isNative) return null;

  return (
    <button type="button" className="nativeScanBtn" onClick={onClick} disabled={disabled}>
      <QrCodeIcon className="nativeScanBtnIcon" aria-hidden="true" />
      카메라 스캔
    </button>
  );
}
