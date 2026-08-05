import { useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { apiClient } from "@/api/apiClient";
import axios from "axios";

import type {
  FactoryZoneCreateRequest,
  ApiResponseFactoryZoneResponse,
} from "@/types/master/FactoryZone";

export function MasterFactoryZoneCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<FactoryZoneCreateRequest>({
    facCode: "",
    facNm: "",
    location: "",
    note: "",
  });

  const handleChange = (
    key: keyof FactoryZoneCreateRequest,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // 프론트 유효성 검사
  const validateForm = (): boolean => {
    if (!form.facCode.trim()) {
      window.alert("공장코드를 입력해주세요.");
      return false;
    }

    return true;
  };

  // 목록으로 이동 (검색조건 유지)
  const handleCancel = () => {
    const queryString = searchParams.toString();

    navigate(
      queryString
        ? `/master/factory-zones?${queryString}`
        : "/master/factory-zones"
    );
  };

  // 등록
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: FactoryZoneCreateRequest = {
      facCode: form.facCode.trim(),
      facNm: form.facNm?.trim() || null,
      location: form.location?.trim() || null,
      note: form.note?.trim() || null,
    };

    setIsSubmitting(true);

    try {
      await apiClient.post<ApiResponseFactoryZoneResponse>(
        "/factory-zones",
        payload
      );

      window.alert("성공적으로 등록되었습니다.");

      handleCancel();
    } catch (error) {
      console.error("공장 등록 실패:", error);

      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;

      window.alert(message || "공장 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="screenStack">
      <Panel title="신규 공장 등록">
        <form className="pageForm" onSubmit={handleSubmit}>
          {/* 공장코드 */}
          <div className="detailField">
            <label className="requiredLabel">
              공장코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.facCode}
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              onChange={(e) => handleChange("facNm", e.target.value)}
              placeholder="공장명을 입력하세요."
            />
          </div>

          {/* 위치 */}
          <div className="detailField">
            <label>위치</label>
            <input
              className="tableInput"
              value={form.location ?? ""}
              disabled={isSubmitting}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="공장 위치를 입력하세요."
            />
          </div>

          {/* 비고 */}
          <div className="detailField">
            <label>비고</label>
            <textarea
              className="tableInput"
              value={form.note ?? ""}
              disabled={isSubmitting}
              onChange={(e) => handleChange("note", e.target.value)}
              placeholder="비고를 입력하세요."
              rows={4}
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