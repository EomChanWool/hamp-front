import { useCallback, useEffect, useState, type SyntheticEvent, useRef, type DragEvent } from "react";
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
import Remix from '@components/common/Remix';
import CustomButton from '@/components/button/CustomButton';

// 허용된 이미지 확장자 목록
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];
const MAX_FILE_SIZE_MB = 20;

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

export function EquipmentFacilityCreatePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [factoryZoneOptions, setFactoryZoneOptions] = useState<FactoryZoneOptionResponse[]>([]);
    const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOptionResponse[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // 설비 이미지 파일 상태 및 미리보기 URL 상태
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // 이미지 파일 처리 및 미리보기 생성 함수
    const handleImageSelect = (file: File) => {
        const ext = getExt(file.name);

        if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
            alert(`이미지 파일만 업로드 가능합니다. (${file.name})\n- 허용 확장자: ${ALLOWED_IMAGE_EXTENSIONS.join(', ').toUpperCase()}`);
            return;
        }

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            alert(`파일 용량은 최대 ${MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다.`);
            return;
        }

        // 기존 미리보기 URL 메모리 해제
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setAttachedFile(file);
        setPreviewUrl(URL.createObjectURL(file));

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveImage = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setAttachedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImageSelect(e.dataTransfer.files[0]);
        }
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
            if (attachedFile) {
                await FacilityApi.createWithFiles(payload, [attachedFile]);
            } else {
                await FacilityApi.create(payload);
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

                        {/* 설비 이미지 업로드 및 미리보기 섹션 */}
                        <div className="createSection">
                            <h2 className="createSectionTitle">설비 이미지</h2>
                            <div className="createField" style={{ gridColumn: '1 / -1' }}>
                                <label className="cus-input-label" style={{ marginBottom: '8px', display: 'block' }}>설비 대표 이미지 첨부</label>
                                
                                <div 
                                    className={`file-drop-zone facility-image-drop-zone ${isDragging ? ' file-drop-zone--dragging' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    {previewUrl ? (
                                        <div className="facility-preview-wrapper" onClick={(e) => e.stopPropagation()}>
                                            <img 
                                                src={previewUrl} 
                                                alt="설비 미리보기" 
                                                className="facility-preview-img"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={handleRemoveImage}
                                                className="facility-preview-remove-btn"
                                                title="이미지 삭제"
                                            >
                                                ✕
                                            </button>
                                            <p className="facility-preview-name">{attachedFile?.name}</p>
                                        </div>
                                    ) : (
                                        <div className="facility-upload-placeholder">
                                            <Remix iconName="image-line" iconSize={2.3} color="#64748b" />
                                            <span className="file-drop-zone__main-text">이미지 파일을 마우스로 끌어다 놓으세요.</span>
                                            <span className="facility-upload-subtext">지원 형식: JPG, JPEG, PNG, GIF (최대 20MB)</span>
                                            <CustomButton prefixType="ghost" iconPosition="text" onClick={() => fileInputRef.current?.click()}>
                                                이미지 선택
                                            </CustomButton>
                                        </div>
                                    )}

                                    <input 
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png, image/jpeg, image/jpg, image/gif"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                handleImageSelect(e.target.files[0]);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="createFooter">
                        <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>취소</button>
                        <button type="submit" className="primaryButton" disabled={isSubmitting}>{isSubmitting ? "등록 중..." : "등록"}</button>
                    </div>
                </form>
            </div>
        </section>
    );
}

export default EquipmentFacilityCreatePage;