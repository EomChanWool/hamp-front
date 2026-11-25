import { useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AddressSearchInput } from "@/components/common/AddressSearchInput";
import axios from "axios";
import { isValidPhone } from "@/utils/common";

import {
  BusinessPartnerApi,
  type BusinessPartnerCreateRequest
} from "@/api/sales/BusinessPartner";
import "@/pages/layout/Layout.css";

type SummaryRow = {
  label: string;
  value: string;
};

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
    navigate(queryString ? `/seed-sales/business-partner?${queryString}` : "/seed-sales/business-partner");
  };

  // 유효성 검사
  const validateForm = (): boolean => {
    // 거래처 코드: 필수 + 최대 30자 (VARCHAR(30) 기준)
    const trimmedCode = form.bpCode.trim();
    if (!trimmedCode) {
      alert("거래처 코드를 입력해주세요.");
      return false;
    }
    if (trimmedCode.length > 30) {
      alert("거래처 코드는 최대 30자까지 입력 가능합니다.");
      return false;
    }

    // 전화번호: 선택 입력, 값이 있으면 형식 검사
    if (!isValidPhone(form.phone)) {
      alert("전화번호 형식이 올바르지 않습니다.\n예: 02-1234-5678, 010-1234-5678");
      return false;
    }

    // 담당자 연락처: 선택 입력, 값이 있으면 형식 검사
    if (!isValidPhone(form.managerPhone)) {
      alert("담당자 연락처 형식이 올바르지 않습니다.\n예: 010-1234-5678");
      return false;
    }

    return true;
  };

  // 제출 핸들러
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // 빈 문자열은 null로 변환하여 전송
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
      navigate("/seed-sales/business-partner", { replace: true });
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

  // ---- 요약 패널용 파생 값 ----
  const summaryRows: SummaryRow[] = [
    { label: "거래처코드", value: form.bpCode.trim() },
    { label: "거래처명", value: form.bpNm?.trim() ?? "" },
    { label: "대표자", value: form.ceoNm?.trim() ?? "" },
    { label: "전화번호", value: form.phone?.trim() ?? "" },
    { label: "주소", value: form.address?.trim() ?? "" },
    { label: "담당자", value: form.managerNm?.trim() ?? "" },
    { label: "담당연락처", value: form.managerPhone?.trim() ?? "" },
  ];

  return (
    <section className="screenStack">
      <form className="formPage" onSubmit={handleSubmit}>
        <div className="formPageHead">
          <h1 className="formPageTitle">신규 거래처 등록</h1>
          <span className="formPageMeta">
            <span className="required" aria-hidden="true">*</span> 표시는 필수 입력 항목입니다
          </span>
        </div>

        <div className="formLayout">
          {/* ===== 좌측: 입력 섹션 카드 ===== */}
          <div className="formMain">
            {/* 1. 기본정보 */}
            <section className="formCard" aria-labelledby="bp-sec-basic">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="bp-sec-basic">기본정보</h2>
                  <p className="formCardDesc">거래처를 구분하는 코드와 상호, 대표자, 연락처, 주소를 입력합니다.</p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col3">
                  <label className="formLabel" htmlFor="bp-code">
                    거래처코드 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="bp-code"
                    className="formInput"
                    value={form.bpCode}
                    disabled={isSubmitting}
                    aria-required="true"
                    autoComplete="off"
                    onChange={(e) => handleChange("bpCode", e.target.value)}
                    placeholder="예: BP001"
                    maxLength={30}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="bp-name">거래처명</label>
                  <input
                    id="bp-name"
                    className="formInput"
                    value={form.bpNm ?? ""}
                    disabled={isSubmitting}
                    autoComplete="off"
                    onChange={(e) => handleChange("bpNm", e.target.value)}
                    placeholder="예: (주)한국헴프"
                    maxLength={100}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="bp-ceo">대표자명</label>
                  <input
                    id="bp-ceo"
                    className="formInput"
                    value={form.ceoNm ?? ""}
                    disabled={isSubmitting}
                    autoComplete="off"
                    onChange={(e) => handleChange("ceoNm", e.target.value)}
                    placeholder="예: 홍길동"
                    maxLength={50}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="bp-phone">전화번호</label>
                  <input
                    id="bp-phone"
                    className="formInput"
                    type="tel"
                    value={form.phone ?? ""}
                    disabled={isSubmitting}
                    autoComplete="off"
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="예: 02-1234-5678"
                    maxLength={30}
                  />
                </div>

                <div className="formField col6">
                  <span className="formLabel" id="bp-address-label">주소</span>
                  <AddressSearchInput
                    value={form.address ?? ""}
                    onChange={(val) => handleChange("address", val)}
                    disabled={isSubmitting}
                    placeholder="주소 검색 버튼을 클릭하세요"
                  />
                </div>
              </div>
            </section>

            {/* 2. 담당자 정보 */}
            <section className="formCard" aria-labelledby="bp-sec-manager">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="bp-sec-manager">담당자 정보</h2>
                  <p className="formCardDesc">거래처 담당자의 이름과 연락처를 입력합니다.</p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col3">
                  <label className="formLabel" htmlFor="bp-manager-name">담당자명</label>
                  <input
                    id="bp-manager-name"
                    className="formInput"
                    value={form.managerNm ?? ""}
                    disabled={isSubmitting}
                    autoComplete="off"
                    onChange={(e) => handleChange("managerNm", e.target.value)}
                    placeholder="예: 김담당"
                    maxLength={50}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="bp-manager-phone">담당자 연락처</label>
                  <input
                    id="bp-manager-phone"
                    className="formInput"
                    type="tel"
                    value={form.managerPhone ?? ""}
                    disabled={isSubmitting}
                    autoComplete="off"
                    onChange={(e) => handleChange("managerPhone", e.target.value)}
                    placeholder="예: 010-1234-5678"
                    maxLength={30}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ===== 우측: 요약 + 액션 ===== */}
          <aside className="formCard formAside" aria-label="거래처 요약">
            <section className="formAsideSection" aria-labelledby="bp-summary-title">
              <h2 className="formCardTitle" id="bp-summary-title">거래처 요약</h2>
              <dl className="formSummaryList">
                {summaryRows.map((row) => (
                  <div className="formSummaryRow" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd className={row.value ? undefined : "isEmpty"}>{row.value || "미입력"}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="formActions">
              <button type="submit" className="primaryButton" disabled={isSubmitting}>
                {isSubmitting ? "등록 중..." : "등록"}
              </button>
              <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>
                취소
              </button>
            </div>
          </aside>
        </div>
      </form>
    </section>
  );
}