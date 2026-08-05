import { useEffect, useState } from "react";
import type { DefectCreateRequest } from "@/types/master/Defect";

interface DefectCreateModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (data: DefectCreateRequest) => void;
}

export function DefectCreateModal({
  isOpen,
  isLoading,
  onClose,
  onSubmit,
}: DefectCreateModalProps) {
  const [form, setForm] = useState<DefectCreateRequest>({
    defCode: "",
    operCode: "",
    defNm: "",
    defType: "",
    severity: "",
  });

  // 모달이 닫힐 때 Form 입력 데이터 초기화
  useEffect(() => {
    if (!isOpen) {
      setForm({
        defCode: "",
        operCode: "",
        defNm: "",
        defType: "",
        severity: "",
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof DefectCreateRequest, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    // defCode 필수값 검증
    if (!form.defCode.trim()) {
      window.alert("불량 코드를 입력해주세요.");
      return;
    }

    const payload: DefectCreateRequest = {
      defCode: form.defCode.trim(),
      operCode: form.operCode?.trim() ? form.operCode.trim() : null,
      defNm: form.defNm?.trim() ? form.defNm.trim() : null,
      defType: form.defType?.trim() ? form.defType.trim() : null,
      severity: form.severity?.trim() ? form.severity.trim() : null,
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
            <h3>신규 불량 등록</h3>
            <span>불량 항목 정보 등록</span>
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
          {/* 불량 코드 (필수) */}
          <div className="detailField">
            <label className="requiredLabel">
              불량코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.defCode}
              disabled={isLoading}
              onChange={(e) => handleChange("defCode", e.target.value)}
              placeholder="예: DEF001"
            />
          </div>

          {/* 공정 코드 */}
          <div className="detailField">
            <label>공정코드</label>
            <input
              className="tableInput"
              value={form.operCode ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("operCode", e.target.value)}
              placeholder="예: PROC01"
            />
          </div>

          {/* 불량명 */}
          <div className="detailField">
            <label>불량명</label>
            <input
              className="tableInput"
              value={form.defNm ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("defNm", e.target.value)}
              placeholder="예: 표면 스크래치"
            />
          </div>

          {/* 불량 유형 */}
          <div className="detailField">
            <label>불량유형</label>
            <input
              className="tableInput"
              value={form.defType ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("defType", e.target.value)}
              placeholder="예: 외관 불량"
            />
          </div>

          {/* 심각도 */}
          <div className="detailField">
            <label>심각도</label>
            <input
              className="tableInput"
              value={form.severity ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("severity", e.target.value)}
              placeholder="예: HIGH / MEDIUM / LOW"
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