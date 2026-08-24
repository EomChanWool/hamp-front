import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";

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

  // 섹션 정의: 공정 정보 / 장비 정보로 그룹핑
  const sections: DetailSection<EquipmentDetailResponse>[] = [
    {
      title: "장비 정보",
      fields: [
        { label: "장비명", key: "eqNm", editable: true },
        { label: "장비유형", key: "eqType", editable: true },
        { label: "제조사", key: "manufacturer", editable: true },
      ],
    },
    {
      title: "공정 정보",
      fields: [
        {
          label: "공정코드",
          key: "operCode",
          editable: true,
          renderEditor: (value, onChange, disabled) => (
            <select
              className="tableInput"
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">공정을 선택해주세요</option>
              {operationOptions.map((opt) => (
                <option key={opt.operCode} value={opt.operCode}>
                  {opt.operCode} ({opt.operNm})
                </option>
              ))}
            </select>
          ),
        },
        { label: "공정명", key: "operNm", editable: false },
        {
          label: "공정사용여부",
          key: "operUseYn",
          editable: false,
          renderValue: (value) => (value === "Y" ? "사용" : value === "N" ? "미사용" : "-"),
        },
      ],
    },
    {
      title: "부서 정보",
      fields: [
        { label: "부서코드", key: "depCode", editable: false },
        { label: "작업설명", key: "taskDesc", editable: false },
      ],
    },
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
        <div className="detailCard">
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        </div>
      </section>
    );
  }

  if (!equipment) return null;

  return (
    <section className="screenStack">
      <DetailLayout
        title={equipment.eqNm}
        subtitle={form.eqCode}
        meta={`등록일 ${form.createdAt}`}
        sections={sections}
        form={form}
        isEditing={isEditing}
        isBusy={isBusy}
        onChangeField={(key, val) => setForm((prev) => ({ ...prev, [key]: val }))}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        footerLeft={
          isEditing && (
            <button
              type="button"
              className="btnDanger"
              onClick={handleDelete}
              disabled={isBusy}
            >
              {isDeleting ? "삭제 처리 중..." : "장비 삭제"}
            </button>
          )
        }
        footerRight={
          isEditing ? (
            <>
              <button
                type="button"
                className="ghostButton"
                onClick={() => setIsEditing(false)}
                disabled={isBusy}
              >
                취소
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={handleSave}
                disabled={isBusy}
              >
                {isUpdating ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghostButton"
                onClick={() =>
                  navigate({ pathname: "/master/equipment", search: location.search })
                }
                disabled={isBusy}
              >
                목록
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => setIsEditing(true)}
                disabled={isBusy}
              >
                수정
              </button>
            </>
          )
        }
      />
    </section>
  );
}
