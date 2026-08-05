import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
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
  EquipmentUpdateRequest,
} from "@/types/master/Equipment";

export function MasterEquipmentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [equipments, setEquipments] = useState<EquipmentResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingEqCode, setDetailLoadingEqCode] = useState<string | null>(null);

  // 수정 및 삭제(비활성화) 상태 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalEquipment, setModalEquipment] = useState<EquipmentResponse | null>(null);

  const detailRequestIdRef = useRef(0);

  // URL 쿼리스트링에서 상태 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryEqCode = searchParams.get("eqCode") || "";
  const queryOperCode = searchParams.get("operCode") || "";
  const queryEqNm = searchParams.get("eqNm") || "";
  const queryEqType = searchParams.get("eqType") || "";
  const queryManufacturer = searchParams.get("manufacturer") || "";

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

  // URL 쿼리스트링 값과 검색창 input 값 동기화
  useEffect(() => {
    if (eqCodeRef.current) eqCodeRef.current.value = queryEqCode;
    if (operCodeRef.current) operCodeRef.current.value = queryOperCode;
    if (eqNmRef.current) eqNmRef.current.value = queryEqNm;
    if (eqTypeRef.current) eqTypeRef.current.value = queryEqType;
    if (manufacturerRef.current) manufacturerRef.current.value = queryManufacturer;
  }, [
    queryEqCode,
    queryOperCode,
    queryEqNm,
    queryEqType,
    queryManufacturer,
  ]);

  // 1. 장비 목록 조회 (GET /equipment)
  const loadEquipments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        size: 10,
      };
      if (queryEqCode) params.eqCode = queryEqCode;
      if (queryOperCode) params.operCode = queryOperCode;
      if (queryEqNm) params.eqNm = queryEqNm;
      if (queryEqType) params.eqType = queryEqType;
      if (queryManufacturer) params.manufacturer = queryManufacturer;

      const response = await apiClient.get<ApiResponsePageEquipmentResponse>("/equipment", {
        params,
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
  }, [
    currentPage,
    queryEqCode,
    queryOperCode,
    queryEqNm,
    queryEqType,
    queryManufacturer,
  ]);

  useEffect(() => {
    loadEquipments();
  }, [loadEquipments]);

  // 검색 핸들러
  const handleSearch = () => {
    const nextParams: Record<string, string> = {
      page: "0",
    };

    const eqCode = eqCodeRef.current?.value.trim();
    const operCode = operCodeRef.current?.value.trim();
    const eqNm = eqNmRef.current?.value.trim();
    const eqType = eqTypeRef.current?.value.trim();
    const manufacturer = manufacturerRef.current?.value.trim();

    if (eqCode) nextParams.eqCode = eqCode;
    if (operCode) nextParams.operCode = operCode;
    if (eqNm) nextParams.eqNm = eqNm;
    if (eqType) nextParams.eqType = eqType;
    if (manufacturer) nextParams.manufacturer = manufacturer;

    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    [eqCodeRef, operCodeRef, eqNmRef, eqTypeRef, manufacturerRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    setSearchParams({
      page: "0",
    });
  };

  // 페이지네이션 핸들러
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
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

  // 3. 등록 페이지로 이동 (현재 검색조건 및 페이징 쿼리스트링 유지)
  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(
      queryString
        ? `/master/equipment/create?${queryString}`
        : "/master/equipment/create"
    );
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
      await loadEquipments();
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
      await loadEquipments();
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

      <Panel title="장비관리 목록" action="등록" onAction={handleCreate}>
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
            onPageChange={handlePageChange}
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
    </section>
  );
}