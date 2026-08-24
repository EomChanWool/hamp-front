import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AddressSearchInput } from "@/components/common/AddressSearchInput"; // 주소 컴포넌트 임포트
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import { BusinessPartnerApi } from "@/api/sales/BusinessPartner";
import type {
  BusinessPartnerResponse,
  BusinessPartnerUpdateRequest,
} from "@/api/sales/BusinessPartner";
import Spinner from "@/components/common/Spinner";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";

export function SalesBusinessPartnerDetailPage() {
  const { bpCode } = useParams<{ bpCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [partner, setPartner] = useState<BusinessPartnerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const isBusy = isUpdating || isDeleting;

  // 필드 정의: 헤더/섹션 구조에 맞게 그룹핑
  const sections: DetailSection<BusinessPartnerResponse>[] = [
    {
      title: "기본 정보",
      fields: [
        { label: "거래처명", key: "bpNm", editable: true },
        { label: "대표자명", key: "ceoNm", editable: true },
        { label: "전화번호", key: "phone", editable: true },
      ],
    },
    {
      title: "주소 정보",
      fields: [
        {
          label: "주소",
          key: "address",
          editable: true,
          renderEditor: (value, onChange, disabled) => (
            <AddressSearchInput value={value} onChange={onChange} disabled={disabled} />
          ),
        },
      ],
    },
    {
      title: "담당자 정보",
      fields: [
        { label: "담당자명", key: "managerNm", editable: true },
        { label: "담당자 연락처", key: "managerPhone", editable: true },
      ],
    },
  ];

  // 상세 데이터 조회
  const fetchPartnerDetail = useCallback(async () => {
    if (!bpCode) return;
    setIsLoading(true);

    try {
      const response = await BusinessPartnerApi.getDetail(bpCode);
      const data = response.data;

      if (data) {
        setPartner(data);
        setForm({
          bpCode: data.bpCode,
          bpNm: data.bpNm || "",
          ceoNm: data.ceoNm || "",
          phone: data.phone || "",
          address: data.address || "",
          managerNm: data.managerNm || "",
          managerPhone: data.managerPhone || "",
          createdAt: formatDateTime(data.createdAt),
        });
      }
    } catch (error) {
      console.error("거래처 상세 조회 실패:", error);
      alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
      navigate({ pathname: "/sales/business-partner", search: location.search });
    } finally {
      setIsLoading(false);
    }
  }, [bpCode, navigate, location.search]);

  useEffect(() => {
    fetchPartnerDetail();
  }, [fetchPartnerDetail]);

  // 수정 모드 취소 시 롤백
  useEffect(() => {
    if (partner && !isEditing) {
      setForm({
        bpCode: partner.bpCode,
        bpNm: partner.bpNm || "",
        ceoNm: partner.ceoNm || "",
        phone: partner.phone || "",
        address: partner.address || "",
        managerNm: partner.managerNm || "",
        managerPhone: partner.managerPhone || "",
        createdAt: formatDateTime(partner.createdAt),
      });
    }
  }, [isEditing, partner]);

  // 저장 처리
  const handleSave = async () => {
    if (!partner || isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: BusinessPartnerUpdateRequest = {
        bpNm: form.bpNm?.trim() || null,
        ceoNm: form.ceoNm?.trim() || null,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
        managerNm: form.managerNm?.trim() || null,
        managerPhone: form.managerPhone?.trim() || null,
      };

      await BusinessPartnerApi.update(partner.bpCode, updatePayload);
      alert("수정되었습니다.");
      await fetchPartnerDetail();
      setIsEditing(false);
    } catch (err) {
      console.error("거래처 수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 삭제 처리
  const handleDelete = async () => {
    if (!partner || isDeleting) return;

    const confirmed = window.confirm(`${partner.bpNm} 거래처를 삭제하시겠습니까?`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await BusinessPartnerApi.delete(partner.bpCode);
      alert("거래처가 삭제되었습니다.");
      navigate({ pathname: "/sales/business-partner", search: location.search });
    } catch (error) {
      console.error("거래처 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(message || "거래처 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && !partner) {
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

  if (!partner) return null;

  return (
    <section className="screenStack">
      <DetailLayout
        title={partner.bpNm}
        subtitle={form.bpCode}
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
              {isDeleting ? "삭제 처리 중..." : "거래처 삭제"}
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
                  navigate({ pathname: "/sales/business-partner", search: location.search })
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
      />
    </section>
  );
}
