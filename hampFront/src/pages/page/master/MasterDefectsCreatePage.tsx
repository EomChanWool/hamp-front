import { useState, type SyntheticEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type { 
  DefectCreateRequest, 
  ApiResponseDefectResponse 
} from "@/types/master/Defect";

export function MasterDefectsCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태 관리
  const [form, setForm] = useState<{
    defCode: string;
    operCode: string;
    defNm: string;
    defType: string;
    severity: string;
  }>({
    defCode: "",
    operCode: "",
    defNm: "",
    defType: "",
    severity: "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 이전 검색조건을 유지하면서 목록으로 이동
  const handleGoBack = () => {
    navigate({
      pathname: "/master/defects",
      search: location.search,
    });
  };

  // [1차 검증] 유효성 체크 (defCode 필수)
  const validateForm = (): boolean => {
    const trimmedCode = form.defCode.trim();
    if (!trimmedCode) {
      alert("불량 코드를 입력해주세요.");
      return false;
    }
    if (trimmedCode.length > 30) {
      alert("불량 코드는 최대 30자까지 입력 가능합니다.");
      return false;
    }
    return true;
  };

  // 제출 핸들러
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: DefectCreateRequest = {
      defCode: form.defCode.trim(),
      operCode: form.operCode.trim() || null,
      defNm: form.defNm.trim() || null,
      defType: form.defType.trim() || null,
      severity: form.severity.trim() || null,
    };

    setIsSubmitting(true);

    try {
      // 제네릭으로 백엔드 응답 타입 명시
      await apiClient.post<ApiResponseDefectResponse>("/defects", payload);
      alert("성공적으로 등록되었습니다.");
      handleGoBack();
    } catch (error) {
      console.error("불량코드 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      alert(message || "불량코드 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="screenStack">
      <Panel title="신규 불량코드 등록">
        <form className="pageForm" onSubmit={handleSubmit}>
          {/* 불량 코드 (필수) */}
          <div className="detailField">
            <label className="requiredLabel">
              불량코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.defCode}
              disabled={isSubmitting}
              onChange={(e) => handleChange("defCode", e.target.value)}
              placeholder="예: DEF001"
              maxLength={30}
            />
          </div>

          {/* 공정 코드 */}
          <div className="detailField">
            <label>공정코드</label>
            <input
              className="tableInput"
              value={form.operCode}
              disabled={isSubmitting}
              onChange={(e) => handleChange("operCode", e.target.value)}
              placeholder="예: OPER001"
              maxLength={30}
            />
          </div>

          {/* 불량명 */}
          <div className="detailField">
            <label>불량명</label>
            <input
              className="tableInput"
              value={form.defNm}
              disabled={isSubmitting}
              onChange={(e) => handleChange("defNm", e.target.value)}
              placeholder="예: 이물 혼입"
              maxLength={100}
            />
          </div>

          {/* 불량 유형 */}
          <div className="detailField">
            <label>불량유형</label>
            <input
              className="tableInput"
              value={form.defType}
              disabled={isSubmitting}
              onChange={(e) => handleChange("defType", e.target.value)}
              placeholder="예: 품질"
              maxLength={30}
            />
          </div>

          {/* 심각도 */}
          <div className="detailField">
            <label>심각도</label>
            <input
              className="tableInput"
              value={form.severity}
              disabled={isSubmitting}
              onChange={(e) => handleChange("severity", e.target.value)}
              placeholder="예: 높음"
              maxLength={30}
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