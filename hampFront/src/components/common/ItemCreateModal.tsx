import { useEffect, useState } from "react";
import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  type ItemCreateRequest,
  type ProductType,
  type ItemCategory,
  type ItemRoutingRequest,
} from "@/types/master/Item";

interface ItemCreateModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (data: ItemCreateRequest) => void;
}

export function ItemCreateModal({
  isOpen,
  isLoading,
  onClose,
  onSubmit,
}: ItemCreateModalProps) {
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

  // 모달 닫힐 때 폼 및 라우팅 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setForm({
        itemCode: "",
        productType: "",
        category: "",
        itemNm: "",
        unit: "",
        standard: "",
      });
      setRoutings([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    // 품목구분이 원료('0')로 바뀌면 라우팅 정보 초기화
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
    value: any
  ) => {
    setRoutings((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = () => {
    if (!form.itemCode.trim()) {
      window.alert("품목 코드를 입력해주세요.");
      return;
    }

    const selectedCategory =
      form.category !== "" ? (Number(form.category) as ItemCategory) : null;

    // 반제품(1) 또는 완제품(2)일 때 라우팅 필수 검증
    if (selectedCategory === 1 || selectedCategory === 2) {
      if (routings.length === 0) {
        window.alert("반제품/완제품 등록 시 공정 라우팅을 최소 1개 이상 추가해야 합니다.");
        return;
      }

      const hasEmptyOperCode = routings.some(
        (r) => !r.operCode || !r.operCode.trim()
      );
      if (hasEmptyOperCode) {
        window.alert("공정 코드를 모두 입력해주세요.");
        return;
      }
    }

    const payload: ItemCreateRequest = {
      itemCode: form.itemCode.trim(),
      productType:
        form.productType !== "" ? (Number(form.productType) as ProductType) : null,
      category: selectedCategory,
      itemNm: form.itemNm.trim() || null,
      unit: form.unit.trim() || null,
      standard: form.standard.trim() || null,
      // 원료('0')이거나 미선택 시 null, 반제품/완제품 시 routings 배열 전달
      routings:
        selectedCategory === 1 || selectedCategory === 2
          ? routings.map((r) => ({
              operCode: r.operCode?.trim() || null,
              operSeq: r.operSeq,
              finalYn: r.finalYn || "N",
            }))
          : null,
    };

    onSubmit(payload);
  };

  const isRoutingRequired = form.category === "1" || form.category === "2";

  return (
    <>
      <div
        onClick={isLoading ? undefined : onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)",
          zIndex: 200,
        }}
      />

      <div className="detailModal">
        <div className="detailModalHeader">
          <div>
            <h3>신규 품목 등록</h3>
            <span>품목 정보 등록</span>
          </div>
          <button
            type="button"
            className="detailModalClose"
            onClick={onClose}
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <div className="detailModalBody">
          {/* 품목 코드 (필수) */}
          <div className="detailField">
            <label className="requiredLabel">
              품목코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.itemCode}
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
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
                  marginBottom: "8px",
                }}
              >
                <label className="requiredLabel" style={{ fontWeight: 600 }}>
                  공정 라우팅 설정 <span className="required">*</span>
                </label>
                <button
                  type="button"
                  className="miniButton primary"
                  disabled={isLoading}
                  onClick={handleAddRouting}
                >
                  + 공정 추가
                </button>
              </div>

              {routings.length === 0 ? (
                <div
                  style={{
                    padding: "12px",
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
                        disabled={isLoading}
                        onChange={(e) =>
                          handleRoutingChange(index, "operCode", e.target.value)
                        }
                      />
                      <select
                        className="tableInput"
                        style={{ width: "110px", flexShrink: 0 }}
                        value={route.finalYn ?? "N"}
                        disabled={isLoading}
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
                        disabled={isLoading}
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
        </div>

        <div className="detailModalFooter">
          <div className="detailModalFooterRight">
            <button
              type="button"
              className="ghostButton"
              onClick={onClose}
              disabled={isLoading}
            >
              취소
            </button>
            <button
              type="button"
              className="primaryButton"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}