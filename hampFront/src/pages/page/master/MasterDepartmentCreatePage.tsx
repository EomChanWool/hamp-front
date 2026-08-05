import { useState, type SyntheticEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type {
  DepartmentCreateRequest,
  ApiResponseDepartmentResponse,
} from "@/types/master/Department";

export function MasterDepartmentCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태 관리
  const [form, setForm] = useState<{
    depCode: string;
    taskDesc: string;
    head: string;
    headPhone: string;
  }>({
    depCode: "",
    taskDesc: "",
    head: "",
    headPhone: "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 이전 검색조건을 유지하면서 목록으로 이동
  const handleGoBack = () => {
    navigate({
      pathname: "/master/department",
      search: location.search,
    });
  };

  // [1차 검증] 유효성 체크 (depCode 필수)
  const validateForm = (): boolean => {
    const trimmedCode = form.depCode.trim();
    if (!trimmedCode) {
      alert("부서 코드를 입력해주세요.");
      return false;
    }
    if (trimmedCode.length > 30) {
      alert("부서 코드는 최대 30자까지 입력 가능합니다.");
      return false;
    }
    return true;
  };

  // 제출 핸들러
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: DepartmentCreateRequest = {
      depCode: form.depCode.trim(),
      taskDesc: form.taskDesc.trim() || null,
      head: form.head.trim() || null,
      headPhone: form.headPhone.trim() || null,
    };

    setIsSubmitting(true);

    try {
      // 제네릭으로 백엔드 응답 타입 명시
      await apiClient.post<ApiResponseDepartmentResponse>("/departments", payload);
      alert("성공적으로 등록되었습니다.");
      handleGoBack();
    } catch (error) {
      console.error("부서코드 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      alert(message || "부서코드 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="screenStack">
      <Panel title="신규 부서코드 등록">
        <form className="pageForm" onSubmit={handleSubmit}>
          {/* 부서 코드 (필수) */}
          <div className="detailField">
            <label className="requiredLabel">
              부서코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.depCode}
              disabled={isSubmitting}
              onChange={(e) => handleChange("depCode", e.target.value)}
              placeholder="예: DEP001"
              maxLength={30}
            />
          </div>

          {/* 담당 업무 설명 */}
          <div className="detailField">
            <label>담당업무</label>
            <input
              className="tableInput"
              value={form.taskDesc}
              disabled={isSubmitting}
              onChange={(e) => handleChange("taskDesc", e.target.value)}
              placeholder="예: 품질 관리 및 검사 업무"
              maxLength={100}
            />
          </div>

          {/* 담당자 */}
          <div className="detailField">
            <label>담당자</label>
            <input
              className="tableInput"
              value={form.head}
              disabled={isSubmitting}
              onChange={(e) => handleChange("head", e.target.value)}
              placeholder="예: 홍길동"
              maxLength={30}
            />
          </div>

          {/* 연락처 */}
          <div className="detailField">
            <label>연락처</label>
            <input
              className="tableInput"
              value={form.headPhone}
              disabled={isSubmitting}
              onChange={(e) => handleChange("headPhone", e.target.value)}
              placeholder="예: 010-1234-5678"
              maxLength={20}
            />
          </div>

          {/* 하단 버튼 영역 */}
          <div className="pageFormFooter">
            <button
              type="button"
              className="ghostButton"
              onClick={handleGoBack}
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