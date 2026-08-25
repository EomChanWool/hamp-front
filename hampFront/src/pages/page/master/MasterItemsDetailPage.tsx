import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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

  // 1열 공정 라우팅 DOM 포커스 관리를 위한 ref 배열
  const routingItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 커스텀 훅 연동
  const {
    routings,
    keyboardActiveIndex,
    syncRoutings,
    removeRouting: handleRemoveRouting,
    updateRouting: handleRoutingChange,
    moveRouting,
    handleKeyDown,
  } = useItemRoutings();

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

  return (
    <section className="screenStack">
      <DetailLayout
        title={item.itemNm}
        subtitle={
          <div className="subtitleWrapper">
            <Badge tone="muted">{form.itemCode}</Badge>
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
            <div className="routingHeader">
              <label className="requiredLabel">
                공정 라우팅 설정{" "}
                {isRoutingRequired && <span className="required">*</span>}
              </label>
              <div className="routingHeaderRight">
                <span className="routingCount">총 {routings.length}단계</span>
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
            </div>

            {isEditing && routings.length > 0 && (
              <div className="routingHint">
                💡 <kbd>상하 방향키</kbd>로 공정 카드를 탐색하고, <kbd>Space</kbd>/<kbd>Enter</kbd>로 선택 후 상하 방향키로 순서를 이동하세요. (<kbd>Esc</kbd> 취소)
              </div>
            )}

            {routings.length === 0 ? (
              <div className="routingEmptyBox">
                등록된 공정 라우팅이 없습니다.
              </div>
            ) : (
              <div className="routingList">
                {routings.map((route, index) => {
                  const matchedOp = operations.find((op) => op.operCode === route.operCode);
                  const isKeyboardActive = keyboardActiveIndex === index;
                  const isFinal = route.finalYn === "Y";

                  return (
                    <div
                      key={route.operCode || index}
                      ref={(el) => {
                        routingItemRefs.current[index] = el;
                      }}
                      tabIndex={isEditing && !isBusy ? 0 : undefined}
                      role={isEditing ? "button" : undefined}
                      aria-pressed={isEditing ? isKeyboardActive : undefined}
                      className={`routingItem ${isKeyboardActive ? "keyboardActive" : ""}`}
                      // 💡 마우스 클릭 시 즉시 해당 항목으로 포커스를 이동시켜 방향키 입력 보장
                      onMouseDown={() => {
                        if (isEditing && !isBusy) {
                          routingItemRefs.current[index]?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!isEditing || isBusy) return;

                        // 💡 활성화(keyboardActiveIndex)가 안 된 상태에서 상하 방향키 입력 시 스크롤바 이동 방지 및 포커스 이동 처리
                        if (keyboardActiveIndex === null) {
                          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                            e.preventDefault();
                            let nextIndex = index;
                            if (e.key === "ArrowUp") nextIndex = index - 1;
                            if (e.key === "ArrowDown") nextIndex = index + 1;

                            if (nextIndex >= 0 && nextIndex < routings.length) {
                              routingItemRefs.current[nextIndex]?.focus();
                            }
                            return;
                          }
                        }

                        // Enter/Space 이거나 활성화된 상태에서의 키다운 처리 위임
                        const nextIndex = handleKeyDown(e, index);
                        if (nextIndex !== undefined && nextIndex !== index) {
                          setTimeout(() => routingItemRefs.current[nextIndex]?.focus(), 0);
                        }
                      }}
                    >
                      {/* STEP 원형 뱃지 및 순서 변경 드롭다운 오버레이 영역 */}
                      <div className="routingStepWrapper">
                        <div className="routingStepContainer">
                          <div className={`routingStepBadge ${isFinal ? "final" : ""}`}>
                            <span className="stepText">STEP</span>
                            <span className="stepNum">{String(route.operSeq ?? index + 1).padStart(2, "0")}</span>
                          </div>

                          {isEditing && (
                            <select
                              className="routingStepOverlaySelect"
                              value={route.operSeq ?? index + 1}
                              disabled={isBusy}
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
                          )}
                        </div>
                      </div>

                      {/* 공정 코드 및 명칭 */}
                      <div className="routingInfoWrapper">
                        <span className="routingCode">{route.operCode}</span>
                        <span className="routingName">
                          {matchedOp ? matchedOp.operNm : ""}
                        </span>
                      </div>

                      {/* 최종공정 여부 뱃지 또는 셀렉트 */}
                      <div>
                        {isEditing ? (
                          <select
                            className="tableInput routingSelect"
                            value={route.finalYn ?? "N"}
                            disabled={isBusy}
                            tabIndex={-1}
                            onChange={(e) => handleRoutingChange(index, "finalYn", e.target.value)}
                          >
                            <option value="N">일반공정</option>
                            <option value="Y">최종공정</option>
                          </select>
                        ) : (
                          <Badge tone={isFinal ? "good" : "muted"}>
                            {isFinal ? "최종공정" : "일반공정"}
                          </Badge>
                        )}
                      </div>

                      {/* 제외 버튼 */}
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