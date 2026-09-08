import { useCallback, useEffect, useMemo, useState } from "react";
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
import { apiClient } from "@/api/apiClient";
import { useImageGallery } from "@/hooks/useImageGallery";
import ImageGallery from "@components/common/ImageGallery";
import ImageModal from "@components/modal/ImageModal";

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

  // 전체 화면 이미지 확대 모달 열림/닫힘 상태 관리
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 옵션 데이터 상태
  const [equipmentOptions, setEquipmentOptions] = useState<any[]>([]);
  const [factoryZoneOptions, setFactoryZoneOptions] = useState<any[]>([]);

  // 서버에 저장된 기존 첨부파일 원본 목록 (attachmentId, originalName, contentType 등)
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);

  // 기존 첨부파일을 <img>에 바로 쓸 수 있는 Blob URL로 변환한 상태 (key: attachmentId)
  const [existingImageUrls, setExistingImageUrls] = useState<Record<number, string>>({});

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
          renderValue: (value) => {
            const statusNum = Number(value) as StatusType;
            const label = STATUS_TYPE_LABEL[statusNum] ?? "-";
            
            // 0: 정지(danger), 1: 작동(success), 2: 고장(warn)
            let badgeClass = "detailBadge success";
            if (statusNum === 0) badgeClass = "detailBadge danger"; 
            if (statusNum === 2) badgeClass = "detailBadge warn";  

            return (
              <span className={badgeClass}>
                {label}
              </span>
            );
          },
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
          renderValue: (value) => {
            const isUsed = value === "true";
            return (
              <span className={`detailBadge ${isUsed ? "good" : "muted"}`}>
                {isUsed ? "사용" : "미사용"}
              </span>
            );
          },
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

  // existingAttachments가 바뀔 때마다 서버에서 이미지를 Blob으로 내려받아 미리보기 URL을 생성
  useEffect(() => {
    if (!existingAttachments || existingAttachments.length === 0) {
      setExistingImageUrls({});
      return;
    }

    let isMounted = true;
    const urls: Record<number, string> = {};

    const fetchExistingImages = async () => {
      await Promise.allSettled(
        existingAttachments.map(async (file) => {
          try {
            const response = await apiClient.get(`/attachments/${file.attachmentId}/download`, {
              responseType: 'blob',
            });
            const blob = new Blob([response.data], { type: file.contentType || 'image/jpeg' });
            if (isMounted) {
              const url = URL.createObjectURL(blob);
              urls[file.attachmentId] = url;
              setExistingImageUrls((prev) => ({ ...prev, [file.attachmentId]: url }));
            }
          } catch (error) {
            console.error(`기존 이미지 로드 실패 (ID: ${file.attachmentId}):`, error);
          }
        })
      );
    };

    fetchExistingImages();

    return () => {
      isMounted = false;
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
    }
  }, [isEditing, facility]);

  const initialExistingForGallery = useMemo(() => {
    return existingAttachments
      .filter((a) => existingImageUrls[a.attachmentId])
      .map((a) => ({
        attachmentId: a.attachmentId,
        url: existingImageUrls[a.attachmentId],
        name: a.originalName ?? "첨부이미지",
      }));
  }, [existingAttachments, existingImageUrls]);

  const gallery = useImageGallery({
    initialExisting: initialExistingForGallery,
    onRemoveExisting: async (attachmentId) => {
      if (!window.confirm("이 첨부파일은 삭제 버튼을 누르는 즉시 삭제되며, 수정 취소 시 복구되지 않습니다. 정말 삭제하시겠습니까?")) {
        throw new Error("cancelled");
      }
      if (!fcltCode) return;

      try {
        await FacilityApi.deleteAttachment(fcltCode, attachmentId);
      } catch (error) {
        console.error("첨부파일 삭제 실패:", error);
        alert("첨부파일 삭제 중 오류가 발생했습니다.");
        throw error;
      }

      setExistingImageUrls((prev) => {
        const { [attachmentId]: removedUrl, ...rest } = prev;
        if (removedUrl) URL.revokeObjectURL(removedUrl);
        return rest;
      });
      setExistingAttachments((prev) => prev.filter((f) => f.attachmentId !== attachmentId));

      alert("첨부파일이 삭제되었습니다.");
    },
  });

  const handleCancelEdit = () => {
    gallery.resetNew();
    setIsEditing(false);
  };

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

      const response = await FacilityApi.update(facility.fcltCode, updatePayload);

      if (gallery.newFiles.length > 0) {
        const results = await Promise.allSettled(
          gallery.newFiles.map((file) => FacilityApi.uploadAttachment(facility.fcltCode, file, "IMAGE"))
        );

        const failedNames = results
          .map((result, index) => (result.status === "rejected" ? gallery.newFiles[index].name : null))
          .filter((name): name is string => name !== null);

        if (failedNames.length > 0) {
          console.error("이미지 업로드 실패:", failedNames);
          alert(
            `설비 정보는 수정되었습니다.\n` +
            `다만 이미지 ${gallery.newFiles.length}장 중 ${failedNames.length}장 업로드에 실패했습니다:\n` +
            `- ${failedNames.join('\n- ')}`
          );
        }
      }

      alert(response.message || "수정되었습니다.");
      await fetchFacilityDetail();

      gallery.resetNew();
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
                onClick={handleCancelEdit}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 className="createSectionTitle" style={{ margin: 0 }}>설비 이미지</h2>
            <span className="image-gallery__count" style={{ fontSize: '0.9rem', color: '#666', fontWeight: 500 }}>
              {gallery.images.length}장
            </span>
          </div>
          <div className="createField" style={{ gridColumn: '1 / -1' }}>
            {gallery.isEmpty && !isEditing ? (
              <p className="text-gray-500 text-sm">등록된 첨부파일이 없습니다.</p>
            ) : (
              <ImageGallery
                images={gallery.images}
                activeIndex={gallery.activeIndex}
                onActiveIndexChange={gallery.setActiveIndex}
                onFilesSelected={gallery.addFiles}
                onRemove={gallery.removeAt}
                editable={isEditing}
                title="설비 이미지"
                showHeader={false}
                onPreviewClick={() => setIsModalOpen(true)}
              />
            )}
          </div>
        </div>
      </DetailLayout>

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