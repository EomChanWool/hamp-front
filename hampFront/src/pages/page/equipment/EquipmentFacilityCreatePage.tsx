import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react";
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
import type { UserOptionResponse } from "@/api/User";
import { UserApi } from "@/api/User";
import { AttachmentApi } from "@/api/Attachment";
import { useImageGallery } from "@/hooks/useImageGallery";
import ImageGallery from "@components/common/ImageGallery";
import ImageModal from "@components/modal/ImageModal";
import UserMultiSelect from "@components/common/UserMultiSelect";
import { SelectBox, type SelectBoxOption } from "@/components/common/SelectBox";
import "@/pages/layout/Layout.css";

const STATUS_OPTIONS: SelectBoxOption[] = [
    { value: "0", label: "정지" },
    { value: "1", label: "작동" },
    { value: "2", label: "고장" },
];

// 요약 패널의 상태 칩 색상 (정지: 기본 / 작동: isOn / 고장: isError)
const STATUS_CHIP: Record<string, string> = {
    "0": "",
    "1": "isOn",
    "2": "isError",
};

const USE_OPTIONS: SelectBoxOption[] = [
    { value: "true", label: "사용" },
    { value: "false", label: "미사용" },
];

type SummaryRow = {
    label: string;
    value: string;
    /** 값이 있으면 칩 형태로 표시 (상태용) */
    chip?: string;
};

export function EquipmentFacilityCreatePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [factoryZoneOptions, setFactoryZoneOptions] = useState<FactoryZoneOptionResponse[]>([]);
    const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOptionResponse[]>([]);
    const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 전체 화면 이미지 확대 모달 열림/닫힘 상태 관리
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 설비 이미지 상태 및 조작 로직은 useImageGallery 훅 하나로 관리한다.
    const gallery = useImageGallery();

    const fetchOptions = useCallback(async () => {
        try {
            const [eqRes, facRes, userRes] = await Promise.all([
                EquipmentApi.getOptions(),
                FactoryZoneApi.getOptions(),
                UserApi.getOptions()
            ]);
            setEquipmentOptions(eqRes.data ?? []);
            setFactoryZoneOptions(facRes.data ?? []);
            setUserOptions(userRes.data ?? []);
        } catch (error) {
            console.error("옵션 목록 조회 실패:", error);
        }
    }, []);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    // 폼 상태 관리 (managerUserId -> managerUserIds 배열 형태로 변경)
    const [form, setForm] = useState<{
        fcltCode: string;
        eqCode: string;
        facCode: string;
        fcltNm: string;
        currentStatus: StatusType | "";
        useYn: boolean;
        managerUserIds: string[];
    }>({
        fcltCode: "",
        eqCode: "",
        facCode: "",
        fcltNm: "",
        currentStatus: 1,
        useYn: true,
        managerUserIds: [],
    });

    // SelectBox용 옵션 (이름 + 코드 2줄 표기)
    const equipmentSelectOptions = useMemo<SelectBoxOption[]>(
        () =>
            equipmentOptions.map((option) => ({
                value: option.eqCode,
                label: option.eqNm ?? option.eqCode,
                description: option.eqCode,
            })),
        [equipmentOptions]
    );

    const factorySelectOptions = useMemo<SelectBoxOption[]>(
        () =>
            factoryZoneOptions.map((option) => ({
                value: option.facCode,
                label: option.facNm ?? option.facCode,
                description: option.facCode,
            })),
        [factoryZoneOptions]
    );

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

        const managers = form.managerUserIds.map((userId) => ({ userId }));

        const payload: FacilityCreateRequest = {
            fcltCode: form.fcltCode.trim(),
            eqCode: form.eqCode.trim() || null,
            facCode: form.facCode.trim() || null,
            fcltNm: form.fcltNm.trim() || null,
            currentStatus: form.currentStatus === "" ? null : Number(form.currentStatus) as StatusType,
            useYn: form.useYn,
            managers: managers,
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
            const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
            alert(message || "설비 등록 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ---- 요약 패널용 파생 값 ----
    const selectedEquipment = equipmentOptions.find((option) => option.eqCode === form.eqCode);
    const selectedFactory = factoryZoneOptions.find((option) => option.facCode === form.facCode);
    const statusKey = String(form.currentStatus);
    const statusLabel = STATUS_OPTIONS.find((option) => option.value === statusKey)?.label ?? "";

    const summaryRows: SummaryRow[] = [
        { label: "설비코드", value: form.fcltCode.trim() },
        { label: "설비명", value: form.fcltNm.trim() },
        { label: "현재상태", value: statusLabel, chip: STATUS_CHIP[statusKey] ?? "" },
        { label: "사용여부", value: form.useYn ? "사용" : "미사용" },
        { label: "장비", value: selectedEquipment?.eqNm ?? "" },
        { label: "공장", value: selectedFactory?.facNm ?? "" },
        { label: "담당자", value: `${form.managerUserIds.length}명` },
        { label: "이미지", value: `${gallery.newFiles.length}장` },
    ];

    return (
        <section className="screenStack">
            <form className="formPage" onSubmit={handleSubmit}>
                <div className="formPageHead">
                    <h1 className="formPageTitle">신규 설비 등록</h1>
                    <span className="formPageMeta">
                        <span className="required" aria-hidden="true">*</span> 표시는 필수 입력 항목입니다
                    </span>
                </div>

                <div className="formLayout formLayout--media">
                    {/* ===== 좌측: 입력 섹션 카드 ===== */}
                    <div className="formMain">
                        {/* 1. 기본정보 */}
                        <section className="formCard" aria-labelledby="fclt-sec-basic">
                            <div className="formCardHead">
                                <div>
                                    <h2 className="formCardTitle" id="fclt-sec-basic">기본정보</h2>
                                    <p className="formCardDesc">설비를 구분하는 코드와 이름, 운영 상태를 입력합니다.</p>
                                </div>
                            </div>

                            <div className="formGrid">
                                <div className="formField col3">
                                    <label className="formLabel" htmlFor="fclt-code">
                                        설비코드 <span className="required" aria-hidden="true">*</span>
                                    </label>
                                    <input
                                        id="fclt-code"
                                        className="formInput"
                                        value={form.fcltCode}
                                        disabled={isSubmitting}
                                        onChange={(e) => handleChange("fcltCode", e.target.value)}
                                        placeholder="예: FCLT001"
                                        maxLength={30}
                                    />
                                </div>

                                <div className="formField col3">
                                    <label className="formLabel" htmlFor="fclt-name">설비명</label>
                                    <input
                                        id="fclt-name"
                                        className="formInput"
                                        value={form.fcltNm}
                                        disabled={isSubmitting}
                                        onChange={(e) => handleChange("fcltNm", e.target.value)}
                                        maxLength={100}
                                        placeholder="예) HEMP 추출기"
                                    />
                                </div>

                                <div className="formField col3">
                                    <label className="formLabel" htmlFor="fclt-status">현재상태</label>
                                    <SelectBox
                                        id="fclt-status"
                                        value={statusKey}
                                        options={STATUS_OPTIONS}
                                        disabled={isSubmitting}
                                        onChange={(v) => handleChange("currentStatus", v)}
                                    />
                                </div>

                                <div className="formField col3">
                                    <label className="formLabel" htmlFor="fclt-use">사용여부</label>
                                    <SelectBox
                                        id="fclt-use"
                                        value={form.useYn ? "true" : "false"}
                                        options={USE_OPTIONS}
                                        disabled={isSubmitting}
                                        onChange={(v) => handleChange("useYn", v === "true")}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* 2. 장비/공장 정보 */}
                        <section className="formCard" aria-labelledby="fclt-sec-place">
                            <div className="formCardHead">
                                <div>
                                    <h2 className="formCardTitle" id="fclt-sec-place">장비/공장 정보</h2>
                                    <p className="formCardDesc">설비가 속한 장비와 공장을 선택합니다.</p>
                                </div>
                            </div>

                            <div className="formGrid">
                                <div className="formField col3">
                                    <label className="formLabel" htmlFor="fclt-eq">장비명</label>
                                    <SelectBox
                                        id="fclt-eq"
                                        value={form.eqCode}
                                        options={equipmentSelectOptions}
                                        placeholder="장비를 선택해주세요"
                                        searchPlaceholder="장비명 또는 코드 검색"
                                        clearLabel="선택 안 함"
                                        searchable
                                        disabled={isSubmitting}
                                        onChange={(v) => handleChange("eqCode", v)}
                                    />
                                </div>

                                <div className="formField col3">
                                    <label className="formLabel" htmlFor="fclt-fac">공장명</label>
                                    <SelectBox
                                        id="fclt-fac"
                                        value={form.facCode}
                                        options={factorySelectOptions}
                                        placeholder="공장을 선택해주세요"
                                        searchPlaceholder="공장명 또는 코드 검색"
                                        clearLabel="선택 안 함"
                                        searchable
                                        disabled={isSubmitting}
                                        onChange={(v) => handleChange("facCode", v)}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* 3. 담당자 */}
                        <section className="formCard" aria-labelledby="fclt-sec-manager">
                            <div className="formCardHead">
                                <div>
                                    <h2 className="formCardTitle" id="fclt-sec-manager">담당자</h2>
                                    <p className="formCardDesc">설비를 관리할 담당자를 선택합니다. 여러 명을 선택할 수 있습니다.</p>
                                </div>
                                <span className="formCardMeta">
                                    총 {userOptions.length}명 중 {form.managerUserIds.length}명 선택
                                </span>
                            </div>

                            <UserMultiSelect
                                options={userOptions}
                                value={form.managerUserIds}
                                onChange={(userIds) => handleChange("managerUserIds", userIds)}
                                disabled={isSubmitting}
                            />
                        </section>
                    </div>

                    {/* ===== 우측: 이미지 미리보기 + 요약 + 액션 ===== */}
                    <aside className="formCard formAside" aria-label="설비 이미지 및 요약">
                        <section className="formAsideSection" aria-labelledby="fclt-media-title">
                            <h2 className="formCardTitle" id="fclt-media-title">설비 이미지</h2>
                            <div className="formMedia">
                                <ImageGallery
                                    images={gallery.images}
                                    activeIndex={gallery.activeIndex}
                                    onActiveIndexChange={gallery.setActiveIndex}
                                    onFilesSelected={gallery.addFiles}
                                    onRemove={gallery.removeAt}
                                    title="설비 이미지"
                                    showHeader={false}
                                    onPreviewClick={() => setIsModalOpen(true)}
                                />
                            </div>
                        </section>

                        <section className="formAsideSection" aria-labelledby="fclt-summary-title">
                            <h2 className="formCardTitle" id="fclt-summary-title">설비 요약</h2>
                            <dl className="formSummaryList">
                                {summaryRows.map((row) => (
                                    <div className="formSummaryRow" key={row.label}>
                                        <dt>{row.label}</dt>
                                        <dd className={row.value ? undefined : "isEmpty"}>
                                            {row.value && row.chip !== undefined ? (
                                                <span className={`formStatus${row.chip ? ` ${row.chip}` : ""}`}>
                                                    {row.value}
                                                </span>
                                            ) : (
                                                row.value || "미입력"
                                            )}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </section>

                        <div className="formActions">
                            <button type="submit" className="primaryButton" disabled={isSubmitting}>
                                {isSubmitting ? "등록 중..." : "등록"}
                            </button>
                            <button
                                type="button"
                                className="ghostButton"
                                onClick={handleCancel}
                                disabled={isSubmitting}
                            >
                                취소
                            </button>
                        </div>
                    </aside>
                </div>
            </form>

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