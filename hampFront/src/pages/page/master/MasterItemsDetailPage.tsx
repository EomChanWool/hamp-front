import { useEffect, useState, useMemo, useRef } from "react";
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
} from "@/types/master/Item";
import Spinner from "@/components/common/Spinner";

type Field = {
  label: string;
  key: string;
  editable?: boolean;
  type?: "select" | "input";
  options?: { label: string; value: string }[];
};

// 공정 옵션 타입 정의
interface OperationOption {
  operCode: string;
  operNm: string;
}

export function MasterItemsDetailPage() {
  const { itemCode } = useParams<{ itemCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [item, setItem] = useState<ItemDetailResponse | null>(null);
  const [operations, setOperations] = useState<OperationOption[]>([]); // 공정 셀렉트 옵션 목록
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  
  // 라우팅 목록 상태
  const [routings, setRoutings] = useState<ItemRoutingRequest[]>([]);

  // 드래그 앤 드롭을 위한 상태 관리 훅
  const draggedItemIndex = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // 다중 선택 팝업 모달 관련 상태
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
    { label: "생성일시", key: "createdAt", editable: false },
    { label: "수정일시", key: "updatedAt", editable: false },
  ];

  // 공정 셀렉트 옵션 목록 페칭
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

  // 상세 데이터 조회
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
            updatedAt: formatDateTime(itemData.updatedAt),
          });

          if (itemData.routings && Array.isArray(itemData.routings)) {
            setRoutings(
              itemData.routings.map((r, idx) => ({
                operCode: r.operCode || "",
                operSeq: r.operSeq ?? idx + 1,
                finalYn: r.finalYn || "N",
              }))
            );
          } else {
            setRoutings([]);
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

  // 수정 모드 취소 시 롤백
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
        updatedAt: formatDateTime(item.updatedAt),
      });

      if (item.routings && Array.isArray(item.routings)) {
        setRoutings(
          item.routings.map((r, idx) => ({
            operCode: r.operCode || "",
            operSeq: r.operSeq ?? idx + 1,
            finalYn: r.finalYn || "N",
          }))
        );
      } else {
        setRoutings([]);
      }
    }
  }, [isEditing, item]);

  // 품목구분 변경 시 원료('0')면 라우팅 초기화
  const handleFieldChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "category" && value === "0") {
      setRoutings([]);
    }
  };

  const handleRemoveRouting = (index: number) => {
    setRoutings((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, operSeq: i + 1 }))
    );
  };

  const handleRoutingChange = (
    index: number,
    field: keyof ItemRoutingRequest,
    value: unknown
  ) => {
    setRoutings((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // --- 드래그 앤 드롭 핸들러들  ---
  const handleDragStart = (index: number) => {
    draggedItemIndex.current = index;
    setDraggingIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    const sourceIndex = draggedItemIndex.current;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    setRoutings((prev) => {
      const newRoutings = [...prev];
      const [movedItem] = newRoutings.splice(sourceIndex, 1);
      newRoutings.splice(targetIndex, 0, movedItem);

      return newRoutings.map((item, i) => ({ ...item, operSeq: i + 1 }));
    });

    draggedItemIndex.current = null;
    setDraggingIndex(null);
  };

  const handleDragEnd = () => {
    draggedItemIndex.current = null;
    setDraggingIndex(null);
  };

  // --- 팝업 모달 관련 핸들러 ---
  const handleOpenModal = () => {
    setModalSearchKeyword("");
    const currentCodes = routings.map((r) => r.operCode).filter(Boolean) as string[];
    setTempSelectedCodes(currentCodes);
    setIsModalOpen(true);
  };

  const handleToggleCheckbox = (operCode: string) => {
    setTempSelectedCodes((prev) =>
      prev.includes(operCode)
        ? prev.filter((code) => code !== operCode)
        : [...prev, operCode]
    );
  };

  const filteredOperations = useMemo(() => {
    if (!modalSearchKeyword.trim()) return operations;
    const keyword = modalSearchKeyword.toLowerCase();
    return operations.filter(
      (op) =>
        op.operCode.toLowerCase().includes(keyword) ||
        op.operNm.toLowerCase().includes(keyword)
    );
  }, [operations, modalSearchKeyword]);

  const handleToggleSelectAll = () => {
    const filteredCodes = filteredOperations.map((op) => op.operCode);
    const isAllCurrentlySelected = filteredCodes.every((code) =>
      tempSelectedCodes.includes(code)
    );

    if (isAllCurrentlySelected) {
      setTempSelectedCodes((prev) =>
        prev.filter((code) => !filteredCodes.includes(code))
      );
    } else {
      setTempSelectedCodes((prev) => {
        const merged = new Set([...prev, ...filteredCodes]);
        return Array.from(merged);
      });
    }
  };

  const handleConfirmModal = () => {
    setRoutings((prev) => {
      const existingMap = new Map(prev.map((r) => [r.operCode, r]));

      const newRoutings: ItemRoutingRequest[] = tempSelectedCodes.map((code) => {
        const existing = existingMap.get(code);
        return {
          operCode: code,
          operSeq: 0,
          finalYn: existing ? existing.finalYn : "N",
        };
      });

      return newRoutings.map((item, idx) => ({ ...item, operSeq: idx + 1 }));
    });

    setIsModalOpen(false);
  };

  const isAllFilteredSelected =
    filteredOperations.length > 0 &&
    filteredOperations.every((op) => tempSelectedCodes.includes(op.operCode));

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
                operSeq: r.operSeq,
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
           <div> <Spinner/> </div>
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
          {/* 상단 기본 필드들 */}
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

          {/* 공정 라우팅 정보 */}
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

              {routings.length === 0 ? (
                <div className="routingEmptyBox">
                  등록된 공정 라우팅이 없습니다.
                </div>
              ) : (
                <div className="routingGrid">
                  {routings.map((route, index) => {
                    const matchedOp = operations.find(
                      (op) => op.operCode === route.operCode
                    );
                    const isDragging = draggingIndex === index;

                    return (
                      <div
                        key={route.operCode || index}
                        className={`routingItem ${isDragging ? "dragging" : ""}`}
                        draggable={isEditing && !isBusy}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(index)}
                        onDragEnd={handleDragEnd}
                      >
                        {isEditing && (
                          <span className="dragHandle" title="드래그하여 순서 변경">
                            ☰
                          </span>
                        )}

                        <span className="routingSeq">
                          순서 {route.operSeq}
                        </span>

                        <div className="routingInfo">
                          {route.operCode} {matchedOp ? `(${matchedOp.operNm})` : ""}
                        </div>

                        {isEditing ? (
                          <select
                            className="tableInput routingSelect"
                            value={route.finalYn ?? "N"}
                            disabled={isBusy}
                            onChange={(e) =>
                              handleRoutingChange(index, "finalYn", e.target.value)
                            }
                          >
                            <option value="N">일반공정</option>
                            <option value="Y">최종공정</option>
                          </select>
                        ) : (
                          <div className="tableInput routingSelect flex items-center justify-center text-xs">
                            {route.finalYn === "Y" ? "최종공정" : "일반공정"}
                          </div>
                        )}

                        {isEditing && (
                          <button
                            type="button"
                            className="miniButton danger"
                            disabled={isBusy}
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

          {/* 하단 액션 버튼 영역 */}
          <div className="pageFormFooterSpaceBetween" style={{ gridColumn: "1 / -1", marginTop: "16px" }}>
            <div>
              {isEditing && (
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

      {/* 공정 다중 선택 팝업 모달 */}
      {isModalOpen && (
        <div className="modalOverlay">
          <div className="detailModal">
            <div className="detailModalHeader">
              <div>
                <h3>공정 선택</h3>
                <span>품목에 추가할 공정 라우팅을 선택하세요.</span>
              </div>
              <button
                type="button"
                className="detailModalClose"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="detailModalBody modalBodyFlex">
              <div>
                <input
                  type="text"
                  className="tableInput modalSearchInput"
                  placeholder="공정 코드 또는 공정명 검색..."
                  value={modalSearchKeyword}
                  onChange={(e) => setModalSearchKeyword(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="modalSelectAllRow">
                <div className="modalCountText">
                  선택된 공정 수: <strong>{tempSelectedCodes.length}</strong>개
                </div>
                <button
                  type="button"
                  className="miniButton ghostButton"
                  onClick={handleToggleSelectAll}
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                >
                  {isAllFilteredSelected ? "전체 해제" : "전체 선택"}
                </button>
              </div>

              <div className="modalListContainer">
                {filteredOperations.length === 0 ? (
                  <div className="modalEmptyText">
                    검색된 공정이 없습니다.
                  </div>
                ) : (
                  filteredOperations.map((op) => {
                    const isChecked = tempSelectedCodes.includes(op.operCode);
                    return (
                      <div
                        key={op.operCode}
                        onClick={() => handleToggleCheckbox(op.operCode)}
                        className={`modalListItem ${isChecked ? "modalListItemChecked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ cursor: "pointer" }}
                        />
                        <div className="modalListItemContent">
                          <span className="modalListItemTitle">
                            {op.operNm}
                          </span>
                          <span className="modalListItemCode">
                            {op.operCode}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="detailModalFooter">
              <button
                type="button"
                className="ghostButton"
                onClick={() => setIsModalOpen(false)}
              >
                취소
              </button>
              <div className="detailModalFooterRight">
                <button
                  type="button"
                  className="primaryButton"
                  onClick={handleConfirmModal}
                >
                  선택 완료 ({tempSelectedCodes.length}개 적용)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}