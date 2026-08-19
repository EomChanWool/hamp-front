import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import type {
    FacilityDetailRespons,
    FacilityUpdateRequest,
    StatusType,
} from "@/api/equipment/Facility";
import { FacilityApi } from "@/api/equipment/Facility";
import { EquipmentApi } from "@/api/master/Equipment";
import { FactoryZoneApi } from "@/api/master/FactoryZone";
import Spinner from "@/components/common/Spinner";

type Field = {
    label: string;
    key: string;
    editable?: boolean;
};

export function EquipmentFacilityDetailPage() {
    const { fcltCode } = useParams<{ fcltCode: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const [facility, setFacility] = useState<FacilityDetailRespons | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState<Record<string, any>>({});

    // 옵션 데이터 상태 추가
    const [equipmentOptions, setEquipmentOptions] = useState<any[]>([]);
    const [factoryZoneOptions, setFactoryZoneOptions] = useState<any[]>([]);

    const isBusy = isUpdating || isDeleting;

    const fields: Field[] = [
        { label: "설비코드", key: "fcltCode", editable: false },
        { label: "장비코드", key: "eqCode", editable: true },
        { label: "장비명", key: "eqNm", editable: false },
        { label: "장비유형", key: "eqType", editable: false },
        { label: "공장코드", key: "facCode", editable: true },
        { label: "공장구역명", key: "facNm", editable: false },
        { label: "위치", key: "location", editable: false },
        { label: "설비명", key: "fcltNm", editable: true },
        { label: "현재상태", key: "currentStatus", editable: true },
        { label: "사용여부", key: "useYn", editable: true },
        { label: "등록일자", key: "createdAt", editable: false },
    ];

    // 옵션 목록 조회 함수
    const fetchOptions = async () => {
        try {
            const [eqRes, facRes] = await Promise.all([
                EquipmentApi.getOptions(),
                FactoryZoneApi.getOptions(),
            ]);
            setEquipmentOptions(eqRes.data ?? []);
            setFactoryZoneOptions(facRes.data ?? []);
        } catch (error) {
            console.error("옵션 목록 조회 실패:", error);
        }
    };

    // 상세 데이터 조회 함수 
    const fetchFacilityDetail = async () => {
        if (!fcltCode) return;
        setIsLoading(true);

        try {
            const response = await FacilityApi.getDetail(fcltCode);
            const fcltData = response.data;

            if (fcltData) {
                setFacility(fcltData);
                setForm({
                    fcltCode: fcltData.fcltCode,
                    eqCode: fcltData.eqCode || "",
                    eqNm: fcltData.eqNm || "",
                    eqType: fcltData.eqType || "",
                    facCode: fcltData.facCode || "",
                    facNm: fcltData.facNm || "",
                    location: fcltData.location || "",
                    fcltNm: fcltData.fcltNm || "",
                    currentStatus: fcltData.currentStatus ?? 1,
                    useYn: fcltData.useYn ?? true,
                    createdAt: formatDateTime(fcltData.createdAt),
                });
            }
        } catch (error) {
            console.error("설비 상세 조회 실패:", error);
            alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
            navigate({ pathname: "/equipment/facility", search: location.search });
        } finally {
            setIsLoading(false);
        }
    };

    // 상세 데이터 및 옵션 최초 조회
    useEffect(() => {
        if (fcltCode) {
            fetchFacilityDetail();
            fetchOptions();
        }
    }, [fcltCode]);

    // 수정 모드 취소 시 롤백
    useEffect(() => {
        if (facility && !isEditing) {
            setForm({
                fcltCode: facility.fcltCode,
                eqCode: facility.eqCode || "",
                eqNm: facility.eqNm || "",            
                eqType: facility.eqType || "",        
                facCode: facility.facCode || "",
                facNm: facility.facNm || "",          
                location: facility.location || "",    
                fcltNm: facility.fcltNm || "",
                currentStatus: facility.currentStatus ?? 1,
                useYn: facility.useYn ?? true,
                createdAt: formatDateTime(facility.createdAt),
            });
        }
    }, [isEditing, facility]);

    // 저장 처리 핸들러
    const handleSave = async () => {
        if (!facility || isUpdating) return;

        setIsUpdating(true);
        try {
            const updatePayload: FacilityUpdateRequest = {
                eqCode: form.eqCode?.trim() ? form.eqCode.trim() : null,
                facCode: form.facCode?.trim() ? form.facCode.trim() : null,
                fcltNm: form.fcltNm?.trim() ? form.fcltNm.trim() : null,
                currentStatus: form.currentStatus === "" ? null : Number(form.currentStatus) as StatusType,
                useYn: Boolean(form.useYn),
            };

            const response = await FacilityApi.update(facility.fcltCode, updatePayload);

            alert(response.message || "수정되었습니다.");

            // 수정 직후 서버에서 최신 데이터를 다시 조회하여 화면에 즉시 동기화
            await fetchFacilityDetail();

            setIsEditing(false);
        } catch (err) {
            console.error("설비 수정 실패:", err);
            const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
            alert(errorMessage || "수정에 실패했습니다.");
        } finally {
            setIsUpdating(false);
        }
    };

    // 설비 삭제 처리
    const handleDelete = async () => {
        if (!facility || isDeleting) return;

        const confirmed = window.confirm(
            `${facility.fcltNm ?? facility.fcltCode} 설비를 삭제하시겠습니까?`
        );
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            await FacilityApi.delete(facility.fcltCode);
            alert("설비가 삭제되었습니다.");
            navigate({ pathname: "/equipment/facility", search: location.search });
        } catch (error) {
            console.error("설비 삭제 실패:", error);
            const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
            alert(message || "설비 삭제에 실패했습니다.");
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading && !facility) {
        return (
            <section className="screenStack">
                <Panel title="설비 상세 정보">
                    <div> <Spinner /> </div>
                </Panel>
            </section>
        );
    }

    if (!facility) return null;

    return (
        <section className="screenStack">
            <Panel title={isEditing ? "설비 정보 수정" : "설비 상세 정보"}>
                <form className="pageForm" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    {fields.map(({ label, key, editable }) => {
                        const isFieldEditable = isEditing && editable !== false;

                        // 장비코드 셀렉트박스 처리 (수정 모드일 때)
                        if (key === "eqCode") {
                            return (
                                <div key={key} className="detailField">
                                    <label>{label}</label>
                                    {isFieldEditable ? (
                                        <select
                                            className="tableInput"
                                            value={form[key] ?? ""}
                                            disabled={isBusy}
                                            onChange={(e) =>
                                                setForm((prev) => ({ ...prev, [key]: e.target.value }))
                                            }
                                        >
                                            <option value="">장비를 선택해주세요</option>
                                            {equipmentOptions.map((opt) => (
                                                <option key={opt.eqCode} value={opt.eqCode}>
                                                    {opt.eqCode} ({opt.eqNm ?? '-'})
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="detailValue">
                                            {form[key] || "-"}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // 공장코드 셀렉트박스 처리 (수정 모드일 때)
                        if (key === "facCode") {
                            return (
                                <div key={key} className="detailField">
                                    <label>{label}</label>
                                    {isFieldEditable ? (
                                        <select
                                            className="tableInput"
                                            value={form[key] ?? ""}
                                            disabled={isBusy}
                                            onChange={(e) =>
                                                setForm((prev) => ({ ...prev, [key]: e.target.value }))
                                            }
                                        >
                                            <option value="">공장을 선택해주세요</option>
                                            {factoryZoneOptions.map((opt) => (
                                                <option key={opt.facCode} value={opt.facCode}>
                                                    {opt.facCode} ({opt.facNm ?? '-'})
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="detailValue">
                                            {form[key] || "-"}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // 현재상태 (0: 정지, 1: 작동, 2: 고장) 셀렉트박스 처리
                        if (key === "currentStatus") {
                            return (
                                <div key={key} className="detailField">
                                    <label>{label}</label>
                                    {isFieldEditable ? (
                                        <select
                                            className="tableInput"
                                            value={form[key] ?? 1}
                                            disabled={isBusy}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    [key]: e.target.value,
                                                }))
                                            }
                                        >
                                            <option value="0">정지</option>
                                            <option value="1">작동</option>
                                            <option value="2">고장</option>
                                        </select>
                                    ) : (
                                        <div className="detailValue">
                                            {form[key] === 0 || form[key] === "0" ? "정지" : form[key] === 1 || form[key] === "1" ? "작동" : form[key] === 2 || form[key] === "2" ? "고장" : "-"}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // 사용여부 (boolean) 셀렉트박스 처리
                        if (key === "useYn") {
                            return (
                                <div key={key} className="detailField">
                                    <label>{label}</label>
                                    {isFieldEditable ? (
                                        <select
                                            className="tableInput"
                                            value={form[key] ? "true" : "false"}
                                            disabled={isBusy}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    [key]: e.target.value === "true",
                                                }))
                                            }
                                        >
                                            <option value="true">사용</option>
                                            <option value="false">미사용</option>
                                        </select>
                                    ) : (
                                        <div className="detailValue">
                                            {form[key] ? "사용" : "미사용"}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div key={key} className="detailField">
                                <label>{label}</label>

                                {isFieldEditable ? (
                                    <input
                                        className="tableInput"
                                        value={form[key] ?? ""}
                                        disabled={isBusy}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                [key]: e.target.value,
                                            }))
                                        }
                                    />
                                ) : (
                                    <div className="detailValue">
                                        {form[key] || "-"}
                                    </div>
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
                                    {isDeleting ? "삭제 처리 중..." : "설비 삭제"}
                                </button>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            {isEditing ? (
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
                                        onClick={() => navigate({ pathname: "/equipment/facility", search: location.search })}
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
                            )}
                        </div>
                    </div>
                </form>
            </Panel>
        </section>
    );
}