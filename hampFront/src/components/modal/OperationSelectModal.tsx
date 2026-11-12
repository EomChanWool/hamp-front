import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { OPER_TYPE_LABEL, type OperType } from "@/api/master/Operation";

interface OperationOption {
  operCode: string;
  operNm: string | null;
  operType: OperType;
}

const OPER_TYPE_TABS: (OperType | "ALL")[] = ["ALL", 0, 1, 2];

export interface OperationSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  operations: OperationOption[];
  modalSearchKeyword: string;
  setModalSearchKeyword: Dispatch<SetStateAction<string>>;
  /** [중복 공정 지원] 중복을 허용하는 "순서 있는" 공정코드 배열 */
  tempSelectedCodes: string[];
  setTempSelectedCodes: Dispatch<SetStateAction<string[]>>;
  onConfirm: () => void;
}

export function OperationSelectModal({
  isOpen, onClose, operations, modalSearchKeyword, setModalSearchKeyword,
  tempSelectedCodes, setTempSelectedCodes, onConfirm,
}: OperationSelectModalProps) {
  const [operTypeTab, setOperTypeTab] = useState<OperType | "ALL">("ALL");

  const filteredOperations = useMemo(() => {
    const typed =
      operTypeTab === "ALL" ? operations : operations.filter((op) => op.operType === operTypeTab);
    if (!modalSearchKeyword.trim()) return typed;
    const keyword = modalSearchKeyword.toLowerCase();
    return typed.filter(
      (op) =>
        op.operCode.toLowerCase().includes(keyword) ||
        (op.operNm || "").toLowerCase().includes(keyword)
    );
  }, [operations, modalSearchKeyword, operTypeTab]);

  // 훅 호출이 모두 끝난 뒤에 닫힘 처리
  if (!isOpen) return null;

  /** [중복 공정 지원] 해당 공정이 선택된 횟수 */
  const countOf = (operCode: string) =>
    tempSelectedCodes.filter((code) => code === operCode).length;

  // 검색 결과 전부가 1회 이상 선택된 상태인지 (전체 선택/해제 버튼 라벨용)
  const isAllFilteredSelected =
    filteredOperations.length > 0 &&
    filteredOperations.every((op) => countOf(op.operCode) > 0);

  /** 1회 추가: 목록 맨 뒤에 붙임 (기존 단계 순서는 유지) */
  const handleIncrease = (operCode: string) => {
    setTempSelectedCodes((prev) => [...prev, operCode]);
  };

  /** 1회 감소: 같은 공정의 "마지막" 항목부터 제거 (앞쪽 단계의 자재를 보존하기 위함) */
  const handleDecrease = (operCode: string) => {
    setTempSelectedCodes((prev) => {
      const idx = prev.lastIndexOf(operCode);
      if (idx < 0) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleToggleSelectAll = () => {
    const filteredCodes = filteredOperations.map((op) => op.operCode);
    if (isAllFilteredSelected) {
      // 검색 결과 공정은 중복 포함 모두 제거
      setTempSelectedCodes((prev) => prev.filter((code) => !filteredCodes.includes(code)));
    } else {
      // 아직 한 번도 선택 안 된 공정만 1회씩 추가 (이미 선택된 공정의 수량은 유지)
      setTempSelectedCodes((prev) => [
        ...prev,
        ...filteredCodes.filter((code) => !prev.includes(code)),
      ]);
    }
  };

  return (
    <div className="modalOverlay">
      <div className="detailModal">
        <div className="detailModalHeader">
          <div>
            <h3>공정 선택</h3>
            <span>품목에 추가할 공정 라우팅을 선택하세요. 같은 공정을 여러 단계로 추가할 수 있습니다.</span>
          </div>
          <button type="button" className="detailModalClose" onClick={onClose}>✕</button>
        </div>
        <div className="detailModalBody modalBodyFlex">
          <input
            type="text"
            className="tableInput modalSearchInput"
            placeholder="공정 코드 또는 공정명 검색..."
            value={modalSearchKeyword}
            onChange={(e) => setModalSearchKeyword(e.target.value)}
            autoFocus
          />
          <div className="modalTabGroup" role="tablist" aria-label="공정 구분">
            {OPER_TYPE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={operTypeTab === tab}
                onClick={() => setOperTypeTab(tab)}
                className={`modalTabButton${operTypeTab === tab ? " modalTabButtonActive" : ""}`}
              >
                {tab === "ALL" ? "전체" : OPER_TYPE_LABEL[tab]}
              </button>
            ))}
          </div>
          <div className="modalSelectAllRow">
            {/* [중복 공정 지원] 공정 종류 수가 아니라 "총 단계 수"를 표시 */}
            <div className="modalCountText">선택된 공정 단계: <strong>{tempSelectedCodes.length}</strong>단계</div>
            <button type="button" className="miniButton ghostButton" onClick={handleToggleSelectAll}>
              {isAllFilteredSelected ? "전체 해제" : "전체 선택"}
            </button>
          </div>
          <div className="modalListContainer">
            {filteredOperations.length === 0 ? (
              <div className="modalEmptyText">검색된 공정이 없습니다.</div>
            ) : (
              filteredOperations.map((op) => {
                const count = countOf(op.operCode);
                return (
                  <div
                    key={op.operCode}
                    // 미선택 공정은 행 클릭으로 1회 추가 (이미 선택된 공정은 수량 버튼으로만 조절)
                    onClick={() => {
                      if (count === 0) handleIncrease(op.operCode);
                    }}
                    className={`modalListItem ${count > 0 ? "modalListItemChecked" : ""}`}
                  >
                    <div
                      className="modalStepper"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="modalStepperBtn"
                        disabled={count === 0}
                        onClick={() => handleDecrease(op.operCode)}
                        title="한 단계 줄이기"
                      >
                        −
                      </button>
                      <span className="modalStepperCount">{count}</span>
                      <button
                        type="button"
                        className="modalStepperBtn"
                        onClick={() => handleIncrease(op.operCode)}
                        title="같은 공정 한 단계 더 추가"
                      >
                        +
                      </button>
                    </div>
                    <div className="modalListItemContent">
                      {/* 공정명이 없으면 "-" 표시 */}
                      <span className="modalListItemTitle">{op.operNm || "-"}</span>
                      <span className="modalListItemCode">{op.operCode}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="detailModalFooter">
          <button type="button" className="ghostButton" onClick={onClose}>취소</button>
          <button type="button" className="primaryButton" onClick={onConfirm}>
            선택 완료 ({tempSelectedCodes.length}단계 적용)
          </button>
        </div>
      </div>
    </div>
  );
}
