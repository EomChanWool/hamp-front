import { useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { apiClient } from "@/api/apiClient";
import axios from "axios";

import type {
  OperationCreateRequest,
  ApiResponseOperationResponse,
} from "@/types/master/Operation";

export function MasterOperationCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<OperationCreateRequest>({
    operCode: "",
    depCode: "",
    operNm: "",
    stdTime: "",
  });

  const handleChange = (
    key: keyof OperationCreateRequest,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // 프론트 유효성 검사
  const validateForm = (): boolean => {
    if (!form.operCode.trim()) {
      window.alert("공정코드를 입력해주세요.");
      return false;
    }

    if (!form.depCode.trim()) {
      window.alert("부서코드를 입력해주세요.");
      return false;
    }

    return true;
  };

  // 목록으로 이동 (검색조건 유지)
  const handleCancel = () => {
    const queryString = searchParams.toString();

    navigate(
      queryString
        ? `/master/operation?${queryString}`
        : "/master/operation"
    );
  };

  // 등록
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: OperationCreateRequest = {
      operCode: form.operCode.trim(),
      depCode: form.depCode.trim(),
      operNm: form.operNm?.trim() || null,
      stdTime: form.stdTime?.trim() || null,
    };

    setIsSubmitting(true);

    try {
      await apiClient.post<ApiResponseOperationResponse>(
        "/operations",
        payload
      );

      window.alert("성공적으로 등록되었습니다.");

      handleCancel();
    } catch (error) {
      console.error("공정 등록 실패:", error);

      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;

      window.alert(message || "공정 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="screenStack">
      <Panel title="신규 공정 등록">
        <form className="pageForm" onSubmit={handleSubmit}>
          {/* 공정코드 */}
          <div className="detailField">
            <label className="requiredLabel">
              공정코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.operCode}
              disabled={isSubmitting}
              onChange={(e) => handleChange("operCode", e.target.value)}
              placeholder="예: OPER001"
            />
          </div>

          {/* 부서코드 */}
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
            />
          </div>

          {/* 공정명 */}
          <div className="detailField">
            <label>공정명</label>
            <input
              className="tableInput"
              value={form.operNm ?? ""}
              disabled={isSubmitting}
              onChange={(e) => handleChange("operNm", e.target.value)}
              placeholder="공정명을 입력하세요."
            />
          </div>

          {/* 표준시간 */}
          <div className="detailField">
            <label>표준시간</label>
            <input
              className="tableInput"
              value={form.stdTime ?? ""}
              disabled={isSubmitting}
              onChange={(e) => handleChange("stdTime", e.target.value)}
              placeholder="표준시간을 입력하세요."
            />
          </div>

          {/* 하단 버튼 */}
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