import Barcode from "react-barcode";
import '@/components/modal/LabelPrintModal.css'; 

export interface WorkOrderLineDetail {
  id: string;
  salesOrderLineId: number; 
  orderCode: string;
  lineId: string;
  itemCode: string;
  itemNm: string;
  instructQty: number;
  barcode: string;
}

export interface WorkOrderMaster {
  workOrderNo: string;
  title: string;
  workDate: string;
  status: "WAIT" | "PROGRESS" | "DONE" | "DELAY"; 
  managerId: string;
  managerNm: string;
  lines: WorkOrderLineDetail[];
}

export interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLines: WorkOrderLineDetail[];
  workOrderNo: string;
}

export function LabelPrintModal({ 
  isOpen, 
  onClose, 
  selectedLines, 
  workOrderNo 
}: LabelPrintModalProps) {
  if (!isOpen) return null;

  return (
    <div className="food-label-modal-overlay">
      <div className="food-label-modal-container">
        <div className="food-label-modal-header">
          <div>
            <h2 className="food-label-modal-title">라벨 인쇄 미리보기</h2>
            <p className="food-label-modal-subtitle">선택한 라인만 라벨로 출력됩니다. (총 {selectedLines.length}건)</p>
          </div>
          <div className="food-label-modal-actions">
            <button type="button" className="ghostButton food-label-modal-btn-close" onClick={onClose}>
              닫기
            </button>
            <button type="button" className="primaryButton food-label-modal-btn-print" onClick={() => window.print()}>
              인쇄
            </button>
          </div>
        </div>

        <div className="food-label-modal-body">
          <div className="food-label-modal-grid">
            {selectedLines.map((line) => (
              <div key={line.id} className="food-label-card">
                <div className="food-card-header-meta">
                  {workOrderNo}
                </div>
                <div className="food-card-body-meta">
                  {line.itemNm} <span className="food-cell-item-code">({line.orderCode})</span>
                </div>
                <div className="food-card-qty-meta">
                  지시수량 <span style={{ fontWeight: 700 }}>{line.instructQty}</span>
                </div>
                <div className="food-card-barcode-wrap">
                  <Barcode value={line.barcode || workOrderNo} width={1.3} height={40} fontSize={11} displayValue={true} margin={0} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}