import { useEffect, useState } from "react";
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
  
  // 라우팅 목록 상태 (상세 조회 시 불러온 데이터 및 수정 중 변경되는 데이터 관리)
  const [routings, setRoutings] = useState<ItemRoutingRequest[]>([]);

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

          // 서버에서 가져온 기존 라우팅 정보 세팅 (ItemRoutingResponse 구조 반영)
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

  // 수정 모드 취소 시 데이터 롤백
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

  // 품목구분이 원료('0')로 변경되면 라우팅 초기화
  const handleFieldChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "category" && value === "0") {
      setRoutings([]);
    }
  };

  // 공정 추가
  const handleAddRouting = () => {
    setRoutings((prev) => [
      ...prev,
      {
        operCode: "",
        operSeq: prev.length + 1,
        finalYn: "N",
      },
    ]);
  };

  // 공정 삭제 (순서 자동 정렬)
  const handleRemoveRouting = (index: number) => {
    setRoutings((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, operSeq: i + 1 }))
    );
  };

  // 공정 데이터 변경
  const handleRoutingChange = (
    index: number,
    field: keyof ItemRoutingRequest,
    value: unknown
  ) => {
    setRoutings((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // 저장 전 유효성 검증
  const validateForm = (): boolean => {
    const selectedCategory =
      form.category !== "" ? (Number(form.category) as ItemCategory) : null;

    // 반제품(1) 또는 완제품(2)일 때 라우팅 필수 검증
    if (selectedCategory === 1 || selectedCategory === 2) {
      if (routings.length === 0) {
        alert("반제품/완제품은 공정 라우팅을 최소 1개 이상 설정해야 합니다.");
        return false;
      }
      const hasEmptyOperCode = routings.some(
        (r) => !r.operCode || !r.operCode.trim()
      );
      if (hasEmptyOperCode) {
        alert("모든 행의 공정 코드를 선택해주세요.");
        return false;
      }
    }
    return true;
  };

  // 저장 처리 핸들러
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

      // 로컬 상세 상태 갱신 (서버 응답 규격인 ItemRoutingResponse 형태로 변환하여 반영)
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
                    routingId: 0, // 임시 ID 또는 백엔드 응답값 의존
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

  // 품목 삭제 처리
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
          <div className="p-8 text-center">데이터를 불러오는 중입니다...</div>
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

          {/* 공정 라우팅 영역 */}
          {(isRoutingRequired || (routings && routings.length > 0)) && (
            <div className="detailField" style={{ alignItems: "flex-start" }}>
              <label style={{ color: isRoutingRequired ? "inherit" : "#4b5563" }}>
                공정 라우팅 정보{" "}
                {isRoutingRequired && <span className="required">*</span>}
              </label>

              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                {isEditing && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
                    <button
                      type="button"
                      className="miniButton primary"
                      disabled={isBusy}
                      onClick={handleAddRouting}
                    >
                      + 공정 추가
                    </button>
                  </div>
                )}

                {routings.length === 0 ? (
                  <div
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      color: "#6b7280",
                      fontSize: "13px",
                      background: "#f9fafb",
                      borderRadius: "4px",
                    }}
                  >
                    등록된 공정 라우팅이 없습니다.
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}
                  >
                    {routings.map((route, index) => {
                      const matchedOp = operations.find(
                        (op) => op.operCode === route.operCode
                      );

                      return (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            width: "100%",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#4b5563",
                              width: "50px",
                              flexShrink: 0,
                            }}
                          >
                            순서 {route.operSeq}
                          </span>

                          {isEditing ? (
                            <select
                              className="tableInput"
                              style={{ flex: 1 }}
                              value={route.operCode ?? ""}
                              disabled={isBusy}
                              onChange={(e) =>
                                handleRoutingChange(index, "operCode", e.target.value)
                              }
                            >
                              <option value="">공정 선택</option>
                              {operations.map((op) => (
                                <option key={op.operCode} value={op.operCode}>
                                  {op.operCode} ({op.operNm})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div
                              className="tableInput"
                              style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                background: "#f9fafb",
                                padding: "4px 8px",
                              }}
                            >
                              {route.operCode} {matchedOp ? `(${matchedOp.operNm})` : ""}
                            </div>
                          )}

                          {isEditing ? (
                            <select
                              className="tableInput"
                              style={{ width: "110px", flexShrink: 0 }}
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
                            <div
                              style={{
                                width: "110px",
                                flexShrink: 0,
                                fontSize: "13px",
                                textAlign: "center",
                              }}
                            >
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
                              삭제
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pageFormFooterSpaceBetween">
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
                    취소
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
    </section>
  );
}