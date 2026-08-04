import { useEffect, useState } from "react";
import type { OperationCreateRequest } from "@/types/master/Operation";

interface OperationCreateModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (data: OperationCreateRequest) => void;
}

export function OperationCreateModal({
  isOpen,
  isLoading,
  onClose,
  onSubmit,
}: OperationCreateModalProps) {
  const [form, setForm] = useState<OperationCreateRequest>({
    operCode: "",
    depCode: "",
    operNm: "",
    stdTime: "",
  });

  // 모달이 닫힐 때 Form 입력 데이터 초기화
  useEffect(() => {
    if (!isOpen) {
      setForm({
        operCode: "",
        depCode: "",
        operNm: "",
        stdTime: "",
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof OperationCreateRequest, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const payload: OperationCreateRequest = {
      operCode: form.operCode.trim(),
      depCode: form.depCode.trim(),
      operNm: form.operNm?.trim() ? form.operNm.trim() : null,
      stdTime: form.stdTime?.trim() ? form.stdTime.trim() : null,
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
            <h3>신규 공정 등록</h3>
            <span>공정 정보 등록</span>
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
          {/* 공정 코드 (필수) */}
          <div className="detailField">
            <label className="requiredLabel">
              공정코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.operCode}
              disabled={isLoading}
              onChange={(e) => handleChange("operCode", e.target.value)}
              placeholder="예: OPER001"
            />
          </div>

          {/* 담당 부서 코드 (필수) */}
          <div className="detailField">
            <label className="requiredLabel">
              부서코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.depCode}
              disabled={isLoading}
              onChange={(e) => handleChange("depCode", e.target.value)}
              placeholder="예: DEP001"
            />
          </div>

          {/* 공정명 */}
          <div className="detailField">
            <label>공정명</label>
            <input
              className="tableInput"
              value={form.operNm ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("operNm", e.target.value)}
              placeholder="예: 원료 혼합"
            />
          </div>

          {/* 표준 시간 */}
          <div className="detailField">
            <label>표준 시간</label>
            <input
              className="tableInput"
              value={form.stdTime ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("stdTime", e.target.value)}
              placeholder="예: 2026-08-04"
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