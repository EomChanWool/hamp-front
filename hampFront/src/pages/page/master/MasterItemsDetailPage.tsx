import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { Badge } from "@components/common/Badge";
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  ItemApi,
  type ItemDetailResponse,
  type ItemUpdateRequest,
  type ProductType,
  type ItemCategory,
  type ItemRoutingRequest,
} from "@/api/master/Item";
import { OperationApi } from "@/api/master/Operation";
import Spinner from "@/components/common/Spinner";
import { OperationSelectModal } from "@/components/common/OperationSelectModal";
import { useItemRoutings } from "@/hooks/useItemRoutings";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";
import "./MasterItem.css";

interface OperationOption {
  operCode: string;
  operNm: string;
}

export function MasterItemsDetailPage() {
  const { itemCode } = useParams<{ itemCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [item, setItem] = useState<ItemDetailResponse | null>(null);
  const [operations, setOperations] = useState<OperationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  // 커스텀 훅 연동
  const {
    routings,
    syncRoutings,
    removeRouting: handleRemoveRouting,
    updateRouting: handleRoutingChange,
    moveRouting,
  } = useItemRoutings();

  // 라우팅 UI(드래그/선택/상세패널) 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const routingItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearchKeyword, setModalSearchKeyword] = useState("");
  const [tempSelectedCodes, setTempSelectedCodes] = useState<string[]>([]);

  const isBusy = isUpdating || isDeleting;

  const handleFieldChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "category" && value === "0") {
      syncRoutings([]);
    }
  };

  // 섹션 정의: 기본 정보 / 분류 정보로 그룹핑
  const sections: DetailSection<ItemDetailResponse>[] = [
    {
      title: "기본 정보",
      fields: [
        { label: "품목명", key: "itemNm", editable: true },
        { label: "단위", key: "unit", editable: true },
        { label: "규격", key: "standard", editable: true },
      ],
    },
    {
      title: "분류 정보",
      fields: [
        {
          label: "종류",
          key: "productType",
          editable: true,
          renderEditor: (value, _onChange, disabled) => (
            <select
              className="tableInput"
              value={value}
              disabled={disabled}
              onChange={(e) => handleFieldChange("productType", e.target.value)}
            >
              <option value="">선택</option>
              <option value="0">{PRODUCT_TYPE_LABEL[0]}</option>
              <option value="1">{PRODUCT_TYPE_LABEL[1]}</option>
            </select>
          ),
          renderValue: () =>
            item ? PRODUCT_TYPE_LABEL[item.productType as ProductType] ?? "-" : "-",
        },
        {
          label: "품목구분",
          key: "category",
          editable: true,
          renderEditor: (value, _onChange, disabled) => (
            <select
              className="tableInput"
              value={value}
              disabled={disabled}
              onChange={(e) => handleFieldChange("category", e.target.value)}
            >
              <option value="">선택</option>
              <option value="0">{CATEGORY_LABEL[0]}</option>
              <option value="1">{CATEGORY_LABEL[1]}</option>
              <option value="2">{CATEGORY_LABEL[2]}</option>
            </select>
          ),
          renderValue: () =>
            item ? CATEGORY_LABEL[item.category as ItemCategory] ?? "-" : "-",
        },
      ],
    },
  ];

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
    let isMounted = true;

    const fetchItemDetail = async () => {
      if (!itemCode) return;
      setIsLoading(true);

      try {
        const response = await ItemApi.getDetail(itemCode);
        const itemData = response.data;

        if (itemData && isMounted) {
          setItem(itemData);
          setForm({
            itemCode: itemData.itemCode,
            productType: itemData.productType?.toString() ?? "",
            category: itemData.category?.toString() ?? "",
            itemNm: itemData.itemNm || "",
            unit: itemData.unit || "",
            standard: itemData.standard || "",
            useYn: itemData.useYn || "",
            createdAt: formatDateTime(itemData.createdAt),
          });

          if (itemData.routings && Array.isArray(itemData.routings)) {
            const formattedRoutings: ItemRoutingRequest[] = itemData.routings.map((r, idx) => ({
              operCode: r.operCode || "",
              operSeq: r.operSeq ?? idx + 1,
              finalYn: r.finalYn || "N",
            }));
            syncRoutings(formattedRoutings.map((r) => r.operCode).filter(Boolean) as string[]);
            formattedRoutings.forEach((r, idx) => {
              if (r.finalYn === "Y") {
                handleRoutingChange(idx, "finalYn", "Y");
              }
            });
          } else {
            syncRoutings([]);
          }
        }
      } catch (error) {
        console.error("품목 상세 조회 실패:", error);
        if (isMounted) {
          alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
          navigate({ pathname: "/master/items", search: location.search });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchItemDetail();

    return () => {
      isMounted = false;
    };
  }, [itemCode, navigate, location.search]);

  useEffect(() => {
    if (item && !isEditing) {
      setForm({
        itemCode: item.itemCode,
        productType: item.productType?.toString() ?? "",
        category: item.category?.toString() ?? "",
        itemNm: item.itemNm || "",
        unit: item.unit || "",
        standard: item.standard || "",
        useYn: item.useYn || "",
        createdAt: formatDateTime(item.createdAt),
      });

      if (item.routings && Array.isArray(item.routings)) {
        syncRoutings(item.routings.map((r) => r.operCode).filter(Boolean) as string[]);
        item.routings.forEach((r, idx) => {
          if (r.finalYn === "Y") {
            handleRoutingChange(idx, "finalYn", "Y");
          }
        });
      } else {
        syncRoutings([]);
      }
    }
  }, [isEditing, item]);

  // 라우팅 목록이 바뀔 때 선택 인덱스 보정 (등록 페이지와 동일한 로직)
  useEffect(() => {
    if (routings.length === 0) {
      setSelectedIndex(null);
    } else if (selectedIndex === null || selectedIndex >= routings.length) {
      setSelectedIndex(0);
    }
  }, [routings.length, selectedIndex]);

  // 선택된 항목으로 스크롤 (수정 모드에서만 의미 있음)
  useEffect(() => {
    if (isEditing && selectedIndex !== null && routingItemRefs.current[selectedIndex]) {
      routingItemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex, isEditing]);

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
    const selectedCategory =
      form.category !== "" ? (Number(form.category) as ItemCategory) : null;

    if (selectedCategory === 1 || selectedCategory === 2) {
      if (routings.length === 0) {
        alert("반제품/완제품은 공정 라우팅을 최소 1개 이상 설정해야 합니다.");
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!item || isUpdating) return;
    if (!validateForm()) return;

    setIsUpdating(true);
    try {
      const selectedCategory =
        form.category !== "" ? (Number(form.category) as ItemCategory) : null;

      const updatePayload: ItemUpdateRequest = {
        productType:
          form.productType !== "" && form.productType != null
            ? (Number(form.productType) as ProductType)
            : null,
        category: selectedCategory,
        itemNm: form.itemNm?.trim() ? form.itemNm.trim() : null,
        unit: form.unit?.trim() ? form.unit.trim() : null,
        standard: form.standard?.trim() ? form.standard.trim() : null,
        routings:
          selectedCategory === 1 || selectedCategory === 2
            ? routings.map((r) => ({
                operCode: r.operCode?.trim() || null,
                operSeq: r.operSeq ?? 1,
                finalYn: r.finalYn || "N",
              }))
            : null,
      };

      const response = await ItemApi.update(item.itemCode, updatePayload);

      alert(response.message || "수정되었습니다.");

      setItem((prev) =>
        prev
          ? {
              ...prev,
              productType: updatePayload.productType ?? prev.productType,
              category: updatePayload.category ?? prev.category,
              itemNm: updatePayload.itemNm ?? prev.itemNm,
              unit: updatePayload.unit ?? prev.unit,
              standard: updatePayload.standard ?? prev.standard,
              routings: updatePayload.routings
                ? updatePayload.routings.map((r, idx) => ({
                    routingId: 0,
                    itemCode: prev.itemCode,
                    operCode: r.operCode ?? "",
                    operSeq: r.operSeq ?? idx + 1,
                    finalYn: r.finalYn ?? "N",
                  }))
                : [],
            }
          : null
      );

      setIsEditing(false);
    } catch (err) {
      console.error("품목 수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!item || isDeleting) return;

    const confirmed = window.confirm(
      `${item.itemNm ?? item.itemCode} 품목을 삭제하시겠습니까?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await ItemApi.delete(item.itemCode);
      alert("품목이 삭제되었습니다.");
      navigate({ pathname: "/master/items", search: location.search });
    } catch (error) {
      console.error("품목 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(message || "품목 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="screenStack">
        <div className="detailCard">
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        </div>
      </section>
    );
  }

  if (!item) return null;

  const currentCategory = isEditing ? form.category : item.category?.toString();
  const isRoutingRequired = currentCategory === "1" || currentCategory === "2";
  const selectedRouting =
    selectedIndex !== null && routings[selectedIndex] ? routings[selectedIndex] : null;
  const selectedMatchedOp = selectedRouting
    ? operations.find((op) => op.operCode === selectedRouting.operCode)
    : null;

  return (
    <section className="screenStack">
      <DetailLayout
        title={item.itemNm}
        subtitle={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{form.itemCode}</span>
            <Badge tone={form.useYn === "Y" ? "good" : "muted"}>
              {form.useYn === "Y" ? "사용" : "미사용"}
            </Badge>
          </div>
        }
        meta={`등록일자 ${form.createdAt}`}
        sections={sections}
        form={form}
        isEditing={isEditing}
        isBusy={isBusy}
        onChangeField={handleFieldChange}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        footerLeft={
          isEditing &&
          item.useYn === "Y" && (
            <button
              type="button"
              className="btnDanger"
              onClick={handleDelete}
              disabled={isBusy}
            >
              {isDeleting ? "삭제 처리 중..." : "품목 삭제"}
            </button>
          )
        }
        footerRight={
          isEditing ? (
            <>
              <button
                type="button"
                className="ghostButton"
                onClick={() => setIsEditing(false)}
                disabled={isBusy}
              >
                취소
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={handleSave}
                disabled={isBusy}
              >
                {isUpdating ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghostButton"
                onClick={() =>
                  navigate({ pathname: "/master/items", search: location.search })
                }
                disabled={isBusy}
              >
                목록
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => setIsEditing(true)}
                disabled={isBusy}
              >
                수정
              </button>
            </>
          )
        }
      >
        {/* 공정 라우팅 영역 */}
        {(isRoutingRequired || (routings && routings.length > 0)) && (
          <div className="routingSection">
            <div className="routing-header-wrapper">
              <label className="requiredLabel routing-header-label">
                공정 라우팅 설정{" "}
                {isRoutingRequired && isEditing && <span className="required">*</span>}
              </label>
              <div className="routing-header-right">
                <span className="routing-count-text">총 {routings.length}단계</span>
                {isEditing && (
                  <button
                    type="button"
                    className="miniButton primary"
                    disabled={isBusy}
                    onClick={handleOpenModal}
                  >
                    + 공정 선택 / 추가
                  </button>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="routing-guide-text">
                ⠿ 드래그로 순서 변경, 항목 선택 시 우측에서 상세 편집
              </div>
            )}

            {routings.length === 0 ? (
              <div className="routingEmptyBox">
                {isEditing
                  ? "선택된 공정이 없습니다. [+ 공정 선택 / 추가] 버튼을 눌러주세요."
                  : "등록된 공정 라우팅이 없습니다."}
              </div>
            ) : isEditing ? (
              /* ===== 수정 모드: 등록 페이지와 동일한 2단 레이아웃 ===== */
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
                        ref={(el) => {
                          routingItemRefs.current[index] = el;
                        }}
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
                        className={`routing-list-item ${isSelected ? "is-selected" : ""} ${
                          isDragOver ? "is-drag-over" : ""
                        } ${isDragged ? "is-dragged" : ""}`}
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
                              disabled={index === 0 || isBusy}
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
                              disabled={index === routings.length - 1 || isBusy}
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
                      <div className="routing-step-card">
                        <div className="routing-step-badge">
                          <div className="routing-step-badge-title">STEP</div>
                          <div className="routing-step-badge-num">
                            {String(selectedIndex + 1).padStart(2, "0")}
                          </div>
                        </div>
                        <div>
                          <div className="routing-step-info-nm">
                            {selectedMatchedOp ? selectedMatchedOp.operNm : selectedRouting.operCode}
                          </div>
                          <div className="routing-step-info-code">{selectedRouting.operCode}</div>
                        </div>
                      </div>

                      <div className="routing-move-grid">
                        <button
                          type="button"
                          className="routing-move-btn"
                          disabled={selectedIndex === 0 || isBusy}
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
                          disabled={selectedIndex === routings.length - 1 || isBusy}
                          onClick={() => {
                            moveRouting(selectedIndex, selectedIndex + 1);
                            setSelectedIndex(selectedIndex + 1);
                          }}
                        >
                          <ChevronDownIcon className="routing-arrow-icon" aria-hidden="true" />
                          뒤로
                        </button>
                      </div>

                      <div className="routing-form-group">
                        <label className="routing-label">공정명</label>
                        <input
                          type="text"
                          className="tableInput routing-input-readonly"
                          value={selectedMatchedOp ? selectedMatchedOp.operNm : ""}
                          disabled
                        />
                      </div>

                      <div className="routing-form-group last">
                        <label className="routing-label">공정구분</label>
                        <select
                          className="tableInput routing-select"
                          value={selectedRouting.finalYn ?? "N"}
                          disabled={isBusy}
                          onChange={(e) =>
                            handleRoutingChange(selectedIndex, "finalYn", e.target.value)
                          }
                        >
                          <option value="N">일반공정</option>
                          <option value="Y">최종공정</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        className="routing-delete-btn"
                        disabled={isBusy}
                        onClick={() => {
                          handleRemoveRouting(selectedIndex);
                          setSelectedIndex(null);
                        }}
                      >
                        이 공정 제외
                      </button>
                    </div>
                  ) : (
                    <div className="routing-empty-panel">좌측에서 공정을 선택해주세요.</div>
                  )}
                </div>
              </div>
            ) : (
              /* ===== 읽기 모드: 좌측 리스트만 전체 폭으로 표시 ===== */
              <div className="routing-list-container">
                {routings.map((route, index) => {
                  const matchedOp = operations.find((op) => op.operCode === route.operCode);
                  const isFinal = route.finalYn === "Y";

                  return (
                    <div key={`${route.operCode}-${index}`} className="routing-list-item">
                      <div className="routing-item-left">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DetailLayout>

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
