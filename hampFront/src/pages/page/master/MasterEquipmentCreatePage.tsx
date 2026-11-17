import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

import { EquipmentApi, type EquipmentCreateRequest } from "@/api/master/Equipment";
import { OperationApi, type OperationOptionResponse } from "@/api/master/Operation";
import { SelectBox, type SelectBoxOption } from "@/components/common/SelectBox";

export function MasterEquipmentCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [operationOptions, setOperationOptions] = useState<OperationOptionResponse[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 공정 옵션 API 호출
  const loadOperationOptions = useCallback(async () => {
    try {
      const response = await OperationApi.getOptions();
      setOperationOptions(response.data ?? []);
    } catch (error) {
      console.error("공정 옵션 목록 조회 실패:", error);
    }
  }, []);

  useEffect(() => {
    loadOperationOptions();
  }, [loadOperationOptions]);

  // 폼 상태 관리
  const [form, setForm] = useState<{
    operCode: string;
    eqNm: string;
    eqType: string;
    manufacturer: string;
  }>({
    operCode: "",
    eqNm: "",
    eqType: "",
    manufacturer: "",
  });

  // SelectBox용 옵션 (이름 + 코드 2줄 표기)
  const operationSelectOptions = useMemo<SelectBoxOption[]>(
    () =>
      operationOptions.map((option) => ({
        value: option.operCode,
        label: option.operNm ?? option.operCode,
        description: option.operCode,
      })),
    [operationOptions]
  );

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 취소 버튼 클릭 시
  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/equipment?${queryString}` : "/master/equipment");
  };

  // 제출 핸들러
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    const payload: EquipmentCreateRequest = {
      operCode: form.operCode.trim() || null,
      eqNm: form.eqNm.trim() || null,
      eqType: form.eqType.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
    };

    setIsSubmitting(true);

    try {
      await EquipmentApi.create(payload);
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

  // ---- 요약 패널용 파생 값 ----
  const selectedOperation = operationOptions.find((option) => option.operCode === form.operCode);
  const summaryRows: { label: string; value: string }[] = [
    { label: "공정", value: selectedOperation ? (selectedOperation.operNm ?? selectedOperation.operCode) : "" },
    { label: "장비명", value: form.eqNm.trim() },
    { label: "장비유형", value: form.eqType.trim() },
    { label: "제조사", value: form.manufacturer.trim() },
  ];

  return (
    <section className="screenStack">
      <form className="formPage" onSubmit={handleSubmit}>
        <div className="formPageHead">
          <h1 className="formPageTitle">신규 장비 등록</h1>
          <span className="formPageMeta">
            <span className="required" aria-hidden="true">*</span> 표시는 필수 입력 항목입니다
          </span>
        </div>

        <div className="formLayout">
          {/* ===== 좌측: 입력 카드 ===== */}
          <div className="formMain">
            <section className="formCard" aria-labelledby="eq-sec-basic">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="eq-sec-basic">기본정보</h2>
                  <p className="formCardDesc">장비가 속한 공정과 장비 정보를 입력합니다.</p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col3">
                  <label className="formLabel" htmlFor="eq-oper">공정명</label>
                  <SelectBox
                    id="eq-oper"
                    value={form.operCode}
                    options={operationSelectOptions}
                    placeholder="공정을 선택해주세요"
                    searchPlaceholder="공정명 또는 코드 검색"
                    clearLabel="선택 안 함"
                    searchable
                    disabled={isSubmitting}
                    onChange={(v) => handleChange("operCode", v)}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="eq-name">장비명</label>
                  <input
                    id="eq-name"
                    className="formInput"
                    value={form.eqNm}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("eqNm", e.target.value)}
                    placeholder="예: 프레스 1호기"
                    maxLength={100}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="eq-type">장비유형</label>
                  <input
                    id="eq-type"
                    className="formInput"
                    value={form.eqType}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("eqType", e.target.value)}
                    placeholder="예: 생산설비"
                    maxLength={30}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="eq-maker">제조사</label>
                  <input
                    id="eq-maker"
                    className="formInput"
                    value={form.manufacturer}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("manufacturer", e.target.value)}
                    placeholder="예: ABC하이테크"
                    maxLength={50}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ===== 우측: 요약 + 액션 ===== */}
          <aside className="formCard formAside" aria-label="장비 요약">
            <h2 className="formCardTitle">장비 요약</h2>

            <dl className="formSummaryList">
              {summaryRows.map((row) => (
                <div className="formSummaryRow" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className={row.value ? undefined : "isEmpty"}>{row.value || "미입력"}</dd>
                </div>
              ))}
            </dl>

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