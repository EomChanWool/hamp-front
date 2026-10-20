import { useState, useEffect, useRef, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
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
import { OperationSelectModal } from "@/components/modal/OperationSelectModal";
import { useItemRoutings } from "@/hooks/useItemRoutings";
import './MasterItem.css';
import { Badge } from "@/components/common/Badge";
import {
  RoutingMaterialSection,
  toMaterialRequests,
  type RoutingMaterialDraft,
} from "@/components/common/RoutingMatarialSection";

interface OperationOption {
  operCode: string;
  operNm: string;
}

export function MasterItemsCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [operations, setOperations] = useState<OperationOption[]>([]);

  const [form, setForm] = useState<{
    itemCode: string;
    productType: ProductType | "";
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

  const {
    routings,
    syncRoutings,
    removeRouting: handleRemoveRouting,
    updateRouting: handleRoutingChange,
    moveRouting,
  } = useItemRoutings();

  //  공정코드(operCode)별 투입/산출 자재 목록
  //  - 훅(useItemRoutings)은 건드리지 않고, 공정코드를 key 로 별도 보관합니다.
  //  - 공정 순서를 바꾸거나 삭제해도 key 가 operCode 라서 자재가 꼬이지 않습니다.
  const [routingMaterials, setRoutingMaterials] = useState<Record<string, RoutingMaterialDraft[]>>({});

  /** 특정 공정의 자재 목록 교체 */
  const handleMaterialsChange = (operCode: string, next: RoutingMaterialDraft[]) => {
    setRoutingMaterials((prev) => ({ ...prev, [operCode]: next }));
  };

  /** 특정 공정을 제외할 때 해당 공정의 자재도 함께 제거 */
  const removeMaterialsOf = (operCode: string) => {
    setRoutingMaterials((prev) => {
      const next = { ...prev };
      delete next[operCode];
      return next;
    });
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearchKeyword, setModalSearchKeyword] = useState("");
  const [tempSelectedCodes, setTempSelectedCodes] = useState<string[]>([]);

  const routingItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (selectedIndex !== null && routingItemRefs.current[selectedIndex]) {
      routingItemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

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

  useEffect(() => {
    if (routings.length === 0) {
      setSelectedIndex(null);
    } else if (selectedIndex === null || selectedIndex >= routings.length) {
      setSelectedIndex(0);
    }
  }, [routings.length, selectedIndex]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    // 원료 또는 반제품이면 공정 라우팅(+ 자재) 초기화
    if (key === "category" && (value === "0" || value === "1")) {
      syncRoutings([]);
      setRoutingMaterials({});
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

    // 완제품만 공정 라우팅 필수
    if (form.category === "2" && routings.length === 0) {
      alert("완제품 등록 시 공정 라우팅을 최소 1개 이상 추가해야 합니다.");
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
      routings: selectedCategory === 2
        ? routings.map((r) => ({
          operCode: r.operCode?.trim() || null,
          operSeq: r.operSeq,
          finalYn: r.finalYn || "N",
          // 현재 남아있는 공정의 자재만 전송 (제외된 공정의 자재는 자동으로 빠짐)
          materials: toMaterialRequests(routingMaterials[r.operCode ?? ""]),
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

  const isRoutingRequired = form.category === "2";
  const selectedRouting = selectedIndex !== null && routings[selectedIndex] ? routings[selectedIndex] : null;
  const selectedMatchedOp = selectedRouting ? operations.find((op) => op.operCode === selectedRouting.operCode) : null;
  // 선택된 공정의 operCode (자재 맵의 key)
  const selectedOperCode = selectedRouting?.operCode ?? "";

  return (
    <section className="screenStack">
      <div className="createCard">
        <div className="createHeader">
          <h1 className="createTitle">신규 품목 등록</h1>
          <span className="createMeta">* 표시는 필수 입력 항목입니다</span>
        </div>

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
                  <div className="cardButtonGroup routing-w-100">
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
                  <div className="cardButtonGroup routing-w-100">
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
                <div className="routing-header-wrapper">
                  <label className="requiredLabel routing-header-label">
                    공정 라우팅 설정 <span className="required">*</span>
                  </label>
                  <div className="routing-header-right">
                    <span className="routing-count-text">총 {routings.length}단계</span>
                    <button
                      type="button"
                      className="miniButton primary"
                      disabled={isSubmitting}
                      onClick={handleOpenModal}
                    >
                      + 공정 선택 / 추가
                    </button>
                  </div>
                </div>

                <div className="routing-guide-text">
                  ⠿ 드래그로 순서 변경, 항목 선택 시 우측에서 상세 편집
                </div>

                {routings.length === 0 ? (
                  <div className="routingEmptyBox">
                    선택된 공정이 없습니다. [+ 공정 선택 / 추가] 버튼을 눌러주세요.
                  </div>
                ) : (
                  <div className="routing-layout-grid">
                    {/* [좌측 영역] 공정 리스트 */}
                    <div className="routing-list-container">
                      {routings.map((route, index) => {
                        const matchedOp = operations.find((op) => op.operCode === route.operCode);
                        const isFinal = route.finalYn === "Y";
                        const isSelected = selectedIndex === index;
                        const isDragOver = dragOverIndex === index;
                        const isDragged = draggedIndex === index;

                        return (
                          <div
                            key={`${route.operCode}-${index}`}
                            ref={(el) => { routingItemRefs.current[index] = el; }}
                            draggable
                            onDragStart={() => setDraggedIndex(index)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverIndex(index);
                            }}
                            onDragLeave={() => {
                              if (dragOverIndex === index) setDragOverIndex(null);
                            }}
                            onDragEnd={() => {
                              setDraggedIndex(null);
                              setDragOverIndex(null);
                            }}
                            onDrop={() => {
                              if (draggedIndex !== null) {
                                moveRouting(draggedIndex, index);
                                setSelectedIndex(index);
                              }
                              setDraggedIndex(null);
                              setDragOverIndex(null);
                            }}
                            onClick={() => setSelectedIndex(index)}
                            className={`routing-list-item ${isSelected ? "is-selected" : ""} ${isDragOver ? "is-drag-over" : ""} ${isDragged ? "is-dragged" : ""}`}
                          >
                            <div className="routing-item-left">
                              <span
                                className={`routing-drag-handle ${isDragged ? "is-dragging" : ""}`}
                                title="드래그하여 순서 변경"
                              >
                                ⠿
                              </span>
                              <span className="routing-seq">
                                {String(route.operSeq ?? index + 1).padStart(2, "0")}
                              </span>
                              <Badge tone="info">{route.operCode}</Badge>
                              <span className="routing-oper-nm">
                                {matchedOp ? matchedOp.operNm : ""}
                              </span>
                            </div>

                            <div className="routing-item-right">
                              <span className={`routing-type-badge ${isFinal ? "is-final" : ""}`}>
                                {isFinal ? "최종공정" : "일반공정"}
                              </span>

                              <div className="routing-arrow-group">
                                <button
                                  type="button"
                                  className="routing-arrow-btn"
                                  disabled={index === 0 || isSubmitting}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveRouting(index, index - 1);
                                    setSelectedIndex(index - 1);
                                  }}
                                  title="위로 이동"
                                >
                                  <ChevronUpIcon className="routing-arrow-icon" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="routing-arrow-btn"
                                  disabled={index === routings.length - 1 || isSubmitting}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveRouting(index, index + 1);
                                    setSelectedIndex(index + 1);
                                  }}
                                  title="아래로 이동"
                                >
                                  <ChevronDownIcon className="routing-arrow-icon" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* [우측 영역] 선택된 공정 상세 편집 패널 */}
                    <div className="routing-detail-panel">
                      {selectedRouting && selectedIndex !== null ? (
                        <div>
                          {/* STEP 카드 */}
                          <div className="routing-step-card">
                            <div className="routing-step-badge">
                              <div className="routing-step-badge-title">STEP</div>
                              <div className="routing-step-badge-num">{String(selectedIndex + 1).padStart(2, "0")}</div>
                            </div>
                            <div>
                              <div className="routing-step-info-nm">
                                {selectedMatchedOp ? selectedMatchedOp.operNm : selectedRouting.operCode}
                              </div>
                              <div className="routing-step-info-code">{selectedRouting.operCode}</div>
                            </div>
                          </div>

                          {/* 앞으로 / 뒤로 빠른 이동 */}
                          <div className="routing-move-grid">
                            <button
                              type="button"
                              className="routing-move-btn"
                              disabled={selectedIndex === 0 || isSubmitting}
                              onClick={() => {
                                moveRouting(selectedIndex, selectedIndex - 1);
                                setSelectedIndex(selectedIndex - 1);
                              }}
                            >
                              <ChevronUpIcon className="routing-arrow-icon" aria-hidden="true" />
                              앞으로
                            </button>
                            <button
                              type="button"
                              className="routing-move-btn"
                              disabled={selectedIndex === routings.length - 1 || isSubmitting}
                              onClick={() => {
                                moveRouting(selectedIndex, selectedIndex + 1);
                                setSelectedIndex(selectedIndex + 1);
                              }}
                            >
                              <ChevronDownIcon className="routing-arrow-icon" aria-hidden="true" />
                              뒤로
                            </button>
                          </div>

                          <div className="routing-form-row">
                            <div className="routing-form-group">
                              <label className="routing-label">공정명</label>
                              <input
                                type="text"
                                className="tableInput routing-input-readonly"
                                value={selectedMatchedOp ? selectedMatchedOp.operNm : ""}
                                disabled
                              />
                            </div>

                            <div className="routing-form-group">
                              <label className="routing-label">공정구분</label>
                              <select
                                className="tableInput routing-select"
                                value={selectedRouting.finalYn ?? "N"}
                                disabled={isSubmitting}
                                onChange={(e) => handleRoutingChange(selectedIndex, "finalYn", e.target.value)}
                              >
                                <option value="N">일반공정</option>
                                <option value="Y">최종공정</option>
                              </select>
                            </div>
                          </div>

                          {/* 이 공정의 투입(IN) / 산출(OUT) 자재 */}
                          <RoutingMaterialSection
                            resetKey={selectedOperCode}
                            materials={routingMaterials[selectedOperCode] ?? []}
                            onChange={(next) => handleMaterialsChange(selectedOperCode, next)}
                            excludeItemCode={form.itemCode.trim()}
                            productType={form.productType === "" ? undefined : form.productType}
                            finalYn={selectedRouting?.finalYn ?? "N"}
                            currentItem={
                              form.itemCode.trim() && form.itemNm.trim()
                                ? {
                                  itemCode: form.itemCode.trim(),
                                  itemNm: form.itemNm.trim(),
                                  unit: form.unit.trim(),
                                }
                                : undefined
                            }
                            disabled={isSubmitting}
                          />

                          <button
                            type="button"
                            className="routing-delete-btn"
                            disabled={isSubmitting}
                            onClick={() => {
                              removeMaterialsOf(selectedOperCode); // 자재도 함께 제거
                              handleRemoveRouting(selectedIndex);
                              setSelectedIndex(null);
                            }}
                          >
                            이 공정 제외
                          </button>
                        </div>
                      ) : (
                        <div className="routing-empty-panel">
                          좌측에서 공정을 선택해주세요.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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
