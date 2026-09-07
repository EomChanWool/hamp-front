import { useEffect, useState } from "react";
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
import FileDropZone, { EXT_META } from "@/components/common/FileDropZone";
import Remix from "@/components/common/Remix";
import { apiClient } from "@/api/apiClient";

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

  // 첨부파일 관련 상태
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);

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
  };

  useEffect(() => {
    if (fcltCode) {
      fetchFacilityDetail();
      fetchOptions();
    }
  }, [fcltCode]);

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
      setNewFiles([]);
    }
  }, [isEditing, facility]);

  // 개별 첨부파일 삭제 핸들러
  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!window.confirm("이 첨부파일은 X를 누르는 즉시 삭제되며, 수정 취소 시 복구되지 않습니다. 정말 삭제하시겠습니까?")) return;
    if (!fcltCode) return;

    try {
      await FacilityApi.deleteAttachment(fcltCode, attachmentId);

      // 성공 시 화면 상태에서도 해당 항목 제거 (attachmentId 기준)
      setExistingAttachments((prev) => prev.filter((file) => file.attachmentId !== attachmentId));
      alert("첨부파일이 삭제되었습니다.");
    } catch (error) {
      console.error("첨부파일 삭제 실패:", error);
      alert("첨부파일 삭제 중 오류가 발생했습니다.");
    }
  };

  // 수정된 파일 다운로드 핸들러 (contentType과 확장자 보장)
  const handleDownloadAttachment = async (attachmentId: number) => {
    try {
      // 1. 기존에 이미 불러온 existingAttachments 목록에서 현재 파일의 정보를 찾습니다.
      const targetFile = existingAttachments.find(f => f.attachmentId === attachmentId);
      const originalFileName = targetFile?.originalName || 'downloaded_file';
      const contentType = targetFile?.contentType || 'application/octet-stream';

      // 2. apiClient를 사용하여 파일 다운로드 요청
      const response = await apiClient.get(`/attachments/${attachmentId}/download`, {
        responseType: 'blob', // 중요: 바이너리 파일 형태로 응답 수신
      });

      // 3. 서버 응답 헤더(Content-Disposition)에서 파일명이 내려온다면 그것을 우선 사용
      let fileName = originalFileName;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          fileName = decodeURIComponent(match[1].replace(/['"]/g, ''));
        }
      }

      // 4. Blob을 생성할 때 서버가 준 정확한 contentType을 지정해줍니다.
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName); // 원본 파일명 및 확장자(.png 등) 적용
      document.body.appendChild(link);
      link.click();

      // 5. 사용 후 정리
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("파일 다운로드 실패:", error);

      // 에러 응답이 Blob 형태로 내려올 경우 에러 메시지 파싱
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

      const response = await FacilityApi.update(
        facility.fcltCode,
        updatePayload,
        newFiles.length > 0 ? newFiles : undefined
      );

      alert(response.message || "수정되었습니다.");
      await fetchFacilityDetail();
      setNewFiles([]);
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
        title={form.fcltNm}
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
          <h3 className="detailSectionTitle">첨부파일</h3>
          <div className="createField" style={{ gridColumn: '1 / -1' }}>

            {/* 1. 이미 등록되어 있는 기존 첨부파일 목록 */}
            {existingAttachments.length > 0 && (
              <div className="mb-4">
                <ul className="file-drop-zone__list" style={{ marginTop: 0 }}>
                  {existingAttachments.map((file) => {
                    const fileId = file.attachmentId;
                    const fileName = file.originalName ?? "첨부파일";
                    const ext = getExt(fileName);
                    const meta = EXT_META[ext] ?? { icon: 'file-line', color: '#888' };

                    return (
                      <li key={fileId} className="file-drop-zone__item">
                        {/* 확장자 뱃지 */}
                        <span className="file-drop-zone__item-badge" style={{ backgroundColor: meta.color }}>
                          {ext || '기타'}
                        </span>

                        {/* 파일 정보 영역 (클릭 시 다운로드) */}
                        <div className="file-drop-zone__item-info">
                          <button
                            type="button"
                            className="file-drop-zone__item-name"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                            onClick={() => handleDownloadAttachment(fileId)}
                          >
                            {fileName}
                          </button>
                          <span className="file-drop-zone__item-meta">
                            등록된 첨부파일
                            <span className="file-drop-zone__item-dot" />
                            {ext.toUpperCase()}
                          </span>
                        </div>

                        {/* 수정 모드일 때만 삭제 버튼 노출 */}
                        {isEditing && (
                          <button
                            type="button"
                            className="file-drop-zone__item-remove"
                            onClick={() => handleDeleteAttachment(fileId)}
                            title="삭제"
                          >
                            <Remix iconName="close-line" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 기존 파일도 없고 수정 모드가 아닐 때의 안내 문구 */}
            {existingAttachments.length === 0 && !isEditing && (
              <p className="text-gray-500 text-sm">등록된 첨부파일이 없습니다.</p>
            )}

            {/* 2. 수정 모드일 때만 FileDropZone 컴포넌트 노출 */}
            {isEditing && (
              <div className="mt-2">
                <FileDropZone
                  label="관련 문서 및 이미지 추가 첨부"
                  onFilesChange={(files) => setNewFiles(files)}
                />
              </div>
            )}
          </div>
        </div>
      </DetailLayout>
    </section>
  );
}