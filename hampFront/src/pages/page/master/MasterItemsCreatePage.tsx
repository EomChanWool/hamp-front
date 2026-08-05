import { useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  type ItemCreateRequest,
  type ProductType,
  type ItemCategory,
  type ItemRoutingRequest,
  type ApiResponseItemResponse,
} from "@/types/master/Item";

export function MasterItemsCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 공정 라우팅 목록 상태
  const [routings, setRoutings] = useState<ItemRoutingRequest[]>([]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    // 품목구분이 원료('0')로 변경되거나 초기화되면 라우팅 정보 삭제
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

  // 공정 삭제 (삭제 후 operSeq 자동 재정렬)
  const handleRemoveRouting = (index: number) => {
    setRoutings((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, operSeq: i + 1 }))
    );
  };

  // 공정 데이터 변경 Handling
  const handleRoutingChange = (
    index: number,
    field: keyof ItemRoutingRequest,
    value: unknown
  ) => {
    setRoutings((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // [1차 검증] 프론트엔드 유효성 체크
  const validateForm = (): boolean => {
    if (!form.itemCode.trim()) {
      alert("품목 코드를 입력해주세요.");
      return false;
    }

    const selectedCategory =
      form.category !== "" ? (Number(form.category) as ItemCategory) : null;

    // 반제품(1) 또는 완제품(2)일 때 라우팅 필수 검증
    if (selectedCategory === 1 || selectedCategory === 2) {
      if (routings.length === 0) {
        alert("반제품/완제품 등록 시 공정 라우팅을 최소 1개 이상 추가해야 합니다.");
        return false;
      }

      const hasEmptyOperCode = routings.some(
        (r) => !r.operCode || !r.operCode.trim()
      );
      if (hasEmptyOperCode) {
        alert("공정 코드를 모두 입력해주세요.");
        return false;
      }
    }

    return true;
  };

  // 목록 페이지로 이동 (기존 검색 파라미터 보존)
  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/items?${queryString}` : "/master/items");
  };

  // 등록 제출 핸들러
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const selectedCategory =
      form.category !== "" ? (Number(form.category) as ItemCategory) : null;

    const payload: ItemCreateRequest = {
      itemCode: form.itemCode.trim(),
      productType:
        form.productType !== "" ? (Number(form.productType) as ProductType) : null,
      category: selectedCategory,
      itemNm: form.itemNm.trim() || null,
      unit: form.unit.trim() || null,
      standard: form.standard.trim() || null,
      routings:
        selectedCategory === 1 || selectedCategory === 2
          ? routings.map((r) => ({
              operCode: r.operCode?.trim() || null,
              operSeq: r.operSeq,
              finalYn: r.finalYn || "N",
            }))
          : null,
    };

    setIsSubmitting(true);
    try {
      await apiClient.post<ApiResponseItemResponse>("/items", payload);
      alert("성공적으로 등록되었습니다.");

      // 등록 완료 후 기존 검색조건(쿼리파라미터)을 유지하며 품목 목록으로 이동
      handleCancel();
    } catch (error) {
      console.error("품목 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
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
          {/* 품목 코드 (필수) */}
          <div className="detailField">
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

          {/* 종류 (ProductType) */}
          <div className="detailField">
            <label>종류</label>
            <select
              className="tableInput"
              value={form.productType}
              disabled={isSubmitting}
              onChange={(e) => handleChange("productType", e.target.value)}
            >
              <option value="">선택</option>
              <option value="0">{PRODUCT_TYPE_LABEL[0]}</option>
              <option value="1">{PRODUCT_TYPE_LABEL[1]}</option>
            </select>
          </div>

          {/* 품목 구분 (Category) */}
          <div className="detailField">
            <label>품목구분</label>
            <select
              className="tableInput"
              value={form.category}
              disabled={isSubmitting}
              onChange={(e) => handleChange("category", e.target.value)}
            >
              <option value="">선택</option>
              <option value="0">{CATEGORY_LABEL[0]}</option>
              <option value="1">{CATEGORY_LABEL[1]}</option>
              <option value="2">{CATEGORY_LABEL[2]}</option>
            </select>
          </div>

          {/* 품목명 */}
          <div className="detailField">
            <label>품목명</label>
            <input
              className="tableInput"
              value={form.itemNm}
              disabled={isSubmitting}
              onChange={(e) => handleChange("itemNm", e.target.value)}
              placeholder="예: 사과 통조림"
            />
          </div>

          {/* 단위 */}
          <div className="detailField">
            <label>단위</label>
            <input
              className="tableInput"
              value={form.unit}
              disabled={isSubmitting}
              onChange={(e) => handleChange("unit", e.target.value)}
              placeholder="예: EA, BOX, KG"
            />
          </div>

          {/* 규격 */}
          <div className="detailField">
            <label>규격</label>
            <input
              className="tableInput"
              value={form.standard}
              disabled={isSubmitting}
              onChange={(e) => handleChange("standard", e.target.value)}
              placeholder="예: 500g"
            />
          </div>

          {/* 반제품(1) / 완제품(2) 선택 시 나타나는 공정 라우팅 설정 영역 */}
          {isRoutingRequired && (
            <div
              style={{
                marginTop: "16px",
                paddingTop: "16px",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <label className="requiredLabel" style={{ fontWeight: 600 }}>
                  공정 라우팅 설정 <span className="required">*</span>
                </label>
                <button
                  type="button"
                  className="miniButton primary"
                  disabled={isSubmitting}
                  onClick={handleAddRouting}
                >
                  + 공정 추가
                </button>
              </div>

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
                  공정을 추가해주세요. (최소 1개 이상 필수)
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {routings.map((route, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
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
                      <input
                        className="tableInput"
                        style={{ flex: 1 }}
                        placeholder="공정 코드 (예: OP01)"
                        value={route.operCode ?? ""}
                        disabled={isSubmitting}
                        onChange={(e) =>
                          handleRoutingChange(index, "operCode", e.target.value)
                        }
                      />
                      <select
                        className="tableInput"
                        style={{ width: "110px", flexShrink: 0 }}
                        value={route.finalYn ?? "N"}
                        disabled={isSubmitting}
                        onChange={(e) =>
                          handleRoutingChange(index, "finalYn", e.target.value)
                        }
                      >
                        <option value="N">일반공정</option>
                        <option value="Y">최종공정</option>
                      </select>
                      <button
                        type="button"
                        className="miniButton danger"
                        disabled={isSubmitting}
                        onClick={() => handleRemoveRouting(index)}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 하단 버튼 영역 */}
          <div className="pageFormFooter">
            <button
              type="button"
              className="ghostButton"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="primaryButton"
              disabled={isSubmitting}
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </Panel>
    </section>
  );
}