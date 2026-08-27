import { useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AddressSearchInput } from "@/components/common/AddressSearchInput";
import axios from "axios";

import {
  BusinessPartnerApi,
  type BusinessPartnerCreateRequest
} from "@/api/sales/BusinessPartner";

export function SalesBusinessPartnerCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태 관리
  const [form, setForm] = useState<BusinessPartnerCreateRequest>({
    bpCode: "",
    bpNm: "",
    ceoNm: "",
    phone: "",
    address: "",
    managerNm: "",
    managerPhone: "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 취소 버튼 클릭 시 (기존 검색/페이지 조건 유지)
  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/sales/business-partner?${queryString}` : "/sales/business-partner");
  };

  // 유효성 검사
  const validateForm = (): boolean => {
    const trimmedCode = form.bpCode.trim();
    if (!trimmedCode) {
      alert("거래처 코드를 입력해주세요.");
      return false;
    }
    if (trimmedCode.length > 30) {
      alert("거래처 코드는 최대 30자까지 입력 가능합니다.");
      return false;
    }
    return true;
  };

  // 제출 핸들러
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: BusinessPartnerCreateRequest = {
      bpCode: form.bpCode.trim(),
      bpNm: form.bpNm?.trim() || null,
      ceoNm: form.ceoNm?.trim() || null,
      phone: form.phone?.trim() || null,
      address: form.address?.trim() || null,
      managerNm: form.managerNm?.trim() || null,
      managerPhone: form.managerPhone?.trim() || null,
    };

    setIsSubmitting(true);

    try {
      await BusinessPartnerApi.create(payload);
      alert("성공적으로 등록되었습니다.");
      navigate("/sales/business-partner", { replace: true });
    } catch (error) {
      console.error("거래처 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      alert(message || "거래처 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="screenStack">
      <div className="createCard">
        <div className="createHeader">
          <h1 className="createTitle">신규 거래처 등록</h1>
          <span className="createMeta">* 표시는 필수 입력 항목입니다</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="createBody">
            {/* 기본 정보 섹션 */}
            <div className="createSection">
              <h2 className="createSectionTitle">기본정보</h2>
              <div className="createGrid2Cols">
                <div className="createField">
                  <label className="requiredLabel">
                    거래처코드 <span className="required">*</span>
                  </label>
                  <input
                    className="tableInput"
                    value={form.bpCode}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("bpCode", e.target.value)}
                    placeholder="예: BP001"
                    maxLength={30}
                  />
                </div>

                <div className="createField">
                  <label>거래처명</label>
                  <input
                    className="tableInput"
                    value={form.bpNm ?? ""}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("bpNm", e.target.value)}
                    placeholder="예: (주)한국헴프"
                    maxLength={100}
                  />
                </div>

                <div className="createField">
                  <label>대표자명</label>
                  <input
                    className="tableInput"
                    value={form.ceoNm ?? ""}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("ceoNm", e.target.value)}
                    placeholder="예: 홍길동"
                    maxLength={50}
                  />
                </div>

                <div className="createField">
                  <label>전화번호</label>
                  <input
                    className="tableInput"
                    value={form.phone ?? ""}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="예: 02-1234-5678"
                    maxLength={30}
                  />
                </div>

                <div className="createField fullWidth">
                  <label>주소</label>
                  <AddressSearchInput
                    value={form.address ?? ""}
                    onChange={(val) => handleChange("address", val)}
                    disabled={isSubmitting}
                    placeholder="주소 검색 버튼을 클릭하세요"
                  />
                </div>
              </div>
            </div>

            <div className="createSection">
              <h2 className="createSectionTitle">담당자 정보</h2>
              <div className="createGrid2Cols">
                <div className="createField">
                  <label>담당자명</label>
                  <input
                    className="tableInput"
                    value={form.managerNm ?? ""}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("managerNm", e.target.value)}
                    placeholder="예: 김담당"
                    maxLength={50}
                  />
                </div>

                <div className="createField">
                  <label>담당자 연락처</label>
                  <input
                    className="tableInput"
                    value={form.managerPhone ?? ""}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("managerPhone", e.target.value)}
                    placeholder="예: 010-1234-5678"
                    maxLength={30}
                  />
                </div>
            </div>
          </div>
      </div>

      <div className="createFooter">
        <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>
          취소
        </button>
        <button type="submit" className="primaryButton" disabled={isSubmitting}>
          {isSubmitting ? "등록 중..." : "등록"}
        </button>
      </div>
    </form>
      </div >
    </section >
  );
}
