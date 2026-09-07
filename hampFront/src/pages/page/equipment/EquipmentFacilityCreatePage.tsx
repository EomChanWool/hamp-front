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

    // 설비 이미지 다중 파일 상태 및 미리보기 URL 배열 상태
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
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

    // 이미지 다중 선택 및 검증 처리 함수
    const handleImagesSelect = (incomingFiles: FileList | File[]) => {
        const validFiles: File[] = [];
        const newUrls: string[] = [];

        Array.from(incomingFiles).forEach((file) => {
            const ext = getExt(file.name);

            if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
                alert(`이미지 파일만 업로드 가능합니다. (${file.name})\n- 허용 확장자: ${ALLOWED_IMAGE_EXTENSIONS.join(', ').toUpperCase()}`);
                return;
            }

            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                alert(`파일 용량은 최대 ${MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다. (${file.name})`);
                return;
            }

            validFiles.push(file);
            newUrls.push(URL.createObjectURL(file));
        });

        if (validFiles.length > 0) {
            setAttachedFiles((prev) => [...prev, ...validFiles]);
            setPreviewUrls((prev) => [...prev, ...newUrls]);
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // 개별 신규 파일 제거 함수
    const handleRemoveImage = (index: number) => {
        URL.revokeObjectURL(previewUrls[index]);
        setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
        setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
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
            handleImagesSelect(e.dataTransfer.files);
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
            // 1단계: 순수 JSON 데이터 등록 API 먼저 호출
            await FacilityApi.create(payload);

            // 2단계: JSON 저장이 성공한 경우에만 첨부파일이 있다면 순차 업로드 (category: "IMAGE" 지정)
            if (attachedFiles.length > 0) {
                for (const file of attachedFiles) {
                    try {
                        await FacilityApi.uploadAttachment(payload.fcltCode, file, "IMAGE");
                    } catch (fileError) {
                        console.error(`파일 업로드 실패 (${file.name}):`, fileError);
                        alert(`설비 데이터는 안전하게 저장되었습니다.\n하지만 일부 파일(${file.name}) 업로드에 실패했습니다.\n상세 페이지에서 재시도해주세요.`);
                        navigate(`/equipment/facility/${payload.fcltCode}`, { replace: true });
                        return;
                    }
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

                        {/* 설비 이미지 다중 업로드 및 드래그 영역 내부 썸네일 미리보기 섹션 */}
                        <div className="createSection">
                            <h2 className="createSectionTitle">설비 이미지</h2>
                            <div className="createField" style={{ gridColumn: '1 / -1' }}>
                                <label className="cus-input-label" style={{ marginBottom: '8px', display: 'block' }}>설비 이미지 첨부</label>

                                <div
                                    className={`file-drop-zone facility-image-drop-zone ${isDragging ? ' file-drop-zone--dragging' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: '180px',
                                        padding: '20px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {previewUrls.length === 0 ? (
                                        <div className="facility-upload-placeholder" style={{ textAlign: 'center' }}>
                                            <Remix iconName="image-line" iconSize={2.3} color="#64748b" />
                                            <span className="file-drop-zone__main-text" style={{ display: 'block', marginTop: '8px' }}>이미지 파일을 마우스로 끌어다 놓으세요.</span>
                                            <span className="facility-upload-subtext" style={{ display: 'block', marginBottom: '12px', color: '#888', fontSize: '13px' }}>지원 형식: JPG, JPEG, PNG, GIF (최대 20MB, 다중 선택 가능)</span>
                                            <CustomButton
                                                prefixType="ghost"
                                                iconPosition="text"
                                                onClick={(e?: SyntheticEvent) => {
                                                    e?.stopPropagation();
                                                    fileInputRef.current?.click();
                                                }}
                                            >
                                                이미지 선택
                                            </CustomButton>
                                        </div>
                                    ) : (
                                        <div style={{ width: '100%' }} onClick={(e) => e.stopPropagation()}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', width: '100%' }}>
                                                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                                                    선택된 이미지 ({previewUrls.length}개) - 추가로 파일을 끌어다 놓거나, 우측 이미지 추가 버튼을 클릭하세요.
                                                </span>
                                                <button
                                                    type="button"
                                                    className="ghostButton"
                                                    style={{ fontSize: '12px', padding: '4px 8px', height: 'auto' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        fileInputRef.current?.click();
                                                    }}
                                                >
                                                    이미지 추가
                                                </button>
                                            </div>

                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                                {previewUrls.map((url, index) => (
                                                    <div 
                                                        key={index} 
                                                        className="facility-preview-wrapper" 
                                                        style={{ width: '110px', position: 'relative' }}
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`미리보기 ${index}`}
                                                            className="facility-preview-img"
                                                            style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveImage(index);
                                                            }}
                                                            className="facility-preview-remove-btn"
                                                            title="미리보기 삭제"
                                                            style={{
                                                                position: 'absolute',
                                                                top: '4px',
                                                                right: '4px',
                                                                background: 'rgba(0,0,0,0.6)',
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: '50%',
                                                                width: '22px',
                                                                height: '22px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            ✕
                                                        </button>
                                                        <div 
                                                            className="facility-preview-name"
                                                            style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px', textAlign: 'center', color: '#475569' }}
                                                        >
                                                            {attachedFiles[index]?.name}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/png, image/jpeg, image/jpg, image/gif"
                                        style={{ display: 'none' }}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            if (e?.target?.files) {
                                                handleImagesSelect(e.target.files);
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