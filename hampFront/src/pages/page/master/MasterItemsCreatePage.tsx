import { useState, useEffect, type SyntheticEvent, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FoodIcon, PlantIcon } from "@/components/icons/CustomIcons";
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

  // 슬림화된 커스텀 훅 구조분해 할당
  const {
    routings,
    keyboardActiveIndex,
    syncRoutings,
    removeRouting: handleRemoveRouting,
    updateRouting: handleRoutingChange,
    moveRouting,
    handleKeyDown,
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
      {/* 등록 전용 독립 카드 컨테이너 */}
      <div className="createCard">
        
        {/* 헤더 영역 */}
        <div className="createHeader">
          <h1 className="createTitle">신규 품목 등록</h1>
          <span className="createMeta">* 표시는 필수 입력 항목입니다</span>
        </div>

        {/* 본문 폼 영역 */}
        <form onSubmit={handleSubmit}>
          <div className="createBody">
            
            {/* 1. 기본 정보 섹션 */}
            <div className="createSection">
              <h2 className="createSectionTitle">기본정보</h2>
              <div className="createGrid2Cols">
                <div className="createField">
                  <label className="requiredLabel">
                    품목코드 <span className="required">*</span>
                  </label>
                  <input 
                    className="tableInput" 
                    value={form.itemCode} 
                    disabled={isSubmitting} 
                    onChange={(e) => handleChange("itemCode", e.target.value)} 
                    placeholder="예: ITM001" 
                  />
                </div>

                <div className="createField">
                  <label className="requiredLabel">
                    품목명 <span className="required">*</span>
                  </label>
                  <input 
                    className="tableInput" 
                    value={form.itemNm} 
                    disabled={isSubmitting} 
                    onChange={(e) => handleChange("itemNm", e.target.value)} 
                    placeholder="예: 헴프 파우더" 
                  />
                </div>

                <div className="createField">
                  <label>단위</label>
                  <input 
                    className="tableInput" 
                    value={form.unit} 
                    disabled={isSubmitting} 
                    onChange={(e) => handleChange("unit", e.target.value)} 
                    placeholder="예: EA, BOX, KG" 
                  />
                </div>

                <div className="createField">
                  <label>규격</label>
                  <input 
                    className="tableInput" 
                    value={form.standard} 
                    disabled={isSubmitting} 
                    onChange={(e) => handleChange("standard", e.target.value)} 
                    placeholder="예: 500g" 
                  />
                </div>
              </div>
            </div>

            {/* 2. 분류 정보 섹션 */}
            <div className="createSection">
              <h2 className="createSectionTitle">분류정보</h2>
              <div className="createGrid2Cols">
                <div className="createField">
                  <label className="requiredLabel">
                    종류 <span className="required">*</span>
                  </label>
                  <div className="cardButtonGroup" style={{ width: "100%" }}>
                    {Object.entries(PRODUCT_TYPE_LABEL).map(([key, label]) => {
                      const isSelected = form.productType === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`inlineTypeButton ${isSelected ? "active" : ""}`}
                          disabled={isSubmitting}
                          onClick={() => handleChange("productType", key)}
                        >
                          <span className="inlineButtonInner">
                            <span className="cardIcon">
                              {key === "0" ? <FoodIcon /> : <PlantIcon />}
                            </span>
                            <span className="cardText">{label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="createField">
                  <label className="requiredLabel">
                    품목구분 <span className="required">*</span>
                  </label>
                  <div className="cardButtonGroup" style={{ width: "100%" }}>
                    {Object.entries(CATEGORY_LABEL).map(([key, label]) => {
                      const isSelected = form.category === key;
                      const subDescriptions: Record<string, string> = {
                        "0": "입고 소재",
                        "1": "공정 중간산출",
                        "2": "출하 대상",
                      };
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`typeCardButton ${isSelected ? "active" : ""}`}
                          disabled={isSubmitting}
                          onClick={() => handleChange("category", key)}
                        >
                          <span className="cardText main">{label}</span>
                          {subDescriptions[key] && (
                            <span className="cardText sub">{subDescriptions[key]}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 공정 라우팅 설정 영역 */}
            {isRoutingRequired && (
              <div className="createSection">
                <div className="routingHeader">
                  <label className="requiredLabel">
                    공정 라우팅 설정 <span className="required">*</span>
                  </label>
                  <div className="routingHeaderRight">
                    <span className="routingCount">총 {routings.length}단계</span>
                    <button 
                      type="button" 
                      className="miniButton primary" 
                      disabled={isSubmitting} 
                      onClick={handleOpenModal}
                    >
                      공정 선택 / 추가
                    </button>
                  </div>
                </div>

                <div className="routingHint">
                  💡 <kbd>방향키(상/하)</kbd>로 공정 아이템을 탐색하고, <kbd>Space</kbd>/<kbd>Enter</kbd>로 선택(활성화) 후 상/하 방향키로 순서를 변경하세요. (<kbd>Esc</kbd> 취소)
                </div>

                {routings.length === 0 ? (
                  <div className="routingEmptyBox">선택된 공정이 없습니다. [공정 선택 / 추가] 버튼을 눌러주세요.</div>
                ) : (
                  <div className="routingList">
                    {routings.map((route, index) => {
                      const matchedOp = operations.find((op) => op.operCode === route.operCode);
                      const isKeyboardActive = keyboardActiveIndex === index;
                      const isFinal = route.finalYn === "Y";

                      return (
                        <div
                          key={`${route.operCode}-${index}`}
                          ref={(el) => { itemRefs.current[index] = el; }}
                          tabIndex={!isSubmitting ? 0 : -1}
                          role="button"
                          aria-pressed={isKeyboardActive}
                          className={`routingItem isEditing ${isKeyboardActive ? "keyboardActive" : ""}`}
                          onMouseDown={() => {
                            if (!isSubmitting) {
                              itemRefs.current[index]?.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (isSubmitting) return;

                            if (keyboardActiveIndex === null && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                              let nextIndex = index;
                              if (e.key === "ArrowUp") nextIndex = index - 1;
                              if (e.key === "ArrowDown") nextIndex = index + 1;

                              if (nextIndex >= 0 && nextIndex < routings.length) {
                                e.preventDefault();
                                itemRefs.current[nextIndex]?.focus();
                              }
                              return;
                            }

                            const nextIndex = handleKeyDown(e, index);
                            if (nextIndex !== undefined) {
                              setTimeout(() => itemRefs.current[nextIndex]?.focus(), 0);
                            }
                          }}
                        >
                          {/* STEP 동그란 뱃지 및 순서 변경 투명 셀렉트 오버레이 영역 */}
                          <div className="routingStepWrapper">
                            <div className="routingStepContainer">
                              <div className={`routingStepBadge ${isFinal ? "final" : ""}`}>
                                <span className="stepText">STEP</span>
                                <span className="stepNum">{String(route.operSeq ?? index + 1).padStart(2, "0")}</span>
                              </div>

                              <select
                                className="routingStepOverlaySelect"
                                value={route.operSeq ?? index + 1}
                                disabled={isSubmitting}
                                tabIndex={-1}
                                title="순서 변경"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newSeq = Number(e.target.value);
                                  moveRouting(index, newSeq - 1);
                                }}
                              >
                                {routings.map((_, idx) => (
                                  <option key={idx + 1} value={idx + 1}>
                                    {idx + 1}순서로 이동
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* 공정 정보 영역 */}
                          <div className="routingInfoWrapper">
                            <span className="routingCode">{route.operCode}</span>
                            <span className="routingName">
                              {matchedOp ? matchedOp.operNm : ""}
                            </span>
                          </div>

                          {/* 최종공정 여부 셀렉트 */}
                          <div>
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
                          </div>

                          {/* 제외 버튼 */}
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

          </div>

          {/* 푸터 버튼 영역 */}
          <div className="createFooter">
            <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>
              취소
            </button>
            <button type="submit" className="primaryButton" disabled={isSubmitting}>
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </div>

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