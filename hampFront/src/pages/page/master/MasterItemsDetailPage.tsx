import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { Badge } from "@components/common/Badge";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  type ItemDetailResponse,
  type ApiResponseItemDetailResponse,
  type ItemUpdateRequest,
  type ProductType,
  type ItemCategory,
  type ItemRoutingRequest,
} from "@/api/master/Item";
import Spinner from "@/components/common/Spinner";
import { OperationSelectModal } from "@/components/common/OperationSelectModal"; 
import { useItemRoutings } from "@/hooks/useItemRoutings";
import './MasterItem.css';

type Field = {
  label: string;
  key: string;
  editable?: boolean;
  type?: "select" | "input";
  options?: { label: string; value: string }[];
};

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

  // 공정 라우팅 DOM 포커스 관리를 위한 ref 배열
  const routingItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 커스텀 훅 연동
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
  } = useItemRoutings();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearchKeyword, setModalSearchKeyword] = useState("");
  const [tempSelectedCodes, setTempSelectedCodes] = useState<string[]>([]);

  const isBusy = isUpdating || isDeleting;

  const fields: Field[] = [
    { label: "품목코드", key: "itemCode", editable: false },
    {
      label: "종류",
      key: "productType",
      type: "select",
      options: [
        { label: PRODUCT_TYPE_LABEL[0], value: "0" },
        { label: PRODUCT_TYPE_LABEL[1], value: "1" },
      ],
    },
    {
      label: "품목구분",
      key: "category",
      type: "select",
      options: [
        { label: CATEGORY_LABEL[0], value: "0" },
        { label: CATEGORY_LABEL[1], value: "1" },
        { label: CATEGORY_LABEL[2], value: "2" },
      ],
    },
    { label: "품목명", key: "itemNm" },
    { label: "단위", key: "unit" },
    { label: "규격", key: "standard" },
    { label: "사용여부", key: "useYn", editable: false },
    { label: "등록일자", key: "createdAt", editable: false },
  ];

  useEffect(() => {
    const fetchOperations = async () => {
      try {
        const response = await apiClient.get("/operations/options");
        const data = response.data?.data || response.data || [];
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
        const encodedItemCode = encodeURIComponent(itemCode);
        const response = await apiClient.get<ApiResponseItemDetailResponse>(
          `/items/${encodedItemCode}`
        );
        const itemData = response.data.data;

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
            syncRoutings(formattedRoutings.map(r => r.operCode).filter(Boolean) as string[]);
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

  const handleFieldChange = (key: string, value: string) => {
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

      const encodedItemCode = encodeURIComponent(item.itemCode);
      const response = await apiClient.put(
        `/items/${encodedItemCode}`,
        updatePayload
      );

      alert(response.data?.message || "수정되었습니다.");

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
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.message
        : null;
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
      const encodedItemCode = encodeURIComponent(item.itemCode);
      await apiClient.delete(`/items/${encodedItemCode}`);
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
        <Panel title="품목 상세 정보">
          <div> <Spinner /> </div>
        </Panel>
      </section>
    );
  }

  if (!item) return null;

  const currentCategory = isEditing ? form.category : item.category?.toString();
  const isRoutingRequired = currentCategory === "1" || currentCategory === "2";

  return (
    <section className="screenStack">
      <Panel title={isEditing ? "품목 정보 수정" : "품목 상세 정보"}>
        <form
          className="pageForm"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          {fields.map(({ label, key, editable, type, options }) => {
            const isFieldEditable = isEditing && editable !== false;

            return (
              <div key={key} className="detailField">
                <label>{label}</label>

                {isFieldEditable ? (
                  type === "select" ? (
                    <select
                      className="tableInput"
                      value={form[key] ?? ""}
                      disabled={isBusy}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                    >
                      <option value="">선택</option>
                      {options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="tableInput"
                      value={form[key] ?? ""}
                      disabled={isBusy}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                    />
                  )
                ) : (
                  <div className="detailValue">
                    {key === "productType" ? (
                      PRODUCT_TYPE_LABEL[item.productType as ProductType] ?? "-"
                    ) : key === "category" ? (
                      CATEGORY_LABEL[item.category as ItemCategory] ?? "-"
                    ) : key === "useYn" ? (
                      <Badge tone={item.useYn === "Y" ? "good" : "muted"}>
                        {item.useYn === "Y" ? "사용" : "미사용"}
                      </Badge>
                    ) : (
                      form[key] || "-"
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {(isRoutingRequired || (routings && routings.length > 0)) && (
            <div className="routingSection">
              <div className="routingHeader">
                <label className="requiredLabel" style={{ fontWeight: 600 }}>
                  공정 라우팅 설정{" "}
                  {isRoutingRequired && <span className="required">*</span>}
                </label>
                {isEditing && (
                  <button
                    type="button"
                    className="miniButton primary"
                    disabled={isBusy}
                    onClick={handleOpenModal}
                  >
                    공정 선택 / 추가
                  </button>
                )}
              </div>

              {isEditing && routings.length > 0 && (
                <div className="routingHint">
                  💡 <kbd>마우스</kbd>로 공정 카드를 선택하거나 드래그 하세요.
                  <kbd>방향키</kbd>로 공정 카드를 탐색하고, <kbd>Space</kbd>/<kbd>Enter</kbd>로 선택(잡기) 후 이동하세요. (<kbd>Esc</kbd> 취소)
                </div>
              )}

              {routings.length === 0 ? (
                <div className="routingEmptyBox">
                  등록된 공정 라우팅이 없습니다.
                </div>
              ) : (
                <div 
                  className="routingGrid" 
                  onMouseUp={handleMouseUp} 
                  onMouseLeave={handleMouseUp}
                >
                  {routings.map((route, index) => {
                    const matchedOp = operations.find(
                      (op) => op.operCode === route.operCode
                    );
                    const isDragging = draggingIndex === index;
                    const isTarget = targetIndex === index && draggingIndex !== index;
                    const isKeyboardActive = keyboardActiveIndex === index;

                    return (
                      <div
                        key={route.operCode || index}
                        ref={(el) => {
                          routingItemRefs.current[index] = el;
                        }}
                        // 수정 모드일 때만 0, 읽기 전용일 때는 tabIndex 자체를 없애서(undefined) 포커스 원천 차단
                        tabIndex={isEditing && !isBusy ? 0 : undefined}
                        role={isEditing ? "button" : undefined}
                        aria-pressed={isEditing ? isKeyboardActive : undefined}
                        className={`routingItem 
                          ${isDragging ? "dragging" : ""} 
                          ${isTarget ? "dragTarget" : ""}
                          ${isKeyboardActive ? "keyboardActive" : ""}
                        `}
                        onMouseDown={() => isEditing && !isBusy && handleMouseDown(index)}
                        onMouseEnter={() => isEditing && !isBusy && handleMouseEnter(index)}
                        onKeyDown={(e) => {
                          if (!isEditing || isBusy) return;

                          // 1. 방향키 단독 입력 시 2D 그리드 포커스 이동 (상, 하, 좌, 우)
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
                              routingItemRefs.current[nextIndex]?.focus();
                            }
                            return;
                          }

                          // 2. Space/Enter 잡기·놓기 및 잡은 상태에서의 방향키 순서 변경 처리
                          const nextIndex = handleKeyDown(e, index, 2);
                          if (nextIndex !== undefined) {
                             setTimeout(() => routingItemRefs.current[nextIndex]?.focus(), 0);
                          }
                        }}
                      >
                        {isEditing && (
                          <span className="dragHandle" title="Space/Enter로 잡고 방향키로 이동">
                            ☰
                          </span>
                        )}

                        <span className="routingSeq">
                          순서 {route.operSeq ?? index + 1}
                        </span>

                        <div className="routingInfo">
                          {route.operCode} {matchedOp ? `(${matchedOp.operNm})` : ""}
                        </div>

                        {isEditing ? (
                          <select
                            className="tableInput routingSelect"
                            value={route.finalYn ?? "N"}
                            disabled={isBusy}
                            tabIndex={-1}
                            onChange={(e) =>
                              handleRoutingChange(index, "finalYn", e.target.value)
                            }
                          >
                            <option value="N">일반공정</option>
                            <option value="Y">최종공정</option>
                          </select>
                        ) : (
                          <div className="flex items-center justify-center w-full h-full text-xs">
                            <Badge tone={route.finalYn === "Y" ? "good" : "muted"}>
                              {route.finalYn === "Y" ? "최종공정" : "일반공정"}
                            </Badge>
                          </div>
                        )}

                        {isEditing && (
                          <button
                            type="button"
                            className="miniButton danger"
                            disabled={isBusy}
                            tabIndex={-1}
                            onClick={() => handleRemoveRouting(index)}
                          >
                            제외
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="pageFormFooterSpaceBetween" style={{ gridColumn: "1 / -1", marginTop: "16px" }}>
            <div>
              {isEditing && item.useYn === 'Y' && (
                <button
                  type="button"
                  className="dangerButton text-sm text-red-500 hover:underline px-2 py-1"
                  onClick={handleDelete}
                  disabled={isBusy}
                >
                  {isDeleting ? "삭제 처리 중..." : "품목 삭제"}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {isEditing ? (
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
                      navigate({
                        pathname: "/master/items",
                        search: location.search,
                      })
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
              )}
            </div>
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