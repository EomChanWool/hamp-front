import { useEffect, useState } from "react";
import type { FactoryZoneCreateRequest } from "@/types/master/FactoryZone";

interface FactoryZoneCreateModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (data: FactoryZoneCreateRequest) => void;
}

export function FactoryZoneCreateModal({
  isOpen,
  isLoading,
  onClose,
  onSubmit,
}: FactoryZoneCreateModalProps) {
  const [form, setForm] = useState<FactoryZoneCreateRequest>({
    facCode: "",
    facNm: "",
    location: "",
    note: "",
  });

  // 모달이 닫힐 때 Form 입력 데이터 초기화
  useEffect(() => {
    if (!isOpen) {
      setForm({
        facCode: "",
        facNm: "",
        location: "",
        note: "",
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof FactoryZoneCreateRequest, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    // facCode 필수값 검증
    if (!form.facCode.trim()) {
      window.alert("공장 코드를 입력해주세요.");
      return;
    }

    const payload: FactoryZoneCreateRequest = {
      facCode: form.facCode.trim(),
      facNm: form.facNm?.trim() ? form.facNm.trim() : null,
      location: form.location?.trim() ? form.location.trim() : null,
      note: form.note?.trim() ? form.note.trim() : null,
    };

    onSubmit(payload);
  };

  return (
    <>
      {/* 딤 배경 */}
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
            <h3>신규 공장 등록</h3>
            <span>공장동 정보 등록</span>
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
          {/* 공장 코드 (필수) */}
          <div className="detailField">
            <label className="requiredLabel">
              공장코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.facCode}
              disabled={isLoading}
              onChange={(e) => handleChange("facCode", e.target.value)}
              placeholder="예: FAC001"
            />
          </div>

          {/* 공장명 */}
          <div className="detailField">
            <label>공장명</label>
            <input
              className="tableInput"
              value={form.facNm ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("facNm", e.target.value)}
              placeholder="예: 제1공장"
            />
          </div>

          {/* 위치 */}
          <div className="detailField">
            <label>위치</label>
            <input
              className="tableInput"
              value={form.location ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="예: A동 1층"
            />
          </div>

          {/* 비고 */}
          <div className="detailField">
            <label>비고</label>
            <input
              className="tableInput"
              value={form.note ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("note", e.target.value)}
              placeholder="비고 사항 입력"
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