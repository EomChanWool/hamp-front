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
import { AttachmentApi } from "@/api/Attachment";
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

  // 이미지 다운로드 대기 중 "등록된 첨부파일이 없습니다" 가 깜빡이는 현상을 방지하기 위한 로딩 상태
  const [isImagesLoading, setIsImagesLoading] = useState(false);

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

  // 사용자가 수정 모드에서 삭제하기로 예약한 첨부파일 ID 목록 (최종 저장 시 서버에 반영)
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);

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

  /**
   * Promise.all을 활용한 병렬(동시) 다운로드 방식으로 변경하여 로딩 속도 대폭 개선
   */
  const loadImagesAsBlobs = async (attachments: any[]) => {
    const newUrls: Record<number, string> = { ...existingImageUrls };

    // 이미 캐시되어 있지 않은 대상 파일들만 필터링
    const targets = attachments.filter((file) => !newUrls[file.attachmentId]);
    if (targets.length === 0) return;

    setIsImagesLoading(true); // 이미지 로딩 시작
    try {
      // 1. 모든 이미지 다운로드 요청을 병렬(Promise.all)로 생성
      const downloadPromises = targets.map(async (file) => {
        try {
          const response = await apiClient.get(`/attachments/${file.attachmentId}/download`, {
            responseType: 'blob',
          });
          const blob = new Blob([response.data], { type: file.contentType || 'image/jpeg' });
          return {
            id: file.attachmentId,
            url: URL.createObjectURL(blob),
          };
        } catch (error) {
          console.error(`이미지 다운로드 실패 (ID: ${file.attachmentId}):`, error);
          return null;
        }
      });

      // 2. 동시에 모든 요청 실행 및 완료 대기
      const results = await Promise.all(downloadPromises);

      let hasChanges = false;
      results.forEach((result) => {
        if (result) {
          newUrls[result.id] = result.url;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setExistingImageUrls(newUrls);
      }
    } catch (error) {
      console.error("이미지 일괄 다운로드 실패:", error);
    } finally {
      setIsImagesLoading(false); // 이미지 로딩 종료
    }
  };

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
        const attachments = fcltData.attachments ?? [];
        setExistingAttachments(attachments);

        // 상세 데이터 로드 시점에 병렬로 이미지 일괄 다운로드 시작
        loadImagesAsBlobs(attachments);
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

  // 컴포넌트 언마운트 시 브라우저 메모리(Blob URL) 누수 방지를 위한 해제 처리
  useEffect(() => {
    return () => {
      Object.values(existingImageUrls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

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

  // 1. 기존 삭제 핸들러 수정 (중복 ID 방지 Set 활용 혹은 조건 추가)
  const gallery = useImageGallery({
    initialExisting: initialExistingForGallery,
    onRemoveExisting: async (attachmentId) => {
      // 중복 추가 방지
      setDeletedAttachmentIds((prev) =>
        prev.includes(attachmentId) ? prev : [...prev, attachmentId]
      );
      setExistingAttachments((prev) => prev.filter((f) => f.attachmentId !== attachmentId));
    },
  });

  // 2. 수정 취소 시 서버를 재조회하지 않고 캐시된 데이터로 즉시 원복 (재다운로드 원천 차단)
  const handleCancelEdit = () => {
    gallery.resetNew();
    setDeletedAttachmentIds([]);

    if (facility) {
      setExistingAttachments(facility.attachments ?? []);
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

      // 1. 설비 정보 업데이트
      await FacilityApi.update(facility.fcltCode, updatePayload);

      // 2. 삭제 예약된 파일들 삭제 
      if (deletedAttachmentIds.length > 0) {
        const uniqueIdsToDel = Array.from(new Set(deletedAttachmentIds));
        await Promise.allSettled(
          uniqueIdsToDel.map((id) => AttachmentApi.delete(id, facility.fcltCode))
        );
      }

      // 3. 새 이미지 업로드
      let newlyUploadedAttachments: any[] = [];
      if (gallery.newFiles.length > 0) {
        const uploadPromises = gallery.newFiles.map(async (file) => {
          const res = await AttachmentApi.upload(file, facility.fcltCode, "IMAGE");
          return res.data;
        });

        const results = await Promise.allSettled(uploadPromises);

        results.forEach((res) => {
          if (res.status === "fulfilled" && res.value) {
            newlyUploadedAttachments.push(res.value);
          }
        });
      }

      alert("수정되었습니다.");
      gallery.resetNew();
      setDeletedAttachmentIds([]);

      await fetchFacilityDetail();

      setIsEditing(false);
    } catch (err) {
      console.error("설비 수정 실패:", err);
      alert("수정에 실패했습니다.");
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
          <div className="createField" style={{ gridColumn: '1 / -1' }}>
            {/* 이미지를 불러오는 도중에는 "등록된 첨부파일이 없습니다" 대신 로딩 스피너 출력 */}
            {isImagesLoading && existingAttachments.length > 0 && initialExistingForGallery.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-gray-500 text-sm gap-2">
                <Spinner />
              </div>
            ) : gallery.isEmpty && !isEditing ? (
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
                showHeader={true}
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