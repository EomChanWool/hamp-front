import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import type { UserOptionResponse } from "@/api/User";
import { UserApi } from "@/api/User";
import { AttachmentApi } from "@/api/Attachment";
import Spinner from "@/components/common/Spinner";
import { apiClient } from "@/api/apiClient";
import { useImageGallery } from "@/hooks/useImageGallery";
import ImageGallery from "@components/common/ImageGallery";
import ImageModal from "@components/modal/ImageModal";
import "@/pages/layout/Layout.css";

type SectionField = {
  label: string;
  key: string;
  editable?: boolean;
  renderEditor?: (value: string, onChange: (val: string) => void, disabled: boolean) => ReactNode;
  renderValue?: (value: string) => ReactNode;
};

type SectionDef = {
  title: string;
  fields: SectionField[];
};

export function EquipmentFacilityDetailPage() {
  const { fcltCode } = useParams<{ fcltCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [facility, setFacility] = useState<FacilityDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImagesLoading, setIsImagesLoading] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [equipmentOptions, setEquipmentOptions] = useState<any[]>([]);
  const [factoryZoneOptions, setFactoryZoneOptions] = useState<any[]>([]);
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([]);

  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<Record<number, string>>({});
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);

  const isBusy = isUpdating || isDeleting;

  const sections: SectionDef[] = [
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
      const [eqRes, facRes, userRes] = await Promise.all([
        EquipmentApi.getOptions(),
        FactoryZoneApi.getOptions(),
        UserApi.getOptions(),
      ]);
      setEquipmentOptions(eqRes.data ?? []);
      setFactoryZoneOptions(facRes.data ?? []);
      setUserOptions(userRes.data ?? []);
    } catch (error) {
      console.error("옵션 목록 조회 실패:", error);
    }
  }, []);

  const loadImagesAsBlobs = async (attachments: any[]) => {
    const newUrls: Record<number, string> = { ...existingImageUrls };
    const targets = attachments.filter((file) => !newUrls[file.attachmentId]);
    if (targets.length === 0) return;

    setIsImagesLoading(true);
    try {
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
      setIsImagesLoading(false);
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
        const firstManagerUserId = fcltData.managers && fcltData.managers.length > 0
          ? fcltData.managers[0].userId
          : "";
        const firstManagerUserNm = fcltData.managers && fcltData.managers.length > 0
          ? (fcltData.managers[0].userNm || fcltData.managers[0].userId)
          : "";

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
          managerUserId: firstManagerUserId,
          managerUserNm: firstManagerUserNm,
          createdAt: formatDateTime(fcltData.createdAt),
        });
        const attachments = fcltData.attachments ?? [];
        setExistingAttachments(attachments);
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

  useEffect(() => {
    return () => {
      Object.values(existingImageUrls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    if (facility && !isEditing) {
      const firstManagerUserId = facility.managers && facility.managers.length > 0
        ? facility.managers[0].userId
        : "";
      const firstManagerUserNm = facility.managers && facility.managers.length > 0
        ? (facility.managers[0].userNm || facility.managers[0].userId)
        : "";

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
        managerUserId: firstManagerUserId,
        managerUserNm: firstManagerUserNm,
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
      setDeletedAttachmentIds((prev) =>
        prev.includes(attachmentId) ? prev : [...prev, attachmentId]
      );
      setExistingAttachments((prev) => prev.filter((f) => f.attachmentId !== attachmentId));
    },
  });

  const handleCancelEdit = () => {
    gallery.resetNew();
    setDeletedAttachmentIds([]);

    if (facility) {
      setExistingAttachments(facility.attachments ?? []);
      const firstManagerUserId = facility.managers && facility.managers.length > 0
        ? facility.managers[0].userId
        : "";
      const firstManagerUserNm = facility.managers && facility.managers.length > 0
        ? (facility.managers[0].userNm || facility.managers[0].userId)
        : "";

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
        managerUserId: firstManagerUserId,
        managerUserNm: firstManagerUserNm,
        createdAt: formatDateTime(facility.createdAt),
      });
    }

    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!facility || isUpdating) return;

    setIsUpdating(true);
    try {
      const managers = form.managerUserId
        ? [{ userId: form.managerUserId }]
        : [];

      const updatePayload: FacilityUpdateRequest = {
        eqCode: form.eqCode?.trim() ? form.eqCode.trim() : null,
        facCode: form.facCode?.trim() ? form.facCode.trim() : null,
        fcltNm: form.fcltNm?.trim() ? form.fcltNm.trim() : null,
        currentStatus:
          form.currentStatus === "" ? null : (Number(form.currentStatus) as StatusType),
        useYn: form.useYn === "true",
        managers: managers,
      };

      await FacilityApi.update(facility.fcltCode, updatePayload);

      if (deletedAttachmentIds.length > 0) {
        const uniqueIdsToDel = Array.from(new Set(deletedAttachmentIds));
        await Promise.allSettled(
          uniqueIdsToDel.map((id) => AttachmentApi.delete(id, facility.fcltCode))
        );
      }

      if (gallery.newFiles.length > 0) {
        const uploadPromises = gallery.newFiles.map(async (file) => {
          const res = await AttachmentApi.upload(file, facility.fcltCode, "IMAGE");
          return res.data;
        });
        await Promise.allSettled(uploadPromises);
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

  const setFormField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const renderStatusBadge = (statusStr: string) => {
    const statusNum = Number(statusStr) as StatusType;
    const label = STATUS_TYPE_LABEL[statusNum] ?? "-";
    let badgeClass = "detailBadge success";
    if (statusNum === 0) badgeClass = "detailBadge danger";
    if (statusNum === 2) badgeClass = "detailBadge warn";
    return <span className={badgeClass}>{label}</span>;
  };

  const renderSectionField = (field: SectionField) => {
    const key = field.key;
    const isFieldEditable = isEditing && field.editable !== false;
    const value = form[key] ?? "";

    return (
      <div key={key} className="detailField">
        <label>{field.label}</label>
        {isFieldEditable ? (
          field.renderEditor ? (
            field.renderEditor(value, (val) => setFormField(key, val), isBusy)
          ) : (
            <input
              className="tableInput"
              value={value}
              disabled={isBusy}
              onChange={(e) => setFormField(key, e.target.value)}
            />
          )
        ) : (
          <div className="detailValue">
            {field.renderValue ? field.renderValue(value) : value || "-"}
          </div>
        )}
      </div>
    );
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

  const isImagesStillLoading =
    isImagesLoading && existingAttachments.length > 0 && initialExistingForGallery.length === 0;

  // 현재 선택된 담당자 이름 찾기 (조회 모드용)
  const selectedUserObj = userOptions.find((u) => u.userId === form.managerUserId);
  const displayManagerName = selectedUserObj
    ? `${selectedUserObj.userNm} (${selectedUserObj.userId})`
    : (form.managerUserNm || "-");

  return (
    <section className="screenStack">
      {/* 상단 헤더 영역: 좌측 이미지 + 우측 핵심 정보 */}
      <div className="facilityHeaderCard">
        <div className="facilityHeaderTop">
          {/* 좌측: 이미지 영역 */}
          <div className="facilityImageCol">
            {isImagesStillLoading ? (
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
                showHeader={false}
                onPreviewClick={() => setIsModalOpen(true)}
              />
            )}
          </div>

          {/* 우측: 핵심 정보 */}
          <div className="facilityInfoCol">
            {isEditing ? (
              <input
                className="facilityTitleInput"
                value={form.fcltNm}
                disabled={isBusy}
                placeholder="설비명"
                onChange={(e) => setFormField("fcltNm", e.target.value)}
              />
            ) : (
              <div>
                <div className="facilityStatusRow">
                  <h1 className="facilityTitle">{form.fcltNm || facility.fcltCode}</h1>
                  <span className="facilityCode">{form.fcltCode}</span>
                </div>
              </div>
            )}

            <div className="facilitySubtitle">
              {`${form.eqNm || "장비 미지정"} · ${form.facNm || "공장 미지정"}`}
            </div>

            <div className="facilityQuickGrid">
              <div className="facilityQuickItem">
                <span className="facilityQuickLabel">사용여부</span>
                <div className="facilityQuickValue">
                  {isEditing ? (
                    <select
                      className="tableInput"
                      value={form.useYn === "true" ? "true" : "false"}
                      disabled={isBusy}
                      onChange={(e) => setFormField("useYn", e.target.value)}
                    >
                      <option value="true">사용</option>
                      <option value="false">미사용</option>
                    </select>
                  ) : (
                    <span className={`detailBadge ${form.useYn === "true" ? "good" : "muted"}`}>
                      {form.useYn === "true" ? "사용" : "미사용"}
                    </span>
                  )}
                </div>
              </div>

              <div className="facilityQuickItem">
                <span className="facilityQuickLabel">현재상태</span>
                <div className="facilityQuickValue">
                  {isEditing ? (
                    <select
                      className="tableInput"
                      value={form.currentStatus}
                      disabled={isBusy}
                      onChange={(e) => setFormField("currentStatus", e.target.value)}
                    >
                      <option value="0">정지</option>
                      <option value="1">작동</option>
                      <option value="2">고장</option>
                    </select>
                  ) : (
                    renderStatusBadge(form.currentStatus)
                  )}
                </div>
              </div>

              {/* 상단 기본정보 영역에 담당자 추가 */}
              <div className="facilityQuickItem">
                <span className="facilityQuickLabel">담당자</span>
                <div className="facilityQuickValue">
                  {isEditing ? (
                    <select
                      className="tableInput"
                      value={form.managerUserId}
                      disabled={isBusy}
                      onChange={(e) => setFormField("managerUserId", e.target.value)}
                    >
                      <option value="">담당자를 선택해주세요</option>
                      {userOptions.map((user) => (
                        <option key={user.userId} value={user.userId}>
                          {user.userNm} ({user.userId})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{displayManagerName}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 하단: 장비 정보 / 공장 정보 영역 */}
      <div className="detailCard">
        <div className="detailBody">
          {sections.map((section) => (
            <div key={section.title} className="detailSection">
              <h3 className="detailSectionTitle">{section.title}</h3>
              <div className="detailGrid">{section.fields.map(renderSectionField)}</div>
            </div>
          ))}
        </div>

        {/* 푸터 영역 */}
        <div className="detailFooter">
          <div>
            {isEditing && (
              <button
                type="button"
                className="btnDanger"
                onClick={handleDelete}
                disabled={isBusy}
              >
                {isDeleting ? "삭제 처리 중..." : "설비 삭제"}
              </button>
            )}
          </div>
          <div className="detailFooterActions">
            {isEditing ? (
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
            )}
          </div>
        </div>
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