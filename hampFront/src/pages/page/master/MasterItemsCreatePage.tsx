import { useState, useEffect, type SyntheticEvent, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import axios from "axios";
import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  type ItemCreateRequest,
  type ProductType,
  type ItemCategory,
  ItemApi,
} from "@/api/master/Item";
import { OperationApi } from "@/api/master/Operation";
import { OperationSelectModal } from "@components/common/OperationSelectModal";
import { useItemRoutings } from "@/hooks/useItemRoutings";
import './MasterItem.css';

interface OperationOption {
  operCode: string;
  operNm: string;
}

export function MasterItemsCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 키보드 이동 후 포커스 유지를 위한 ref 배열
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 전체 공정 옵션 목록 상태
  const [operations, setOperations] = useState<OperationOption[]>([]);

  // 기본 폼 상태
  const [form, setForm] = useState<{
    itemCode: string;
    productType: string;
    category: string;
    itemNm: string;
    unit: string;
    standard: string;
  }>({
    itemCode: "",
    productType: "",
    category: "",
    itemNm: "",
    unit: "",
    standard: "",
  });

  // 커스텀 훅을 통한 공정 라우팅 및 드래그/키보드 이동 관리 (moveRouting 추가)
  const {
    routings,
    draggingIndex,
    targetIndex,
    keyboardActiveIndex,
    syncRoutings,
    removeRouting: handleRemoveRouting,
    updateRouting: handleRoutingChange,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    handleKeyDown,
    moveRouting,
  } = useItemRoutings();

  // 다중 선택 팝업 모달 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearchKeyword, setModalSearchKeyword] = useState("");
  const [tempSelectedCodes, setTempSelectedCodes] = useState<string[]>([]);

  // 페이지 진입 시 공정 옵션 데이터 페칭
  useEffect(() => {
    const fetchOperations = async () => {
      try {
        const response = await OperationApi.getOptions();
        const data = response.data || [];
        setOperations(data);
      } catch (error) {
        console.error("공정 옵션 목록 조회 실패:", error);
      }
    };
    fetchOperations();
  }, []);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "category" && value === "0") {
      syncRoutings([]);
    }
  };

  const handleOpenModal = () => {
    setModalSearchKeyword("");
    const currentCodes = routings.map((r) => r.operCode).filter(Boolean) as string[];
    setTempSelectedCodes(currentCodes);
    setIsModalOpen(true);
  };

  const handleConfirmModal = () => {
    syncRoutings(tempSelectedCodes);
    setIsModalOpen(false);
  };

  const validateForm = (): boolean => {
    if (!form.itemCode.trim()) {
      alert("품목 코드를 입력해주세요.");
      return false;
    }
    const selectedCategory = form.category !== "" ? (Number(form.category) as ItemCategory) : null;
    if ((selectedCategory === 1 || selectedCategory === 2) && routings.length === 0) {
      alert("반제품/완제품 등록 시 공정 라우팅을 최소 1개 이상 추가해야 합니다.");
      return false;
    }
    return true;
  };

  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/items?${queryString}` : "/master/items");
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const selectedCategory = form.category !== "" ? (Number(form.category) as ItemCategory) : null;
    const payload: ItemCreateRequest = {
      itemCode: form.itemCode.trim(),
      productType: form.productType !== "" ? (Number(form.productType) as ProductType) : null,
      category: selectedCategory,
      itemNm: form.itemNm.trim() || null,
      unit: form.unit.trim() || null,
      standard: form.standard.trim() || null,
      routings: (selectedCategory === 1 || selectedCategory === 2)
        ? routings.map((r) => ({
          operCode: r.operCode?.trim() || null,
          operSeq: r.operSeq,
          finalYn: r.finalYn || "N",
        }))
        : null,
    };

    setIsSubmitting(true);
    try {
      await ItemApi.create(payload);
      alert("성공적으로 등록되었습니다.");
      navigate("/master/items", { replace: true });
    } catch (error) {
      console.error("품목 등록 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(message || "품목 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRoutingRequired = form.category === "1" || form.category === "2";

  return (
    <section className="screenStack">
      <Panel title="신규 품목 등록">
        <form className="pageForm" onSubmit={handleSubmit}>
          <div className="detailField">
            <label className="requiredLabel">품목코드 <span className="required">*</span></label>
            <input className="tableInput" value={form.itemCode} disabled={isSubmitting} onChange={(e) => handleChange("itemCode", e.target.value)} placeholder="예: ITM001" />
          </div>

          <div className="detailField">
            <label>종류</label>
            <div className="radioGroup">
              {Object.entries(PRODUCT_TYPE_LABEL).map(([key, label]) => {
                const isSelected = form.productType === key;
                return (
                  <label
                    key={key}
                    className={`radioRow ${isSelected ? "checked" : ""}`}
                    style={{ cursor: isSubmitting ? "not-allowed" : "pointer" }}
                  >
                    <input
                      type="radio"
                      name="productType"
                      value={key}
                      checked={isSelected}
                      disabled={isSubmitting}
                      onChange={(e) => handleChange("productType", e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="detailField">
            <label>품목구분</label>
            <div className="radioGroup">
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => {
                const isSelected = form.category === key;
                return (
                  <label
                    key={key}
                    className={`radioRow ${isSelected ? "checked" : ""}`}
                    style={{ cursor: isSubmitting ? "not-allowed" : "pointer" }}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={key}
                      checked={isSelected}
                      disabled={isSubmitting}
                      onChange={(e) => handleChange("category", e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="detailField">
            <label>품목명</label>
            <input className="tableInput" value={form.itemNm} disabled={isSubmitting} onChange={(e) => handleChange("itemNm", e.target.value)} placeholder="예: 헴프 파우더" />
          </div>

          <div className="detailField">
            <label>단위</label>
            <input className="tableInput" value={form.unit} disabled={isSubmitting} onChange={(e) => handleChange("unit", e.target.value)} placeholder="예: EA, BOX, KG" />
          </div>

          <div className="detailField">
            <label>규격</label>
            <input className="tableInput" value={form.standard} disabled={isSubmitting} onChange={(e) => handleChange("standard", e.target.value)} placeholder="예: 500g" />
          </div>

          {isRoutingRequired && (
            <div className="routingSection">
              <div className="routingHeader">
                <label className="requiredLabel" style={{ fontWeight: 600 }}>공정 라우팅 설정 <span className="required">*</span></label>
                <button type="button" className="miniButton primary" disabled={isSubmitting} onClick={handleOpenModal}>공정 선택 / 추가</button>
              </div>

              {/* 조작 가이드 안내 */}
              <div className="routingHint">
                💡 <kbd>마우스</kbd>로 공정 카드를 선택하거나 드래그 하세요.
                <kbd>방향키</kbd>로 공정 카드를 탐색하고, <kbd>Space</kbd>/<kbd>Enter</kbd>로 선택(잡기) 후 이동하세요. (<kbd>Esc</kbd> 취소)
              </div>

              {routings.length === 0 ? (
                <div className="routingEmptyBox">선택된 공정이 없습니다. [공정 선택 / 추가] 버튼을 눌러주세요.</div>
              ) : (
                <div className="routingGrid" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                  {routings.map((route, index) => {
                    const matchedOp = operations.find((op) => op.operCode === route.operCode);
                    const isDragging = draggingIndex === index;
                    const isTarget = targetIndex === index && draggingIndex !== index;
                    const isKeyboardActive = keyboardActiveIndex === index;

                    return (
                      <div
                        key={`${route.operCode}-${index}`}
                        ref={(el) => { itemRefs.current[index] = el; }}
                        tabIndex={!isSubmitting ? 0 : -1}
                        role="button"
                        aria-pressed={isKeyboardActive}
                        className={`routingItem ${isDragging ? "dragging" : ""} ${isTarget ? "dragTarget" : ""} ${isKeyboardActive ? "keyboardActive" : ""}`}
                        onMouseDown={() => {
                          if (!isSubmitting) {
                            handleMouseDown(index);
                            itemRefs.current[index]?.focus();
                          }
                        }}
                        onMouseEnter={() => !isSubmitting && handleMouseEnter(index)}
                        onKeyDown={(e) => {
                          if (isSubmitting) return;

                          // 방향키 단독 입력 시 카드 간 포커스 이동 (잡기 상태가 아닐 때)
                          if (keyboardActiveIndex === null && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                            let nextIndex = index;
                            const columns = 2; // 2열 그리드 구조

                            switch (e.key) {
                              case "ArrowUp": nextIndex = index - columns; break;
                              case "ArrowDown": nextIndex = index + columns; break;
                              case "ArrowLeft": nextIndex = index - 1; break;
                              case "ArrowRight": nextIndex = index + 1; break;
                            }

                            if (nextIndex >= 0 && nextIndex < routings.length) {
                              e.preventDefault();
                              itemRefs.current[nextIndex]?.focus();
                            }
                            return;
                          }

                          // 훅의 handleKeyDown 호출
                          const nextIndex = handleKeyDown(e, index, 2);
                          if (nextIndex !== undefined) {
                            setTimeout(() => itemRefs.current[nextIndex]?.focus(), 0);
                          }
                        }}
                      >
                        {/* 1. 드래그 핸들 */}
                        <span className="dragHandle" title="마우스로 잡고 이동">☰</span>

                        {/* 2. 기존 routingSeq 클래스를 그대로 활용한 순서 드롭다운 영역 */}
                        <div className="routingSeq">
                          <select
                            className="tableInput"
                            style={{
                              width: "100%",
                              padding: "2px 4px",
                              height: "42px",
                              fontSize: "15px",
                              textAlign: "center",
                            }}
                            value={route.operSeq ?? 0}
                            disabled={isSubmitting}
                            tabIndex={-1}
                            onClick={(e) => e.stopPropagation()} // 드롭다운 클릭 시 드래그 방지
                            onChange={(e) => {
                              const newSeq = Number(e.target.value);
                              moveRouting(index, newSeq - 1);
                            }}
                          >
                            {routings.map((_, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                {idx + 1}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 3. 공정 정보 */}
                        <div className="routingInfo">
                          {route.operCode} {matchedOp ? `(${matchedOp.operNm})` : ""}
                        </div>

                        {/* 4. 일반/최종공정 셀렉트 */}
                        <select
                          className="tableInput routingSelect"
                          value={route.finalYn ?? "N"}
                          disabled={isSubmitting}
                          tabIndex={-1}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleRoutingChange(index, "finalYn", e.target.value)}
                        >
                          <option value="N">일반공정</option>
                          <option value="Y">최종공정</option>
                        </select>

                        {/* 5. 제외 버튼 */}
                        <button
                          type="button"
                          className="miniButton danger"
                          disabled={isSubmitting}
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRouting(index);
                          }}
                        >
                          제외
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="pageFormFooter">
            <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>취소</button>
            <button type="submit" className="primaryButton" disabled={isSubmitting}>{isSubmitting ? "등록 중..." : "등록"}</button>
          </div>
        </form>
      </Panel>

      <OperationSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        operations={operations}
        modalSearchKeyword={modalSearchKeyword}
        setModalSearchKeyword={setModalSearchKeyword}
        tempSelectedCodes={tempSelectedCodes}
        setTempSelectedCodes={setTempSelectedCodes}
        onConfirm={handleConfirmModal}
      />
    </section>
  );
}