import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
import { FactoryZoneCreateModal } from "@components/common/FactoryZoneModal";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type {
  FactoryZoneResponse,
  ApiResponseFactoryZoneResponse,
  ApiResponsePageFactoryZoneResponse,
  FactoryZoneUpdateRequest,
  FactoryZoneCreateRequest,
} from "@/types/master/FactoryZone";

export function MasterFactoriesPage() {
  const [factoryZones, setFactoryZones] = useState<FactoryZoneResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingFacCode, setDetailLoadingFacCode] = useState<string | null>(null);

  // 수정 및 비활성화(삭제) 상태 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [modalFactoryZone, setModalFactoryZone] = useState<FactoryZoneResponse | null>(null);

  // 등록 모달 관리
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const detailRequestIdRef = useRef(0);

  const facCodeRef = useRef<HTMLInputElement>(null);
  const facNmRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const useYnRef = useRef<HTMLSelectElement>(null);

  const searchFields: SearchField[] = [
    { type: "input", label: "공장코드", ref: facCodeRef },
    { type: "input", label: "공장명", ref: facNmRef },
    { type: "input", label: "위치", ref: locationRef },
    {
      type: "select",
      label: "사용여부",
      ref: useYnRef,
      options: [
        { label: "전체", value: "" },
        { label: "사용", value: "Y" },
        { label: "미사용", value: "N" },
      ],
    },
  ];

  // 공장 목록 조회 (GET /factory-zones)
  const loadFactoryZones = async (page: number, params: Record<string, string>) => {
    setIsLoading(true);
    try {
      const cleanedParams = Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (value && value.trim() !== "") acc[key] = value.trim();
          return acc;
        },
        {} as Record<string, string>
      );

      const response = await apiClient.get<ApiResponsePageFactoryZoneResponse>(
        "/factory-zones",
        {
          params: { ...cleanedParams, page, size: 10 },
        }
      );

      const pageData = response.data.data;
      setFactoryZones(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("공장 목록 조회 실패:", error);
      window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 공장 단건 상세 조회 (GET /factory-zones/{facCode})
  const handleOpenDetail = async (facCode: string) => {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoadingFacCode(facCode);

    try {
      const encodedFacCode = encodeURIComponent(facCode);
      const response = await apiClient.get<ApiResponseFactoryZoneResponse>(
        `/factory-zones/${encodedFacCode}`
      );
      const factoryZone = response.data.data;

      if (!factoryZone) throw new Error("공장 상세 데이터가 없습니다.");

      if (requestId === detailRequestIdRef.current) {
        setModalFactoryZone(factoryZone);
      }
    } catch (error) {
      console.error("공장 상세 조회 실패:", error);
      if (requestId === detailRequestIdRef.current) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.message
          : error instanceof Error
            ? error.message
            : null;
        window.alert(message || "상세 정보를 불러오는 중 오류가 발생했습니다.");
      }
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoadingFacCode(null);
      }
    }
  };

  useEffect(() => {
    loadFactoryZones(currentPage, searchParams);
  }, [currentPage, searchParams]);

  // 검색 핸들러
  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (facCodeRef.current?.value.trim()) params.facCode = facCodeRef.current.value.trim();
    if (facNmRef.current?.value.trim()) params.facNm = facNmRef.current.value.trim();
    if (locationRef.current?.value.trim()) params.location = locationRef.current.value.trim();
    if (useYnRef.current?.value.trim()) params.useYn = useYnRef.current.value.trim();

    setCurrentPage(0);
    setSearchParams(params);
  };

  // 검색 초기화
  const handleReset = () => {
    [facCodeRef, facNmRef, locationRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    if (useYnRef.current) {
      useYnRef.current.value = "";
    }
    setCurrentPage(0);
    setSearchParams({});
  };

  // 1. 공장 등록 처리 (POST /factory-zones)
  const handleCreateFactoryZone = async (formData: FactoryZoneCreateRequest) => {
    setIsCreating(true);
    try {
      await apiClient.post("/factory-zones", formData);
      window.alert("성공적으로 등록되었습니다.");
      setIsCreateModalOpen(false);
      await loadFactoryZones(currentPage, searchParams);
    } catch (error) {
      console.error("공장 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "공장 등록 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  // 2. 공장 정보 수정 처리 (PUT /factory-zones/{facCode})
  const handleSave = async (updated: Record<string, string>) => {
    if (!modalFactoryZone || isUpdating) return;

    setIsUpdating(true);
    try {
      const facNmVal = "facNm" in updated ? updated.facNm : modalFactoryZone.facNm;
      const locationVal = "location" in updated ? updated.location : modalFactoryZone.location;
      const noteVal = "note" in updated ? updated.note : modalFactoryZone.note;

      const updatePayload: FactoryZoneUpdateRequest = {
        facNm: facNmVal?.trim() ? facNmVal.trim() : null,
        location: locationVal?.trim() ? locationVal.trim() : null,
        note: noteVal?.trim() ? noteVal.trim() : null,
      };

      const encodedFacCode = encodeURIComponent(modalFactoryZone.facCode);

      const response = await apiClient.put<ApiResponseFactoryZoneResponse>(
        `/factory-zones/${encodedFacCode}`,
        updatePayload
      );

      const successMessage = response.data?.message || "수정되었습니다.";
      window.alert(successMessage);

      setModalFactoryZone(null);
      await loadFactoryZones(currentPage, searchParams);
    } catch (err) {
      console.error("저장 실패:", err);
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.message
        : null;

      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 3. 공장 비활성화 처리 (DELETE /factory-zones/{facCode})
  const handleDeactivate = async () => {
    if (!modalFactoryZone || modalFactoryZone.useYn !== "Y" || isDeactivating) return;

    const confirmed = window.confirm(
      `${modalFactoryZone.facNm || modalFactoryZone.facCode} 공장을 비활성화하시겠습니까?`
    );
    if (!confirmed) return;

    setIsDeactivating(true);
    try {
      const encodedFacCode = encodeURIComponent(modalFactoryZone.facCode);
      await apiClient.delete(`/factory-zones/${encodedFacCode}`);
      window.alert("공장이 비활성화되었습니다.");
      setModalFactoryZone(null);
      await loadFactoryZones(currentPage, searchParams);
    } catch (error) {
      console.error("공장 비활성화 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "공장 비활성화에 실패했습니다.");
    } finally {
      setIsDeactivating(false);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<FactoryZoneResponse>[] = useMemo(
    () => [
      { accessorKey: "facCode", header: "공장코드" },
      { accessorKey: "facNm", header: "공장명" },
      { accessorKey: "location", header: "위치" },
      {
        accessorKey: "useYn",
        header: "사용여부",
        cell: ({ getValue }) => {
          const isUse = getValue<string>() === "Y";
          return (
            <Badge tone={isUse ? "good" : "muted"}>
              {isUse ? "사용" : "미사용"}
            </Badge>
          );
        },
      },
      { accessorKey: "note", header: "비고" },
      {
        accessorKey: "createdAt",
        header: "등록일자",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
      {
        id: "actions",
        header: "관리",
        meta: { width: "100px" },
        cell: ({ row }) => (
          <div className="rowActions">
            <button
              type="button"
              className="miniButton"
              disabled={detailLoadingFacCode === row.original.facCode}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(row.original.facCode);
              }}
            >
              {detailLoadingFacCode === row.original.facCode ? "조회 중..." : "상세"}
            </button>
          </div>
        ),
      },
    ],
    [detailLoadingFacCode]
  );

  const detailFields = [
    { label: "공장코드", key: "facCode", editable: false },
    { label: "공장명", key: "facNm" },
    { label: "위치", key: "location" },
    { label: "사용여부", key: "useYn", editable: false },
    { label: "비고", key: "note" },
    { label: "등록일자", key: "createdAt", editable: false },
    { label: "수정일자", key: "updatedAt", editable: false },
  ];

  const modalData = useMemo(() => {
    if (!modalFactoryZone) return {};
    return {
      facCode: modalFactoryZone.facCode,
      facNm: modalFactoryZone.facNm ?? "",
      location: modalFactoryZone.location ?? "",
      useYn: modalFactoryZone.useYn === "Y" ? "사용" : "미사용",
      note: modalFactoryZone.note ?? "",
      createdAt: formatDateTime(modalFactoryZone.createdAt),
      updatedAt: formatDateTime(modalFactoryZone.updatedAt),
    };
  }, [modalFactoryZone]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="공장관리 목록" action="등록" onAction={() => setIsCreateModalOpen(true)}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={factoryZones}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.facCode)}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={setCurrentPage}
          />
        </div>
      </Panel>

      {/* 공장 상세/수정 모달 */}
      <RowDetailModal
        isOpen={modalFactoryZone !== null}
        onClose={() => {
          if (!isDeactivating && !isUpdating) setModalFactoryZone(null);
        }}
        onSave={handleSave}
        fields={detailFields}
        data={modalData as unknown as Record<string, string>}
        dangerAction={
          modalFactoryZone?.useYn === "Y"
            ? {
                label: "공장 비활성화",
                loadingLabel: "비활성화 처리 중...",
                onClick: handleDeactivate,
                isLoading: isDeactivating,
              }
            : undefined
        }
      />

      {/* 신규 공장 등록 모달 */}
      <FactoryZoneCreateModal
        isOpen={isCreateModalOpen}
        isLoading={isCreating}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateFactoryZone}
      />
    </section>
  );
}