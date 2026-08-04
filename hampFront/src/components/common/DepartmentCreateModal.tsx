import { useEffect, useState } from "react";
import type { DepartmentCreateRequest } from "@/types/master/Department";

interface DepartmentCreateModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (data: DepartmentCreateRequest) => void;
}

export function DepartmentCreateModal({
  isOpen,
  isLoading,
  onClose,
  onSubmit,
}: DepartmentCreateModalProps) {
  const [form, setForm] = useState<DepartmentCreateRequest>({
    depCode: "",
    taskDesc: "",
    head: "",
    headPhone: "",
  });

  // 모달이 닫힐 때 Form 입력 데이터 초기화
  useEffect(() => {
    if (!isOpen) {
      setForm({
        depCode: "",
        taskDesc: "",
        head: "",
        headPhone: "",
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof DepartmentCreateRequest, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    // depCode 필수값 검증
    if (!form.depCode.trim()) {
      window.alert("부서 코드를 입력해주세요.");
      return;
    }

    const payload: DepartmentCreateRequest = {
      depCode: form.depCode.trim(),
      taskDesc: form.taskDesc?.trim() ? form.taskDesc.trim() : null,
      head: form.head?.trim() ? form.head.trim() : null,
      headPhone: form.headPhone?.trim() ? form.headPhone.trim() : null,
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
            <h3>신규 부서 등록</h3>
            <span>부서 정보 등록</span>
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
          {/* 부서 코드 (필수) */}
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

          {/* 주요 업무 / 직무 설명 */}
          <div className="detailField">
            <label>주요업무</label>
            <input
              className="tableInput"
              value={form.taskDesc ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("taskDesc", e.target.value)}
              placeholder="예: 생산 공정 관리"
            />
          </div>

          {/* 부서장 */}
          <div className="detailField">
            <label>부서장</label>
            <input
              className="tableInput"
              value={form.head ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("head", e.target.value)}
              placeholder="예: 홍길동"
            />
          </div>

          {/* 대표 연락처 */}
          <div className="detailField">
            <label>대표 연락처</label>
            <input
              className="tableInput"
              value={form.headPhone ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("headPhone", e.target.value)}
              placeholder="예: 010-1234-5678"
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