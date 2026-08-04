import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
import { EquipmentCreateModal } from "@components/common/EquipmentCreateModal";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";

import type {
  EquipmentResponse,
  ApiResponseEquipmentResponse,
  ApiResponsePageEquipmentResponse,
  EquipmentCreateRequest,
  EquipmentUpdateRequest,
} from "@/types/master/Equipment";

export function MasterEquipmentPage() {
  const [equipments, setEquipments] = useState<EquipmentResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingEqCode, setDetailLoadingEqCode] = useState<string | null>(null);

  // 수정 및 삭제(비활성화) 상태 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalEquipment, setModalEquipment] = useState<EquipmentResponse | null>(null);

  // 등록 모달 상태 관리
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const detailRequestIdRef = useRef(0);

  // 검색 필드 Refs (API 명세 반영: eqCode, operCode, eqNm, eqType, manufacturer)
  const eqCodeRef = useRef<HTMLInputElement>(null);
  const operCodeRef = useRef<HTMLInputElement>(null);
  const eqNmRef = useRef<HTMLInputElement>(null);
  const eqTypeRef = useRef<HTMLInputElement>(null);
  const manufacturerRef = useRef<HTMLInputElement>(null);

  const searchFields: SearchField[] = [
    { type: "input", label: "장비코드", ref: eqCodeRef },
    { type: "input", label: "공정코드", ref: operCodeRef },
    { type: "input", label: "장비명", ref: eqNmRef },
    { type: "input", label: "장비유형", ref: eqTypeRef },
    { type: "input", label: "제조사", ref: manufacturerRef },
  ];

  // 1. 장비 목록 조회 (GET /equipment)
  const loadEquipments = async (page: number, params: Record<string, string>) => {
    setIsLoading(true);
    try {
      const cleanedParams = Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (value && value.trim() !== "") acc[key] = value.trim();
          return acc;
        },
        {} as Record<string, string>
      );

      const response = await apiClient.get<ApiResponsePageEquipmentResponse>("/equipment", {
        params: { ...cleanedParams, page, size: 10 },
      });

      const pageData = response.data.data;
      setEquipments(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("장비 목록 조회 실패:", error);
      window.alert("장비 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 장비 단건 상세 조회 (GET /equipment/{eqCode})
  const handleOpenDetail = async (eqCode: string) => {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoadingEqCode(eqCode);

    try {
      const encodedEqCode = encodeURIComponent(eqCode);
      const response = await apiClient.get<ApiResponseEquipmentResponse>(
        `/equipment/${encodedEqCode}`
      );
      const equipment = response.data.data;

      if (!equipment) throw new Error("장비 상세 데이터가 없습니다.");

      if (requestId === detailRequestIdRef.current) {
        setModalEquipment(equipment);
      }
    } catch (error) {
      console.error("장비 상세 조회 실패:", error);
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
        setDetailLoadingEqCode(null);
      }
    }
  };

  useEffect(() => {
    loadEquipments(currentPage, searchParams);
  }, [currentPage, searchParams]);

  // 검색 핸들러
  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (eqCodeRef.current?.value.trim()) params.eqCode = eqCodeRef.current.value.trim();
    if (operCodeRef.current?.value.trim()) params.operCode = operCodeRef.current.value.trim();
    if (eqNmRef.current?.value.trim()) params.eqNm = eqNmRef.current.value.trim();
    if (eqTypeRef.current?.value.trim()) params.eqType = eqTypeRef.current.value.trim();
    if (manufacturerRef.current?.value.trim()) params.manufacturer = manufacturerRef.current.value.trim();

    setCurrentPage(0);
    setSearchParams(params);
  };

  // 검색 초기화
  const handleReset = () => {
    [eqCodeRef, operCodeRef, eqNmRef, eqTypeRef, manufacturerRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    setCurrentPage(0);
    setSearchParams({});
  };

  // 3. 신규 장비 등록 처리 (POST /equipment)
  const handleCreateEquipment = async (formData: EquipmentCreateRequest) => {
    setIsCreating(true);
    try {
      await apiClient.post("/equipment", formData);
      window.alert("장비가 성공적으로 등록되었습니다.");
      setIsCreateModalOpen(false);
      await loadEquipments(currentPage, searchParams);
    } catch (error) {
      console.error("장비 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "장비 등록 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  // 4. 장비 정보 수정 처리 (PUT /equipment/{eqCode})
  const handleSave = async (updated: Record<string, string>) => {
    if (!modalEquipment || isUpdating) return;

    setIsUpdating(true);
    try {
      const operCodeVal = "operCode" in updated ? updated.operCode : modalEquipment.operCode;
      const eqNmVal = "eqNm" in updated ? updated.eqNm : modalEquipment.eqNm;
      const eqTypeVal = "eqType" in updated ? updated.eqType : modalEquipment.eqType;
      const manufacturerVal = "manufacturer" in updated ? updated.manufacturer : modalEquipment.manufacturer;

      const updatePayload: EquipmentUpdateRequest = {
        operCode: operCodeVal?.trim() ? operCodeVal.trim() : null,
        eqNm: eqNmVal?.trim() ? eqNmVal.trim() : null,
        eqType: eqTypeVal?.trim() ? eqTypeVal.trim() : null,
        manufacturer: manufacturerVal?.trim() ? manufacturerVal.trim() : null,
      };

      const encodedEqCode = encodeURIComponent(modalEquipment.eqCode);

      const response = await apiClient.put<ApiResponseEquipmentResponse>(
        `/equipment/${encodedEqCode}`,
        updatePayload
      );

      const successMessage = response.data?.message || "수정되었습니다.";
      window.alert(successMessage);

      setModalEquipment(null);
      await loadEquipments(currentPage, searchParams);
    } catch (err) {
      console.error("장비 수정 실패:", err);
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.message
        : null;
      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 5. 장비 삭제 처리 (DELETE /equipment/{eqCode})
  const handleDeleteEquipment = async () => {
    if (!modalEquipment || isDeleting) return;

    const confirmed = window.confirm(
      `${modalEquipment.eqNm ?? modalEquipment.eqCode} 장비를 삭제하시겠습니까?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const encodedEqCode = encodeURIComponent(modalEquipment.eqCode);
      await apiClient.delete(`/equipment/${encodedEqCode}`);
      window.alert("장비가 삭제되었습니다.");
      setModalEquipment(null);
      await loadEquipments(currentPage, searchParams);
    } catch (error) {
      console.error("장비 삭제 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "장비 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<EquipmentResponse>[] = useMemo(
    () => [
      { accessorKey: "eqCode", header: "장비코드" },
      { accessorKey: "operCode", header: "공정코드" },
      { accessorKey: "eqNm", header: "장비명" },
      { accessorKey: "eqType", header: "장비유형" },
      { accessorKey: "manufacturer", header: "제조사" },
      {
        accessorKey: "createdAt",
        header: "생성일시",
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
              disabled={detailLoadingEqCode === row.original.eqCode}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(row.original.eqCode);
              }}
            >
              {detailLoadingEqCode === row.original.eqCode ? "조회 중..." : "상세"}
            </button>
          </div>
        ),
      },
    ],
    [detailLoadingEqCode]
  );

  // 모달 상세 필드 설정
  const detailFields = [
    { label: "장비코드", key: "eqCode", editable: false },
    { label: "공정코드", key: "operCode" },
    { label: "장비명", key: "eqNm" },
    { label: "장비유형", key: "eqType" },
    { label: "제조사", key: "manufacturer" },
    { label: "생성일시", key: "createdAt", editable: false },
    { label: "수정일시", key: "updatedAt", editable: false },
  ];

  const modalData = useMemo(() => {
    if (!modalEquipment) return {};
    return {
      eqCode: modalEquipment.eqCode,
      operCode: modalEquipment.operCode ?? "",
      eqNm: modalEquipment.eqNm ?? "",
      eqType: modalEquipment.eqType ?? "",
      manufacturer: modalEquipment.manufacturer ?? "",
      createdAt: formatDateTime(modalEquipment.createdAt),
      updatedAt: formatDateTime(modalEquipment.updatedAt),
    };
  }, [modalEquipment]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="장비관리 목록" action="등록" onAction={() => setIsCreateModalOpen(true)}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={equipments}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.eqCode)}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={setCurrentPage}
          />
        </div>
      </Panel>

      {/* 장비 상세/수정 모달 */}
      <RowDetailModal
        isOpen={modalEquipment !== null}
        onClose={() => {
          if (!isDeleting && !isUpdating) setModalEquipment(null);
        }}
        onSave={handleSave}
        fields={detailFields}
        data={modalData as unknown as Record<string, string>}
        dangerAction={{
          label: "장비 삭제",
          loadingLabel: "삭제 처리 중...",
          onClick: handleDeleteEquipment,
          isLoading: isDeleting,
        }}
      />

      {/* 신규 장비 등록 모달 */}
      <EquipmentCreateModal
        isOpen={isCreateModalOpen}
        isLoading={isCreating}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateEquipment}
      />
    </section>
  );
}