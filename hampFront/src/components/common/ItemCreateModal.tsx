import { useEffect, useState } from "react";
import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  type ItemCreateRequest,
  type ProductType,
  type ItemCategory,
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
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!form.itemCode.trim()) {
      window.alert("품목 코드를 입력해주세요.");
      return;
    }

    const payload: ItemCreateRequest = {
      itemCode: form.itemCode.trim(),
      productType:
        form.productType !== "" ? (Number(form.productType) as ProductType) : null,
      category:
        form.category !== "" ? (Number(form.category) as ItemCategory) : null,
      itemNm: form.itemNm.trim() || null,
      unit: form.unit.trim() || null,
      standard: form.standard.trim() || null,
    };

    onSubmit(payload);
  };

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