import QRCode from "react-qr-code";
import { createPortal } from "react-dom";
import "@/components/modal/QrLabelPrintModal.css";

/**
 * QR 전용 라벨 인쇄 모달 (지브라 100mm x 100mm)
 *
 * - QR 만 쓰는 화면(씨드 입고관리 등)은 이 컴포넌트를 사용
 *
 *  ┌────────────────────────┐
 *  │ title                  │  굵은 첫 줄 (필수)
 *  │ name (code)   qty+unit │  이름(좌) + 수량(우) 한 줄 (선택)
 *  │                        │
 *  │       ┌────────┐       │
 *  │       │        │       │
 *  │       │   QR   │       │  QR (크게, 가운데)
 *  │       │        │       │
 *  │       └────────┘       │
 *  └────────────────────────┘
 */
export interface QrLabelItem {
  /** React key 용 고유값 */
  id: string;
  /** QR 코드에 담을 값 (비어 있으면 id 사용). 예) 바코드번호, URL, JSON 문자열 */
  qrValue?: string;
  /** 첫 줄(굵게). 예) LOT번호, 설비코드, "씨드 입고" */
  title: string;
  /** 둘째 줄 왼쪽 이름. 예) 품목명, 설비명 */
  name?: string;
  /** 이름 뒤 괄호 코드. 예) 품목코드 */
  code?: string;
  /** 수량 (undefined 이면 수량 숨김) */
  qty?: number;
  /** 수량 앞 문구 (기본 "수량") */
  qtyLabel?: string;
  /** 수량 뒤 단위 */
  unit?: string;
}

export interface QrLabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: QrLabelItem[];
  /** 모달 제목 (기본: QR 라벨 인쇄 미리보기) */
  modalTitle?: string;
  /** 값이 있으면 [인쇄] 클릭 시 확인창을 먼저 띄운다. 취소하면 인쇄하지 않음 */
  confirmMessage?: string;
  /**
   * 인쇄 흐름이 끝난 뒤(브라우저 afterprint) 호출된다.
   * ※ 브라우저는 인쇄창에서 '취소'를 눌러도 afterprint 를 발생시킨다.
   */
  onPrinted?: () => void | Promise<void>;
  /** onPrinted 처리 중(API 호출 등)에는 버튼 잠금 */
  isBusy?: boolean;
}

export function QrLabelPrintModal({
  isOpen,
  onClose,
  items,
  modalTitle = "QR 라벨 인쇄 미리보기",
  confirmMessage,
  onPrinted,
  isBusy = false,
}: QrLabelPrintModalProps) {
  if (!isOpen) return null;

  const isSingle = items.length === 1;

  const handlePrint = () => {
    if (isBusy || items.length === 0) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    if (onPrinted) {
      window.addEventListener(
        "afterprint",
        () => {
          void onPrinted();
        },
        { once: true },
      );
    }

    window.focus();
    window.print();
  };

  const modal = (
    /*
     * ★ id="label-print-root" 는 변경 금지.
     *   작업지시서 인쇄 CSS(WorkOrderPrintModal.css)와 기존 라벨 CSS 가
     *   이 id 를 "인쇄 대상"으로 예외 처리하고 있어서, 다른 id 를 쓰면
     *   인쇄 시 모달 전체가 숨겨질 수 있음.
     *   (한 화면에서 라벨 모달은 동시에 하나만 열리므로 id 가 같아도 문제 없음)
     */
    <div id="label-print-root" className="label-print-root qr-label-root">
      <div className="qr-label-modal__overlay">
        <div className={`qr-label-modal ${isSingle ? "qr-label-modal--single" : ""}`}>
          <div className="qr-label-modal__header">
            <div>
              <h2 className="qr-label-modal__title">{modalTitle}</h2>
              <p className="qr-label-modal__subtitle">
                선택한 항목만 라벨로 출력됩니다. (총 {items.length}건)
              </p>
            </div>

            <div className="qr-label-modal__actions">
              <button
                type="button"
                className="ghostButton qr-label-modal__btn"
                onClick={onClose}
                disabled={isBusy}
              >
                닫기
              </button>
              <button
                type="button"
                className="primaryButton qr-label-modal__btn"
                onClick={handlePrint}
                disabled={isBusy || items.length === 0}
              >
                {isBusy ? "처리 중..." : "인쇄"}
              </button>
            </div>
          </div>

          <div className="qr-label-modal__body">
            <div className={`qr-label-modal__grid ${isSingle ? "qr-label-modal__grid--single" : ""}`}>
              {items.map((item) => (
                <div key={item.id} className="qr-label-card">
                  {/* 1. 텍스트: 제목 + (이름 · 수량) 한 줄 */}
                  <div className="qr-label-card__title">{item.title}</div>

                  {(item.name || item.qty !== undefined) && (
                    <div className="qr-label-card__meta">
                      <div className="qr-label-card__name">
                        {item.name}
                        {item.name && item.code && (
                          <span className="qr-label-card__code"> ({item.code})</span>
                        )}
                      </div>

                      {item.qty !== undefined && (
                        <div className="qr-label-card__qty">
                          {item.qtyLabel ?? "수량"}{" "}
                          <strong>
                            {item.qty.toLocaleString()}
                            {item.unit ?? ""}
                          </strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. QR (가운데, 크게) */}
                  <div className="qr-label-card__qr">
                    <QRCode value={item.qrValue || item.id} size={256} level="M" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
