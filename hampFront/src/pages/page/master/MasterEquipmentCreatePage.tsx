import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

import { EquipmentApi, type EquipmentCreateRequest } from "@/api/master/Equipment";
import { OperationApi, type OperationOptionResponse } from "@/api/master/Operation";

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

  // 취소 버튼 클릭 시
  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/equipment?${queryString}` : "/master/equipment");
  };

  // 유효성 검사
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

  return (
    <section className="screenStack">
      <div className="createCard">
        <div className="createHeader">
          <h1 className="createTitle">신규 장비 등록</h1>
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

                <div className="createField">
                  <label>공정코드</label>
                  <select
                    className="tableInput"
                    value={form.operCode}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("operCode", e.target.value)}
                  >
                    <option value="">공정을 선택해주세요</option>
                    {operationOptions.map((option) => (
                      <option key={option.operCode} value={option.operCode}>
                        {option.operCode} ({option.operNm})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="createField">
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

                <div className="createField">
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

                <div className="createField">
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
      </div>
    </section>
  );
}
