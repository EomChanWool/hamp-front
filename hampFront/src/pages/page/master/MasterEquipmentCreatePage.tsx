import { useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type { 
  EquipmentCreateRequest, 
  ApiResponseEquipmentResponse 
} from "@/types/master/Equipment";

export function MasterEquipmentCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태 관리
  const [form, setForm] = useState<{
    eqCode: string;
    operCode: string;
    eqNm: string;
    eqType: string;
    manufacturer: string;
  }>({
    eqCode: "",
    operCode: "",
    eqNm: "",
    eqType: "",
    manufacturer: "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 취소 버튼 클릭 시에만 기존 검색 조건을 유지하며 목록으로 이동
  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/equipment?${queryString}` : "/master/equipment");
  };

  // [1차 검증] 유효성 체크 (eqCode 필수)
  const validateForm = (): boolean => {
    const trimmedCode = form.eqCode.trim();
    if (!trimmedCode) {
      alert("장비 코드를 입력해주세요.");
      return false;
    }
    if (trimmedCode.length > 30) {
      alert("장비 코드는 최대 30자까지 입력 가능합니다.");
      return false;
    }
    return true;
  };

  // 제출 핸들러
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: EquipmentCreateRequest = {
      eqCode: form.eqCode.trim(),
      operCode: form.operCode.trim() || null,
      eqNm: form.eqNm.trim() || null,
      eqType: form.eqType.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
    };

    setIsSubmitting(true);

    try {
      // 제네릭으로 백엔드 응답 타입 명시
      await apiClient.post<ApiResponseEquipmentResponse>("/equipment", payload);
      alert("성공적으로 등록되었습니다.");
      
      navigate("/master/equipment", { replace: true });
    } catch (error) {
      console.error("장비 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      alert(message || "장비 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="screenStack">
      <Panel title="신규 장비 등록">
        <form className="pageForm" onSubmit={handleSubmit}>
          {/* 장비 코드 (필수) */}
          <div className="detailField">
            <label className="requiredLabel">
              장비코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.eqCode}
              disabled={isSubmitting}
              onChange={(e) => handleChange("eqCode", e.target.value)}
              placeholder="예: EQ001"
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

          {/* 장비명 */}
          <div className="detailField">
            <label>장비명</label>
            <input
              className="tableInput"
              value={form.eqNm}
              disabled={isSubmitting}
              onChange={(e) => handleChange("eqNm", e.target.value)}
              placeholder="예: 프레스 1호기"
              maxLength={100}
            />
          </div>

          {/* 장비 유형 */}
          <div className="detailField">
            <label>장비유형</label>
            <input
              className="tableInput"
              value={form.eqType}
              disabled={isSubmitting}
              onChange={(e) => handleChange("eqType", e.target.value)}
              placeholder="예: 생산설비"
              maxLength={30}
            />
          </div>

          {/* 제조사 */}
          <div className="detailField">
            <label>제조사</label>
            <input
              className="tableInput"
              value={form.manufacturer}
              disabled={isSubmitting}
              onChange={(e) => handleChange("manufacturer", e.target.value)}
              placeholder="예: ABC하이테크"
              maxLength={50}
            />
          </div>

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