import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import { EquipmentApi } from "@/api/master/Equipment";
import type {
  EquipmentDetailResponse,
  EquipmentUpdateRequest,
} from "@/api/master/Equipment";
import { OperationApi } from "@/api/master/Operation";
import Spinner from "@/components/common/Spinner";
import type { OperationOptionResponse } from "@/api/master/Operation";

type Field = {
  label: string;
  key: string;
  editable?: boolean;
};

export function MasterEquipmentDetailPage() {
  const { eqCode } = useParams<{ eqCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [equipment, setEquipment] = useState<EquipmentDetailResponse | null>(null);
  const [operationOptions, setOperationOptions] = useState<OperationOptionResponse[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const isBusy = isUpdating || isDeleting;

  // 공정 옵션 목록 API 호출
  const fetchOperationOptions = useCallback(async () => {
    try {
      const response = await OperationApi.getOptions();
      setOperationOptions(response.data ?? []);
    } catch (error) {
      console.error("공정 옵션 목록 조회 실패:", error);
    }
  }, []);

  useEffect(() => {
    fetchOperationOptions();
  }, [fetchOperationOptions]);

  const fields: Field[] = [
    { label: "장비코드", key: "eqCode", editable: false },
    { label: "공정코드", key: "operCode" },
    { label: "공정명", key: "operNm", editable: false },
    { label: "공정사용여부", key: "operUseYn", editable: false },
    { label: "부서코드", key: "depCode", editable: false },
    { label: "장비명", key: "eqNm" },
    { label: "장비유형", key: "eqType" },
    { label: "제조사", key: "manufacturer" },
    { label: "작업설명", key: "taskDesc", editable: false },
    { label: "등록일자", key: "createdAt", editable: false },
  ];

  // 상세 데이터 조회
  const fetchEquipmentDetail = async () => {
    if (!eqCode) return;
    setIsLoading(true);

    try {
      const response = await EquipmentApi.getDetail(eqCode);
      const eqData = response.data;

      if (eqData) {
        setEquipment(eqData);
        setForm({
          eqCode: eqData.eqCode,
          operCode: eqData.operCode || "",
          operNm: eqData.operNm || "",
          operUseYn: eqData.operUseYn || "",
          depCode: eqData.depCode || "",
          eqNm: eqData.eqNm || "",
          eqType: eqData.eqType || "",
          manufacturer: eqData.manufacturer || "",
          taskDesc: eqData.taskDesc || "",
          createdAt: formatDateTime(eqData.createdAt),
        });
      }
    } catch (error) {
      console.error("장비 상세 조회 실패:", error);
      alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
      navigate({ pathname: "/master/equipment", search: location.search });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (eqCode) {
      fetchEquipmentDetail();
    }
  }, [eqCode]);

  // 수정 모드 취소 시 롤백
  useEffect(() => {
    if (equipment && !isEditing) {
      setForm({
        eqCode: equipment.eqCode,
        operCode: equipment.operCode || "",
        operNm: equipment.operNm || "",
        operUseYn: equipment.operUseYn || "",
        depCode: equipment.depCode || "",
        eqNm: equipment.eqNm || "",
        eqType: equipment.eqType || "",
        manufacturer: equipment.manufacturer || "",
        taskDesc: equipment.taskDesc || "",
        createdAt: formatDateTime(equipment.createdAt),
      });
    }
  }, [isEditing, equipment]);

  // 저장 처리
  const handleSave = async () => {
    if (!equipment || isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: EquipmentUpdateRequest = {
        operCode: form.operCode?.trim() ? form.operCode.trim() : null,
        eqNm: form.eqNm?.trim() ? form.eqNm.trim() : null,
        eqType: form.eqType?.trim() ? form.eqType.trim() : null,
        manufacturer: form.manufacturer?.trim() ? form.manufacturer.trim() : null,
      };

      const response = await EquipmentApi.update(equipment.eqCode, updatePayload);

      alert(response.message || "수정되었습니다.");
      await fetchEquipmentDetail();
      setIsEditing(false);
    } catch (err) {
      console.error("장비 수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 삭제 처리
  const handleDelete = async () => {
    if (!equipment || isDeleting) return;

    const confirmed = window.confirm(
      `${equipment.eqNm ?? equipment.eqCode} 장비를 삭제하시겠습니까?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await EquipmentApi.delete(equipment.eqCode);
      alert("장비가 삭제되었습니다.");
      navigate({ pathname: "/master/equipment", search: location.search });
    } catch (error) {
      console.error("장비 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(message || "장비 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && !equipment) {
    return (
      <section className="screenStack">
        <Panel title="장비 상세 정보">
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        </Panel>
      </section>
    );
  }

  if (!equipment) return null;

  return (
    <section className="screenStack">
      <Panel title={isEditing ? "장비 정보 수정" : "장비 상세 정보"}>
        <form className="pageForm" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {fields.map(({ label, key, editable }) => {
            const isFieldEditable = isEditing && editable !== false;

            // 공정코드 셀렉트박스 처리
            if (key === "operCode") {
              return (
                <div key={key} className="detailField">
                  <label>{label}</label>
                  {isFieldEditable ? (
                    <select
                      className="tableInput"
                      value={form[key] ?? ""}
                      disabled={isBusy}
                      onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    >
                      <option value="">공정을 선택해주세요</option>
                      {operationOptions.map((opt) => (
                        <option key={opt.operCode} value={opt.operCode}>
                          {opt.operCode} ({opt.operNm})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="detailValue">{form[key] || "-"}</div>
                  )}
                </div>
              );
            }

            // 사용여부 처리
            if (key === "operUseYn") {
              return (
                <div key={key} className="detailField">
                  <label>{label}</label>
                  {isFieldEditable ? (
                    <select
                      className="tableInput"
                      value={form[key] ?? ""}
                      disabled={isBusy}
                      onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    >
                      <option value="Y">사용</option>
                      <option value="N">미사용</option>
                    </select>
                  ) : (
                    <div className="detailValue">
                      {form[key] === "Y" ? "사용" : form[key] === "N" ? "미사용" : "-"}
                    </div>
                  )}
                </div>
              );
            }

            // 기본 input 처리
            return (
              <div key={key} className="detailField">
                <label>{label}</label>
                {isFieldEditable ? (
                  <input
                    className="tableInput"
                    value={form[key] ?? ""}
                    disabled={isBusy}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                ) : (
                  <div className="detailValue">{form[key] || "-"}</div>
                )}
              </div>
            );
          })}

          <div className="pageFormFooterSpaceBetween">
            <div>
              {isEditing && (
                <button
                  type="button"
                  className="dangerButton text-sm text-red-500 hover:underline px-2 py-1"
                  onClick={handleDelete}
                  disabled={isBusy}
                >
                  {isDeleting ? "삭제 처리 중..." : "장비 삭제"}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {isEditing ? (
                <>
                  <button type="button" className="ghostButton" onClick={() => setIsEditing(false)} disabled={isBusy}>취소</button>
                  <button type="button" className="primaryButton" onClick={handleSave} disabled={isBusy}>
                    {isUpdating ? "저장 중..." : "저장"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="ghostButton" onClick={() => navigate({ pathname: "/master/equipment", search: location.search })} disabled={isBusy}>목록</button>
                  <button type="button" className="primaryButton" onClick={() => setIsEditing(true)} disabled={isBusy}>수정</button>
                </>
              )}
            </div>
          </div>
        </form>
      </Panel>
    </section>
  );
}