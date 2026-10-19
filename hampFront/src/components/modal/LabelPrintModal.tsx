import Barcode from "react-barcode";
import { createPortal } from "react-dom";
import "@/components/modal/LabelPrintModal.css";

/**
 *  ┌────────────────────┐
 *  │ title              │  굵은 첫 줄 (필수)
 *  │ name (code)        │  품목명 / 설비명 등 (선택)
 *  │ qtyLabel qty+unit  │  수량 (선택)
 *  │ ||||||||||||||||   │  바코드
 *  └────────────────────┘
 */
export interface LabelItem {
  /** React key 용 고유값 */
  id: string;
  /** 바코드로 찍을 값 (비어 있으면 id 사용) */
  barcode: string;
  /** 첫 줄(굵게). 예) LOT번호, 설비코드, "씨드 입고" */
  title: string;
  /** 둘째 줄 이름. 예) 품목명, 설비명 */
  name?: string;
  /** 이름 뒤 괄호 코드. 예) 품목코드 */
  code?: string;
  /** 수량 (undefined 이면 수량 줄 숨김) */
  qty?: number;
  /** 수량 앞 문구 (기본 "수량") */
  qtyLabel?: string;
  /** 수량 뒤 단위 */
  unit?: string;
}

export interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: LabelItem[];
  /** 모달 제목 (기본: 라벨 인쇄 미리보기) */
  modalTitle?: string;
  /** 값이 있으면 [인쇄] 클릭 시 확인창을 먼저 띄운다. 취소하면 인쇄하지 않음 */
  confirmMessage?: string;
  /**
   * 인쇄 흐름이 끝난 뒤(브라우저 afterprint) 호출된다.
   * LOT 관리처럼 "출력완료" 처리 API 를 호출할 때 사용.
   * ※ 브라우저는 인쇄창에서 '취소'를 눌러도 afterprint 를 발생시킨다.
   */
  onPrinted?: () => void | Promise<void>;
  /** onPrinted 처리 중(API 호출 등)에는 버튼 잠금 */
  isBusy?: boolean;
}

export function LabelPrintModal({
  isOpen,
  onClose,
  items,
  modalTitle = "라벨 인쇄 미리보기",
  confirmMessage,
  onPrinted,
  isBusy = false,
}: LabelPrintModalProps) {
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
    <div id="label-print-root" className="label-print-root">
      <div className="label-modal__overlay">
        <div className={`label-modal ${isSingle ? "label-modal--single" : ""}`}>
          <div className="label-modal__header">
            <div>
              <h2 className="label-modal__title">{modalTitle}</h2>
              <p className="label-modal__subtitle">
                선택한 항목만 라벨로 출력됩니다. (총 {items.length}건)
              </p>
            </div>

            <div className="label-modal__actions">
              <button
                type="button"
                className="ghostButton label-modal__btn"
                onClick={onClose}
                disabled={isBusy}
              >
                닫기
              </button>
              <button
                type="button"
                className="primaryButton label-modal__btn"
                onClick={handlePrint}
                disabled={isBusy || items.length === 0}
              >
                {isBusy ? "처리 중..." : "인쇄"}
              </button>
            </div>
          </div>

          <div className="label-modal__body">
            <div className={`label-modal__grid ${isSingle ? "label-modal__grid--single" : ""}`}>
              {items.map((item) => (
                <div key={item.id} className="label-card">
                  <div className="label-card__title">{item.title}</div>

                  {item.name && (
                    <div className="label-card__name">
                      {item.name}
                      {item.code && <span className="label-card__code"> ({item.code})</span>}
                    </div>
                  )}

                  {item.qty !== undefined && (
                    <div className="label-card__qty">
                      {item.qtyLabel ?? "수량"}{" "}
                      <strong>
                        {item.qty.toLocaleString()}
                        {item.unit ?? ""}
                      </strong>
                    </div>
                  )}

                  <div className="label-card__barcode">
                    <Barcode
                      value={item.barcode || item.id}
                      width={1.6}
                      height={40}
                      fontSize={11}
                      displayValue={true}
                      margin={0}
                    />
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
