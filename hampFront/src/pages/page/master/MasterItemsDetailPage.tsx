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
} from "@/types/master/Item";

type Field = {
  label: string;
  key: string;
  editable?: boolean;
  type?: "select" | "input";
  options?: { label: string; value: string }[];
};

export function MasterItemsDetailPage() {
  const { itemCode } = useParams<{ itemCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [item, setItem] = useState<ItemDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

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
    }
  }, [isEditing, item]);

  // 저장 처리 핸들러
  const handleSave = async () => {
    if (!item || isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: ItemUpdateRequest = {
        productType: form.productType !== "" && form.productType != null ? (Number(form.productType) as ProductType) : null,
        category: form.category !== "" && form.category != null ? (Number(form.category) as ItemCategory) : null,
        itemNm: form.itemNm?.trim() ? form.itemNm.trim() : null,
        unit: form.unit?.trim() ? form.unit.trim() : null,
        standard: form.standard?.trim() ? form.standard.trim() : null,
      };

      const encodedItemCode = encodeURIComponent(item.itemCode);
      const response = await apiClient.put(`/items/${encodedItemCode}`, updatePayload);

      alert(response.data?.message || "수정되었습니다.");

      // 타입 에러가 나지 않도록 명확하게 필드 값을 대입
      setItem((prev) =>
        prev
          ? {
              ...prev,
              productType: updatePayload.productType ?? prev.productType,
              category: updatePayload.category ?? prev.category,
              itemNm: updatePayload.itemNm ?? prev.itemNm,
              unit: updatePayload.unit ?? prev.unit,
              standard: updatePayload.standard ?? prev.standard,
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

  return (
    <section className="screenStack">
      <Panel title={isEditing ? "품목 정보 수정" : "품목 상세 정보"}>
        <form className="pageForm" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
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
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
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
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
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
                    onClick={() => navigate({ pathname: "/master/items", search: location.search })}
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