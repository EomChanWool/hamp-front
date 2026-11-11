import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { Badge } from "@components/common/Badge";
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  SOLE_PRODUCTION_LABEL,
  ItemApi,
  type ItemDetailResponse,
  type ItemUpdateRequest,
  type ProductType,
  type ItemCategory,
  type SoleProductionYn,
} from "@/api/master/Item";
import { OperationApi } from "@/api/master/Operation";
import Spinner from "@/components/common/Spinner";
import { OperationSelectModal } from "@/components/modal/OperationSelectModal";
import { useItemRoutings } from "@/hooks/useItemRoutings";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";
import {
  RoutingMaterialSection,
  toMaterialRequests,
} from "@/components/common/RoutingMatarialSection";
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
    loadRoutings,
    clearRoutings,
    syncRoutings,
    removeRouting,
    moveRouting,
    setStepMaterials,
  } = useItemRoutings();

  // 라우팅 UI(드래그/선택/상세패널) 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const routingItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearchKeyword, setModalSearchKeyword] = useState("");
  // [중복 공정 지원] 중복을 허용하는 공정코드 배열 (같은 공정 = 여러 번 포함)
  const [tempSelectedCodes, setTempSelectedCodes] = useState<string[]>([]);

  const isBusy = isUpdating || isDeleting;

  const handleFieldChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    // 원료(0)만 공정 라우팅(+ 자재)을 사용하지 않음
    if (key === "category" && value === "0") {
      clearRoutings(); // 단계와 자재가 한 객체라 한 번에 초기화됨
      setSelectedIndex(null);
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
              <option value="0">{CATEGORY_LABEL[0]}</option>
              <option value="1">{CATEGORY_LABEL[1]}</option>
              <option value="2">{CATEGORY_LABEL[2]}</option>
            </select>
          ),
          renderValue: () =>
            item ? CATEGORY_LABEL[item.category as ItemCategory] ?? "-" : "-",
        },
        // 단독생산 전용 여부 (1이면 수주 산출라인에서 다른 품목과 조합 불가)
        {
          label: "단독생산 전용",
          key: "soleProductionYn",
          editable: true,
          renderEditor: (value, _onChange, disabled) => (
            <select
              className="tableInput"
              value={value}
              disabled={disabled}
              title="예: 수주 산출라인에서 다른 품목과 조합 불가"
              onChange={(e) => handleFieldChange("soleProductionYn", e.target.value)}
            >
              <option value="0">{SOLE_PRODUCTION_LABEL[0]}</option>
              <option value="1">{SOLE_PRODUCTION_LABEL[1]}</option>
            </select>
          ),
          renderValue: () =>
            item
              ? SOLE_PRODUCTION_LABEL[item.soleProductionYn as SoleProductionYn] ?? "-"
              : "-",
        },
      ],
    },
  ];

  // 공정 옵션 목록 조회
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

  // 품목 상세 조회
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
            // 단독생산 전용 여부 (값이 없으면 0)
            soleProductionYn: itemData.soleProductionYn?.toString() ?? "0",
            useYn: itemData.useYn || "",
            createdAt: formatDateTime(itemData.createdAt),
          });

          loadRoutings(itemData.routings);
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

  // 수정 취소 시(또는 저장 후) 서버 기준 값으로 폼/라우팅/자재 복원
  useEffect(() => {
    if (item && !isEditing) {
      setForm({
        itemCode: item.itemCode,
        productType: item.productType?.toString() ?? "",
        category: item.category?.toString() ?? "",
        itemNm: item.itemNm || "",
        unit: item.unit || "",
        standard: item.standard || "",
        // 단독생산 전용 여부 복원
        soleProductionYn: item.soleProductionYn?.toString() ?? "0",
        useYn: item.useYn || "",
        createdAt: formatDateTime(item.createdAt),
      });

      // [중복 공정 지원] 단계 + 단계별 자재를 서버 기준으로 한 번에 복원
      loadRoutings(item.routings);
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

  /**
   * 공정 순서 이동 (드래그 / 화살표 / 앞으로·뒤로 버튼 공통). 실제로 이동했으면 true
   */
  const handleMoveRouting = (from: number, to: number): boolean => moveRouting(from, to);

  /** "이 공정 제외" : 해당 "단계"만 제거 (같은 공정의 다른 단계는 유지). 확인창 취소 시 아무 변화 없음 */
  const handleRemoveSelectedRouting = (index: number) => {
    if (!removeRouting(index)) return;
    setSelectedIndex(null);
  };

  const handleOpenModal = () => {
    setModalSearchKeyword("");
    setTempSelectedCodes(routings.map((r) => r.operCode));
    setIsModalOpen(true);
  };

  const handleConfirmModal = () => {
    if (!syncRoutings(tempSelectedCodes)) return;
    setIsModalOpen(false);
  };

  const validateForm = (): boolean => {
    const selectedCategory =
      form.category !== "" ? (Number(form.category) as ItemCategory) : null;

    // 완제품(2)만 공정 라우팅 필수 / 반제품(1)은 선택 / 원료(0)는 사용 불가
    //    ※ 공정별 자재 IN/OUT 최소 건수 및 "라우팅 전체 투입자재 1건 이상" 검증은 백엔드에서 처리
    if (selectedCategory === 2 && routings.length === 0) {
      alert("완제품은 공정 라우팅을 최소 1개 이상 설정해야 합니다.");
      return false;
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

      // 반제품(1)·완제품(2)만 라우팅 전송 가능 (원료(0)는 null)
      const isRoutingAllowedOnSave = selectedCategory === 1 || selectedCategory === 2;

      const updatePayload: ItemUpdateRequest = {
        productType:
          form.productType !== "" && form.productType != null
            ? (Number(form.productType) as ProductType)
            : null,
        category: selectedCategory,
        itemNm: form.itemNm?.trim() ? form.itemNm.trim() : null,
        unit: form.unit?.trim() ? form.unit.trim() : null,
        standard: form.standard?.trim() ? form.standard.trim() : null,
        // 단독생산 전용 여부 (0/1)
        soleProductionYn: (Number(form.soleProductionYn) === 1 ? 1 : 0) as SoleProductionYn,
        // 완제품만 → 반제품·완제품. 반제품은 공정이 0건이면 빈 배열 전송
        routings: isRoutingAllowedOnSave
          ? routings.map((r) => ({
            operCode: r.operCode?.trim() || null,
            operSeq: r.operSeq ?? 1,
            finalYn: r.finalYn || "N",
            // [중복 공정 지원] operCode 로 맵을 조회하지 않고 "그 단계 자신의" 자재를 전송
            materials: toMaterialRequests(r.materials),
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
            // 단독생산 전용 여부 반영
            soleProductionYn: updatePayload.soleProductionYn ?? prev.soleProductionYn,
            routings: updatePayload.routings
              ? routings.map((r) => ({
                routingId: 0,
                itemCode: prev.itemCode,
                operCode: r.operCode,
                operSeq: r.operSeq,
                finalYn: r.finalYn,
                // [중복 공정 지원] 저장한 "단계별" 자재를 상세 데이터에도 반영 (취소/읽기 모드 복원 시 사용)
                materials: r.materials.map((m) => ({
                  routingMtrlId: 0,
                  itemCode: m.itemCode,
                  itemNm: m.itemNm,
                  unit: m.unit,
                  ioType: m.ioType,
                  // 계획 수율(%) - OUT 자재만 값이 있을 수 있음, 미확정이면 null
                  yieldRate: m.yieldRate ?? null,
                })),
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
  // 완제품(2): 라우팅 필수
  const isRoutingRequired = currentCategory === "2";
  // 반제품(1)·완제품(2): 라우팅 사용 가능 / 원료(0): 사용 불가
  const isRoutingAllowed = currentCategory === "1" || currentCategory === "2";
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
        {/* 원료는 숨김 / 완제품은 항상 표시 / 반제품은 수정 모드이거나 등록된 공정이 있을 때 표시 */}
        {isRoutingAllowed && (isRoutingRequired || isEditing || (routings && routings.length > 0)) && (
          <div className="routingSection">
            <div className="routing-header-wrapper">
              <label className="requiredLabel routing-header-label">
                공정 라우팅 설정{" "}
                {isRoutingRequired && isEditing && <span className="required">*</span>}
                {/* 반제품은 선택 입력 */}
                {!isRoutingRequired && isEditing && (
                  <span style={{ marginLeft: 4, fontWeight: 400, opacity: 0.6 }}>(선택)</span>
                )}
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
                (마지막 공정이 최종공정이며, 최종공정이 바뀌면 해당 공정의 투입/산출 자재는 초기화됩니다.
                같은 공정을 여러 단계로 추가할 수 있으며 자재는 단계별로 따로 관리됩니다)
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
                        // [중복 공정 지원] 같은 공정이 반복돼도 유일한 단계 고유키 사용
                        key={route.rowKey}
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
                          // 확인창에서 취소하면 이동/선택 변경 없음
                          if (draggedIndex !== null && handleMoveRouting(draggedIndex, index)) {
                            setSelectedIndex(index);
                          }
                          setDraggedIndex(null);
                          setDragOverIndex(null);
                        }}
                        onClick={() => setSelectedIndex(index)}
                        className={`routing-list-item ${isSelected ? "is-selected" : ""} ${isDragOver ? "is-drag-over" : ""
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
                          <span className="routing-code-wrap">
                            <Badge tone="info">{route.operCode}</Badge>
                          </span>
                          <span
                            className="routing-oper-nm"
                            title={matchedOp ? matchedOp.operNm : ""}
                          >
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
                                if (handleMoveRouting(index, index - 1)) {
                                  setSelectedIndex(index - 1);
                                }
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
                                if (handleMoveRouting(index, index + 1)) {
                                  setSelectedIndex(index + 1);
                                }
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

                      {/* 앞으로 / 뒤로 빠른 이동 */}
                      <div className="routing-move-grid">
                        <button
                          type="button"
                          className="routing-move-btn"
                          disabled={selectedIndex === 0 || isBusy}
                          onClick={() => {
                            if (handleMoveRouting(selectedIndex, selectedIndex - 1)) {
                              setSelectedIndex(selectedIndex - 1);
                            }
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
                            if (handleMoveRouting(selectedIndex, selectedIndex + 1)) {
                              setSelectedIndex(selectedIndex + 1);
                            }
                          }}
                        >
                          <ChevronDownIcon className="routing-arrow-icon" aria-hidden="true" />
                          뒤로
                        </button>
                      </div>

                      {/* 공정명 / 공정구분 → 한 줄(2열) 배치 */}
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
                          {/* 최종공정은 훅에서 "마지막 공정"으로 자동 지정되므로 직접 변경 불가(읽기 전용) */}
                          <select
                            className="tableInput routing-select"
                            value={selectedRouting.finalYn ?? "N"}
                            disabled
                            title="마지막 공정이 자동으로 최종공정이 됩니다"
                          >
                            <option value="N">일반공정</option>
                            <option value="Y">최종공정</option>
                          </select>
                          <div className="routing-guide-text">마지막 공정이 자동으로 최종공정입니다</div>
                        </div>
                      </div>

                      {/* 이 "단계"의 투입(IN) / 산출(OUT) 자재 (+ 산출 자재 수율) */}
                      {/* [중복 공정 지원] resetKey / materials / onChange 모두 operCode 가 아닌 단계(rowKey) 기준 */}
                      <RoutingMaterialSection
                        resetKey={selectedRouting.rowKey}
                        materials={selectedRouting.materials}
                        onChange={(next) => setStepMaterials(selectedRouting.rowKey, next)}
                        excludeItemCode={item.itemCode}
                        productType={item.productType}
                        finalYn={selectedRouting?.finalYn ?? "N"}
                        currentItem={{
                          itemCode: item.itemCode,
                          itemNm: form.itemNm?.trim() || item.itemNm || "",
                          unit: form.unit?.trim() || item.unit || "",
                        }}
                        disabled={isBusy}
                      />

                      <button
                        type="button"
                        className="routing-delete-btn"
                        disabled={isBusy}
                        onClick={() => handleRemoveSelectedRouting(selectedIndex)}
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
                  // 읽기 모드에서도 공정별 투입/산출 자재를 요약 표시
                  // [중복 공정 지원] operCode 맵 조회 대신 "이 단계"의 자재를 표시 (이송 단계마다 다르게 보임)
                  const mats = route.materials;
                  const inMats = mats.filter((m) => m.ioType === "IN");
                  const outMats = mats.filter((m) => m.ioType === "OUT");

                  return (
                    <div key={route.rowKey} className="routing-list-item is-readonly">
                      <div className="routing-item-left">
                        <span className="routing-seq">
                          {String(route.operSeq ?? index + 1).padStart(2, "0")}
                        </span>
                        <span className="routing-code-wrap">
                          <Badge tone="info">{route.operCode}</Badge>
                        </span>
                        <span
                          className="routing-oper-nm"
                          title={matchedOp ? matchedOp.operNm : ""}
                        >
                          {matchedOp ? matchedOp.operNm : ""}
                        </span>
                      </div>

                      {mats.length > 0 && (
                        <div className="routing-mtrl-summary">
                          {inMats.length > 0 && (
                            <div className="routing-mtrl-summary-group">
                              <span className="routing-mtrl-summary-tag is-in">IN</span>
                              {inMats.map((m) => (
                                <span key={`IN-${m.itemCode}`} className="routing-mtrl-chip is-in" title={m.itemCode}>
                                  {m.itemNm}
                                  {m.unit && <small>{m.unit}</small>}
                                </span>
                              ))}
                            </div>
                          )}
                          {outMats.length > 0 && (
                            <div className="routing-mtrl-summary-group">
                              <span className="routing-mtrl-summary-tag is-out">OUT</span>
                              {outMats.map((m) => (
                                <span key={`OUT-${m.itemCode}`} className="routing-mtrl-chip is-out" title={m.itemCode}>
                                  {m.itemNm}
                                  {m.unit && <small>{m.unit}</small>}
                                  {/* 산출 자재의 계획 수율(%) 표시 (미확정이면 숨김) */}
                                  {m.yieldRate != null && <small>{m.yieldRate}%</small>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

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
