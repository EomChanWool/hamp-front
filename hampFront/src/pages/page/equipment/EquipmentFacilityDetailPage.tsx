import { useCallback, useEffect, useState, type SyntheticEvent, useRef, type DragEvent } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import type {
  FacilityDetailResponse,
  FacilityUpdateRequest,
  StatusType,
} from "@/api/equipment/Facility";
import { FacilityApi, STATUS_TYPE_LABEL } from "@/api/equipment/Facility";
import { EquipmentApi } from "@/api/master/Equipment";
import { FactoryZoneApi } from "@/api/master/FactoryZone";
import Spinner from "@/components/common/Spinner";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";
import Remix from "@/components/common/Remix";
import { apiClient } from "@/api/apiClient";
import CustomButton from "@/components/button/CustomButton";

const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];
const MAX_FILE_SIZE_MB = 20;

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

export function EquipmentFacilityDetailPage() {
  const { fcltCode } = useParams<{ fcltCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [facility, setFacility] = useState<FacilityDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  // 옵션 데이터 상태
  const [equipmentOptions, setEquipmentOptions] = useState<any[]>([]);
  const [factoryZoneOptions, setFactoryZoneOptions] = useState<any[]>([]);

  // 첨부파일 관련 상태 (기존 첨부파일 및 신규 추가 다중 파일/미리보기)
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  
  // [추가] 서버에 등록된 기존 이미지들의 Blob URL을 관리하는 상태 (key: attachmentId, value: blobUrl)
  const [existingImageUrls, setExistingImageUrls] = useState<Record<number, string>>({});

  const [newAttachedFiles, setNewAttachedFiles] = useState<File[]>([]);
  const [newPreviewUrls, setNewPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isUpdating || isDeleting;

  // 섹션 정의
  const sections: DetailSection<FacilityDetailResponse>[] = [
    {
      title: "설비 정보",
      fields: [
        { label: "설비명", key: "fcltNm", editable: true },
        {
          label: "현재상태",
          key: "currentStatus",
          editable: true,
          fullWidth: true,
          renderEditor: (value, onChange, disabled) => (
            <select
              className="tableInput"
              value={value || "1"}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="0">정지</option>
              <option value="1">작동</option>
              <option value="2">고장</option>
            </select>
          ),
          renderValue: (value) => STATUS_TYPE_LABEL[Number(value) as StatusType] ?? "-",
        },
        {
          label: "사용여부",
          key: "useYn",
          editable: true,
          renderEditor: (value, onChange, disabled) => (
            <select
              className="tableInput"
              value={value === "true" ? "true" : "false"}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="true">사용</option>
              <option value="false">미사용</option>
            </select>
          ),
          renderValue: (value) => (value === "true" ? "사용" : "미사용"),
        },
      ],
    },
    {
      title: "장비 정보",
      fields: [
        {
          label: "장비코드",
          key: "eqCode",
          editable: true,
          renderEditor: (value, onChange, disabled) => (
            <select
              className="tableInput"
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">장비를 선택해주세요</option>
              {equipmentOptions.map((opt) => (
                <option key={opt.eqCode} value={opt.eqCode}>
                  {opt.eqCode} ({opt.eqNm ?? "-"})
                </option>
              ))}
            </select>
          ),
        },
        { label: "장비명", key: "eqNm", editable: false },
        { label: "장비유형", key: "eqType", editable: false },
      ],
    },
    {
      title: "공장 정보",
      fields: [
        {
          label: "공장코드",
          key: "facCode",
          editable: true,
          renderEditor: (value, onChange, disabled) => (
            <select
              className="tableInput"
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">공장을 선택해주세요</option>
              {factoryZoneOptions.map((opt) => (
                <option key={opt.facCode} value={opt.facCode}>
                  {opt.facCode} ({opt.facNm ?? "-"})
                </option>
              ))}
            </select>
          ),
        },
        { label: "공장구역명", key: "facNm", editable: false },
        { label: "위치", key: "location", editable: false },
      ],
    },
  ];

  const fetchOptions = useCallback(async () => {
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
  }, []);

  const fetchFacilityDetail = useCallback(async () => {
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
          currentStatus: String(fcltData.currentStatus ?? 1),
          useYn: fcltData.useYn ? "true" : "false",
          createdAt: formatDateTime(fcltData.createdAt),
        });
        setExistingAttachments(fcltData.attachments ?? []);
      }
    } catch (error) {
      console.error("설비 상세 조회 실패:", error);
      alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
      navigate({ pathname: "/equipment/facility", search: location.search });
    } finally {
      setIsLoading(false);
    }
  }, [fcltCode, navigate, location.search]);

  useEffect(() => {
    if (fcltCode) {
      fetchFacilityDetail();
      fetchOptions();
    }
  }, [fcltCode, fetchFacilityDetail, fetchOptions]);

  // [추가] existingAttachments가 변경될 때 서버에서 이미지를 Blob으로 다운로드하여 미리보기 URL 생성
  useEffect(() => {
    if (!existingAttachments || existingAttachments.length === 0) {
      setExistingImageUrls({});
      return;
    }

    const urls: Record<number, string> = {};
    let isMounted = true;

    const fetchExistingImages = async () => {
      for (const file of existingAttachments) {
        try {
          const response = await apiClient.get(`/attachments/${file.attachmentId}/download`, {
            responseType: 'blob',
          });
          const blob = new Blob([response.data], { type: file.contentType || 'image/jpeg' });
          if (isMounted) {
            urls[file.attachmentId] = URL.createObjectURL(blob);
            setExistingImageUrls({ ...urls });
          }
        } catch (error) {
          console.error(`기존 이미지 로드 실패 (ID: ${file.attachmentId}):`, error);
        }
      }
    };

    fetchExistingImages();

    return () => {
      isMounted = false;
      // 컴포넌트 언마운트 또는 데이터 갱신 시 기존 메모리 해제
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [existingAttachments]);

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
        currentStatus: String(facility.currentStatus ?? 1),
        useYn: facility.useYn ? "true" : "false",
        createdAt: formatDateTime(facility.createdAt),
      });
      newPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setNewAttachedFiles([]);
      setNewPreviewUrls([]);
    }
  }, [isEditing, facility]);

  // 신규 이미지 선택 및 검증 처리
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
      setNewAttachedFiles((prev) => [...prev, ...validFiles]);
      setNewPreviewUrls((prev) => [...prev, ...newUrls]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 개별 신규 파일 제거
  const handleRemoveNewImage = (index: number) => {
    URL.revokeObjectURL(newPreviewUrls[index]);
    setNewAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPreviewUrls((prev) => prev.filter((_, i) => i !== index));
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

  // 개별 기존 첨부파일 삭제 핸들러
  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!window.confirm("이 첨부파일은 X를 누르는 즉시 삭제되며, 수정 취소 시 복구되지 않습니다. 정말 삭제하시겠습니까?")) return;
    if (!fcltCode) return;

    try {
      await FacilityApi.deleteAttachment(fcltCode, attachmentId);
      // 삭제된 항목의 Blob URL도 메모리에서 해제
      if (existingImageUrls[attachmentId]) {
        URL.revokeObjectURL(existingImageUrls[attachmentId]);
      }
      setExistingAttachments((prev) => prev.filter((file) => file.attachmentId !== attachmentId));
      alert("첨부파일이 삭제되었습니다.");
    } catch (error) {
      console.error("첨부파일 삭제 실패:", error);
      alert("첨부파일 삭제 중 오류가 발생했습니다.");
    }
  };

  // 파일 다운로드 핸들러
  const handleDownloadAttachment = async (attachmentId: number) => {
    try {
      const targetFile = existingAttachments.find(f => f.attachmentId === attachmentId);
      const originalFileName = targetFile?.originalName || 'downloaded_file';
      const contentType = targetFile?.contentType || 'application/octet-stream';

      const response = await apiClient.get(`/attachments/${attachmentId}/download`, {
        responseType: 'blob',
      });

      let fileName = originalFileName;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          fileName = decodeURIComponent(match[1].replace(/['"]/g, ''));
        }
      }

      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("파일 다운로드 실패:", error);
      if (error instanceof Error && 'response' in error) {
        const errRes = (error as any).response;
        if (errRes?.data instanceof Blob) {
          errRes.data.text().then((text: string) => {
            try {
              const json = JSON.parse(text);
              alert(json.message || "파일 다운로드에 실패했습니다.");
            } catch {
              alert("파일 다운로드에 실패했습니다.");
            }
          });
          return;
        }
      }
      alert("파일 다운로드 중 오류가 발생했습니다.");
    }
  };

  // 저장 핸들러
  const handleSave = async () => {
    if (!facility || isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: FacilityUpdateRequest = {
        eqCode: form.eqCode?.trim() ? form.eqCode.trim() : null,
        facCode: form.facCode?.trim() ? form.facCode.trim() : null,
        fcltNm: form.fcltNm?.trim() ? form.fcltNm.trim() : null,
        currentStatus:
          form.currentStatus === "" ? null : (Number(form.currentStatus) as StatusType),
        useYn: form.useYn === "true",
      };

      // 1단계: 설비 메타데이터 수정 API 먼저 호출
      const response = await FacilityApi.update(facility.fcltCode, updatePayload);

      // 2단계: 신규 추가된 첨부파일이 있다면 순차 업로드 (category: "IMAGE" 지정)
      if (newAttachedFiles.length > 0) {
        for (const file of newAttachedFiles) {
          try {
            await FacilityApi.uploadAttachment(facility.fcltCode, file, "IMAGE");
          } catch (fileError) {
            console.error(`파일 업로드 실패 (${file.name}):`, fileError);
            alert(`설비 정보는 수정되었습니다.\n하지만 일부 파일(${file.name}) 업로드에 실패했습니다.`);
          }
        }
      }

      alert(response.message || "수정되었습니다.");
      await fetchFacilityDetail();

      newPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setNewAttachedFiles([]);
      setNewPreviewUrls([]);
      setIsEditing(false);
    } catch (err) {
      console.error("설비 수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

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
        <div className="detailCard">
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        </div>
      </section>
    );
  }

  if (!facility) return null;

  return (
    <section className="screenStack">
      <DetailLayout
        title={facility?.fcltNm}
        subtitle={form.fcltCode}
        meta={`등록일자 ${form.createdAt}`}
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
              {isDeleting ? "삭제 처리 중..." : "설비 삭제"}
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
                  navigate({ pathname: "/equipment/facility", search: location.search })
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
      >
        <div className="detailSection detailField--full">
          <h3 className="detailSectionTitle">설비 이미지</h3>
          <div className="createField" style={{ gridColumn: '1 / -1' }}>

            {/* 1. 읽기 및 수정 모드 공통: 이미 등록된 기존 첨부 이미지 썸네일 그리드 */}
            {existingAttachments.length > 0 && (
              <div style={{ marginBottom: isEditing ? '16px' : '0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {existingAttachments.map((file) => {
                    const fileId = file.attachmentId;
                    const fileName = file.originalName ?? "첨부이미지";
                    const blobUrl = existingImageUrls[fileId]; // Blob URL 활용

                    return (
                      <div
                        key={fileId}
                        className="facility-preview-wrapper"
                        style={{ width: '110px', position: 'relative', cursor: 'pointer' }}
                        onClick={() => handleDownloadAttachment(fileId)}
                        title="클릭하여 원본 다운로드"
                      >
                        <div
                          style={{
                            width: '110px',
                            height: '110px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                          }}
                        >
                          {blobUrl ? (
                            <img
                              src={blobUrl}
                              alt={fileName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                              로딩중...
                            </div>
                          )}
                        </div>

                        {/* 수정 모드일 때만 기존 파일 즉시 삭제 버튼 노출 */}
                        {isEditing && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAttachment(fileId);
                            }}
                            className="facility-preview-remove-btn"
                            title="첨부파일 삭제"
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
                        )}

                        <div
                          className="facility-preview-name"
                          style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px', textAlign: 'center', color: '#475569' }}
                        >
                          {fileName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 등록된 파일이 아예 없고 읽기 모드일 때 */}
            {existingAttachments.length === 0 && !isEditing && (
              <p className="text-gray-500 text-sm">등록된 첨부파일이 없습니다.</p>
            )}

            {/* 2. 수정 모드일 때만 추가 드래그 앤 드롭 영역 및 새 파일 썸네일 미리보기 노출 */}
            {isEditing && (
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
                  cursor: 'pointer',
                  marginTop: existingAttachments.length > 0 ? '12px' : '0'
                }}
              >
                {newPreviewUrls.length === 0 ? (
                  <div className="facility-upload-placeholder" style={{ textAlign: 'center' }}>
                    <Remix iconName="image-line" iconSize={2.3} color="#64748b" />
                    <span className="file-drop-zone__main-text" style={{ display: 'block', marginTop: '8px' }}>추가할 이미지 파일을 마우스로 끌어다 놓으세요.</span>
                    <span className="facility-upload-subtext" style={{ display: 'block', marginBottom: '12px', color: '#888', fontSize: '13px' }}>지원 형식: JPG, JPEG, PNG, GIF (최대 20MB, 다중 선택 가능)</span>
                    <CustomButton
                      prefixType="ghost"
                      iconPosition="text"
                      onClick={(e?: SyntheticEvent) => {
                        e?.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      이미지 추가
                    </CustomButton>
                  </div>
                ) : (
                  <div style={{ width: '100%' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', width: '100%' }}>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                        새로 추가할 이미지 ({newPreviewUrls.length}개) - 추가로 파일을 끌어다 놓거나 박스를 클릭하세요.
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
                      {newPreviewUrls.map((url, index) => (
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
                              handleRemoveNewImage(index);
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
                            {newAttachedFiles[index]?.name}
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
            )}
          </div>
        </div>
      </DetailLayout>
    </section>
  );
}