import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";

interface OperationOption {
  operCode: string;
  operNm: string | null; 
}

export interface OperationSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  operations: OperationOption[];
  modalSearchKeyword: string;
  setModalSearchKeyword: Dispatch<SetStateAction<string>>;
  tempSelectedCodes: string[];
  setTempSelectedCodes: Dispatch<SetStateAction<string[]>>;
  onConfirm: () => void;
}

export function OperationSelectModal({
  isOpen, onClose, operations, modalSearchKeyword, setModalSearchKeyword,
  tempSelectedCodes, setTempSelectedCodes, onConfirm,
}: OperationSelectModalProps) {
  if (!isOpen) return null;

  const filteredOperations = useMemo(() => {
    if (!modalSearchKeyword.trim()) return operations;
    const keyword = modalSearchKeyword.toLowerCase();
    return operations.filter(
      (op) =>
        op.operCode.toLowerCase().includes(keyword) ||
        (op.operNm || "").toLowerCase().includes(keyword)
    );
  }, [operations, modalSearchKeyword]);

  const isAllFilteredSelected =
    filteredOperations.length > 0 &&
    filteredOperations.every((op) => tempSelectedCodes.includes(op.operCode));

  const handleToggleCheckbox = (operCode: string) => {
    setTempSelectedCodes((prev) =>
      prev.includes(operCode) ? prev.filter((code) => code !== operCode) : [...prev, operCode]
    );
  };

  const handleToggleSelectAll = () => {
    const filteredCodes = filteredOperations.map((op) => op.operCode);
    if (isAllFilteredSelected) {
      setTempSelectedCodes((prev) => prev.filter((code) => !filteredCodes.includes(code)));
    } else {
      setTempSelectedCodes((prev) => Array.from(new Set([...prev, ...filteredCodes])));
    }
  };

  return (
    <div className="modalOverlay">
      <div className="detailModal">
        <div className="detailModalHeader">
          <div>
            <h3>공정 선택</h3>
            <span>품목에 추가할 공정 라우팅을 선택하세요.</span>
          </div>
          <button type="button" className="detailModalClose" onClick={onClose}>✕</button>
        </div>
        <div className="detailModalBody modalBodyFlex">
          <input type="text" className="tableInput modalSearchInput" placeholder="공정 코드 또는 공정명 검색..." 
                 value={modalSearchKeyword} onChange={(e) => setModalSearchKeyword(e.target.value)} autoFocus />
          <div className="modalSelectAllRow">
            <div className="modalCountText">선택된 공정 수: <strong>{tempSelectedCodes.length}</strong>개</div>
            <button type="button" className="miniButton ghostButton" onClick={handleToggleSelectAll}>
              {isAllFilteredSelected ? "전체 해제" : "전체 선택"}
            </button>
          </div>
          <div className="modalListContainer">
            {filteredOperations.length === 0 ? <div className="modalEmptyText">검색된 공정이 없습니다.</div> : (
              filteredOperations.map((op) => (
                <div key={op.operCode} onClick={() => handleToggleCheckbox(op.operCode)} 
                     className={`modalListItem ${tempSelectedCodes.includes(op.operCode) ? "modalListItemChecked" : ""}`}>
                  <input type="checkbox" checked={tempSelectedCodes.includes(op.operCode)} onChange={() => {}} />
                  <div className="modalListItemContent">
                    {/* 공정명이 없으면 "-" 표시 */}
                    <span className="modalListItemTitle">{op.operNm || "-"}</span>
                    <span className="modalListItemCode">{op.operCode}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="detailModalFooter">
          <button type="button" className="ghostButton" onClick={onClose}>취소</button>
          <button type="button" className="primaryButton" onClick={onConfirm}>선택 완료 ({tempSelectedCodes.length}개 적용)</button>
        </div>
      </div>
    </div>
  );
}