import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import type {
    FacilityCreateRequest,
    StatusType
} from "@/api/equipment/Facility";
import { FacilityApi } from "@/api/equipment/Facility";
import type { EquipmentOptionResponse } from "@/api/master/Equipment";
import { EquipmentApi } from "@/api/master/Equipment";
import type { FactoryZoneOptionResponse } from "@/api/master/FactoryZone";
import { FactoryZoneApi } from "@/api/master/FactoryZone";
import { AttachmentApi } from "@/api/Attachment";
import { useImageGallery } from "@/hooks/useImageGallery";
import ImageGallery from "@components/common/ImageGallery";
import ImageModal from "@components/modal/ImageModal"; 

export function EquipmentFacilityCreatePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [factoryZoneOptions, setFactoryZoneOptions] = useState<FactoryZoneOptionResponse[]>([]);
    const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOptionResponse[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 전체 화면 이미지 확대 모달 열림/닫힘 상태 관리
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 설비 이미지 상태 및 조작 로직은 useImageGallery 훅 하나로 관리한다.
    const gallery = useImageGallery();

    const fetchOptions = useCallback(async () => {
        try {
            const [eqRes, facRes] = await Promise.all([
                EquipmentApi.getOptions(),
                FactoryZoneApi.getOptions()
            ]);
            setEquipmentOptions(eqRes.data ?? []);
            setFactoryZoneOptions(facRes.data ?? []);
        } catch (error) {
            console.error("옵션 목록 조회 실패:", error);
        }
    }, []);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    // 폼 상태 관리
    const [form, setForm] = useState<{
        fcltCode: string;
        eqCode: string;
        facCode: string;
        fcltNm: string;
        currentStatus: StatusType | "";
        useYn: boolean;
    }>({
        fcltCode: "",
        eqCode: "",
        facCode: "",
        fcltNm: "",
        currentStatus: 1,
        useYn: true,
    });

    const handleChange = (key: string, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleCancel = () => {
        const queryString = searchParams.toString();
        navigate(queryString ? `/equipment/facility?${queryString}` : "/equipment/facility");
    };

    const validateForm = (): boolean => {
        const trimmedCode = form.fcltCode.trim();
        if (!trimmedCode) {
            alert("설비 코드를 입력해주세요.");
            return false;
        }
        if (trimmedCode.length > 30) {
            alert("설비 코드는 최대 30자까지 입력 가능합니다.");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: SyntheticEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        const payload: FacilityCreateRequest = {
            fcltCode: form.fcltCode.trim(),
            eqCode: form.eqCode.trim() || null,
            facCode: form.facCode.trim() || null,
            fcltNm: form.fcltNm.trim() || null,
            currentStatus: form.currentStatus === "" ? null : Number(form.currentStatus) as StatusType,
            useYn: form.useYn,
        };

        setIsSubmitting(true);
        try {
            // 1단계: 순수 JSON 데이터 등록 API 먼저 호출
            await FacilityApi.create(payload);

            // 2단계: JSON 저장이 성공한 경우에만 첨부파일이 있다면 공용 AttachmentApi.upload를 호출
            if (gallery.newFiles.length > 0) {
                const results = await Promise.allSettled(
                    gallery.newFiles.map((file) => AttachmentApi.upload(file, payload.fcltCode, "IMAGE"))
                );

                const failedNames = results
                    .map((result, index) => (result.status === "rejected" ? gallery.newFiles[index].name : null))
                    .filter((name): name is string => name !== null);

                if (failedNames.length > 0) {
                    console.error("이미지 업로드 실패:", failedNames);
                    alert(
                        `설비 데이터는 안전하게 저장되었습니다.\n` +
                        `다만 이미지 ${gallery.newFiles.length}장 중 ${failedNames.length}장 업로드에 실패했습니다:\n` +
                        `- ${failedNames.join('\n- ')}\n` +
                        `상세 페이지에서 재시도해주세요.`
                    );
                    navigate(`/equipment/facility/${payload.fcltCode}`, { replace: true });
                    return;
                }
            }

            alert("성공적으로 등록되었습니다.");
            navigate("/equipment/facility", { replace: true });
        } catch (error) {
            console.error("설비 등록 실패:", error);
            // 3단계: JSON 등록 실패 시 파일 업로드는 시도되지 않음
            const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
            alert(message || "설비 등록 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="screenStack">
            <div className="createCard">
                <div className="createHeader">
                    <h1 className="createTitle">신규 설비 등록</h1>
                    <span className="createMeta">* 표시는 필수 입력 항목입니다</span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="createBody">
                        <div className="createSection">
                            <h2 className="createSectionTitle">설비정보</h2>
                            <div className="createGrid2Cols">
                                <div className="createField">
                                    <label className="requiredLabel">설비코드 <span className="required">*</span></label>
                                    <input className="tableInput" value={form.fcltCode} disabled={isSubmitting} onChange={(e) => handleChange("fcltCode", e.target.value)} placeholder="예: FCLT001" maxLength={30} />
                                </div>

                                <div className="createField">
                                    <label>설비명</label>
                                    <input className="tableInput" value={form.fcltNm} disabled={isSubmitting} onChange={(e) => handleChange("fcltNm", e.target.value)} maxLength={100} />
                                </div>

                                <div className="createField">
                                    <label>현재상태</label>
                                    <select className="tableInput" value={form.currentStatus} disabled={isSubmitting} onChange={(e) => handleChange("currentStatus", e.target.value)}>
                                        <option value="0">정지</option>
                                        <option value="1">작동</option>
                                        <option value="2">고장</option>
                                    </select>
                                </div>

                                <div className="createField">
                                    <label>사용여부</label>
                                    <select className="tableInput" value={form.useYn ? "true" : "false"} disabled={isSubmitting} onChange={(e) => handleChange("useYn", e.target.value === "true")}>
                                        <option value="true">사용</option>
                                        <option value="false">미사용</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="createSection">
                            <h2 className="createSectionTitle">장비/공장 정보</h2>
                            <div className="createGrid2Cols">
                                <div className="createField">
                                    <label>장비코드</label>
                                    <select className="tableInput" value={form.eqCode} disabled={isSubmitting} onChange={(e) => handleChange("eqCode", e.target.value)}>
                                        <option value="">장비를 선택해주세요</option>
                                        {equipmentOptions.map((option) => (
                                            <option key={option.eqCode} value={option.eqCode}>{option.eqCode} ({option.eqNm})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="createField">
                                    <label>공장코드</label>
                                    <select className="tableInput" value={form.facCode} disabled={isSubmitting} onChange={(e) => handleChange("facCode", e.target.value)}>
                                        <option value="">공장을 선택해주세요</option>
                                        {factoryZoneOptions.map((option) => (
                                            <option key={option.facCode} value={option.facCode}>{option.facCode} ({option.facNm})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 설비 이미지: ImageGallery 하나로 대체. 이미지가 없으면 드롭존, 있으면 캐러셀이 자동으로 표시 */}
                        <div className="createSection">
                            <div className="createField" style={{ gridColumn: '1 / -1' }}>
                                <ImageGallery
                                    images={gallery.images}
                                    activeIndex={gallery.activeIndex}
                                    onActiveIndexChange={gallery.setActiveIndex}
                                    onFilesSelected={gallery.addFiles}
                                    onRemove={gallery.removeAt}
                                    title="설비 이미지"
                                    showHeader={true}
                                    onPreviewClick={() => setIsModalOpen(true)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="createFooter">
                        <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>취소</button>
                        <button type="submit" className="primaryButton" disabled={isSubmitting}>{isSubmitting ? "등록 중..." : "등록"}</button>
                    </div>
                </form>
            </div>

            {isModalOpen && (
                <ImageModal
                    images={gallery.images}
                    initialIndex={gallery.activeIndex}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </section>
    );
}