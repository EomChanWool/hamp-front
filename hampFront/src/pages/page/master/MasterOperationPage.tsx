import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
import { OperationCreateModal } from "@components/common/OperationCreateModal";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type {
  OperationResponse,
  ApiResponseOperationResponse,
  ApiResponsePageOperationResponse,
  OperationUpdateRequest,
  OperationCreateRequest,
} from "@/types/master/Operation";

export function MasterOperationsPage() {
  const [operations, setOperations] = useState<OperationResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingOperCode, setDetailLoadingOperCode] = useState<string | null>(null);

  // 상태 변경 및 로딩 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [modalOperation, setModalOperation] = useState<OperationResponse | null>(null);

  // 등록 모달 및 생성 중 로딩 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const detailRequestIdRef = useRef(0);

  // 검색 필드 Refs
  const operCodeRef = useRef<HTMLInputElement>(null);
  const depCodeRef = useRef<HTMLInputElement>(null);
  const operNmRef = useRef<HTMLInputElement>(null);
  const useYnRef = useRef<HTMLSelectElement>(null);
  const stdTimeRef = useRef<HTMLInputElement>(null);

  // 검색 밴드 구성 (5가지 검색 파라미터 적용)
  const searchFields: SearchField[] = [
    { type: "input", label: "공정코드", ref: operCodeRef },
    { type: "input", label: "부서코드", ref: depCodeRef },
    { type: "input", label: "공정명", ref: operNmRef },
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
    { type: "input", label: "표준시간", ref: stdTimeRef },
  ];

  // 공정 목록 조회 (GET /operations)
  const loadOperations = async (page: number, params: Record<string, string>) => {
    setIsLoading(true);
    try {
      const cleanedParams = Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (value && value.trim() !== "") acc[key] = value.trim();
          return acc;
        },
        {} as Record<string, string>
      );

      const response = await apiClient.get<ApiResponsePageOperationResponse>("/operations", {
        params: { ...cleanedParams, page, size: 10 },
      });

      const pageData = response.data.data;
      setOperations(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("공정 목록 조회 실패:", error);
      window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 공정 단건 상세 조회 (GET /operations/{operCode})
  const handleOpenDetail = async (operCode: string) => {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoadingOperCode(operCode);

    try {
      const encodedOperCode = encodeURIComponent(operCode);
      const response = await apiClient.get<ApiResponseOperationResponse>(
        `/operations/${encodedOperCode}`
      );
      const operation = response.data.data;

      if (!operation) throw new Error("공정 상세 데이터가 없습니다.");

      if (requestId === detailRequestIdRef.current) {
        setModalOperation(operation);
      }
    } catch (error) {
      console.error("공정 상세 조회 실패:", error);
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
        setDetailLoadingOperCode(null);
      }
    }
  };

  useEffect(() => {
    loadOperations(currentPage, searchParams);
  }, [currentPage, searchParams]);

  // 검색 핸들러
  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (operCodeRef.current?.value.trim()) params.operCode = operCodeRef.current.value.trim();
    if (depCodeRef.current?.value.trim()) params.depCode = depCodeRef.current.value.trim();
    if (operNmRef.current?.value.trim()) params.operNm = operNmRef.current.value.trim();
    if (useYnRef.current?.value.trim()) params.useYn = useYnRef.current.value.trim();
    if (stdTimeRef.current?.value.trim()) params.stdTime = stdTimeRef.current.value.trim();

    setCurrentPage(0);
    setSearchParams(params);
  };

  // 검색 초기화
  const handleReset = () => {
    [operCodeRef, depCodeRef, operNmRef, stdTimeRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    if (useYnRef.current) useYnRef.current.value = "";

    setCurrentPage(0);
    setSearchParams({});
  };

  // 1. 신규 공정 등록 처리 (POST /operations)
  const handleCreateOperation = async (formData: OperationCreateRequest) => {
    setIsCreating(true);
    try {
      await apiClient.post("/operations", formData);
      window.alert("성공적으로 등록되었습니다.");
      setIsCreateModalOpen(false);
      await loadOperations(currentPage, searchParams);
    } catch (error) {
      console.error("공정 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "공정 등록 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  // 2. 공정 정보 수정 처리 (PUT /operations/{operCode})
  const handleSave = async (updated: Record<string, string>) => {
    if (!modalOperation || isUpdating) return;

    setIsUpdating(true);
    try {
      const depCodeVal = "depCode" in updated ? updated.depCode.trim() : modalOperation.depCode;
      const operNmVal = "operNm" in updated ? updated.operNm : modalOperation.operNm;
      const stdTimeVal = "stdTime" in updated ? updated.stdTime : modalOperation.stdTime;

      const updatePayload: OperationUpdateRequest = {
        depCode: depCodeVal?.trim() ? depCodeVal.trim() : null,
        operNm: operNmVal?.trim() ? operNmVal.trim() : null,
        stdTime: stdTimeVal?.trim() ? stdTimeVal.trim() : null,
      };

      const encodedOperCode = encodeURIComponent(modalOperation.operCode);

      const response = await apiClient.put<ApiResponseOperationResponse>(
        `/operations/${encodedOperCode}`,
        updatePayload
      );

      const successMessage = response.data?.message || "수정되었습니다.";
      window.alert(successMessage);

      setModalOperation(null);
      await loadOperations(currentPage, searchParams);
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

  // 3. 공정 삭제/비활성화 처리 (DELETE /operations/{operCode})
  const handleDeactivate = async () => {
    if (!modalOperation || modalOperation.useYn === "N" || isDeactivating) return;

    const confirmed = window.confirm(
      `${modalOperation.operNm || modalOperation.operCode} 공정을 비활성화하시겠습니까?`
    );
    if (!confirmed) return;

    setIsDeactivating(true);
    try {
      const encodedOperCode = encodeURIComponent(modalOperation.operCode);
      await apiClient.delete(`/operations/${encodedOperCode}`);
      window.alert("공정이 비활성화되었습니다.");
      setModalOperation(null);
      await loadOperations(currentPage, searchParams);
    } catch (error) {
      console.error("공정 비활성화 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "공정 비활성화에 실패했습니다.");
    } finally {
      setIsDeactivating(false);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<OperationResponse>[] = useMemo(
    () => [
      { accessorKey: "operCode", header: "공정코드" },
      { accessorKey: "depCode", header: "부서코드" },
      { accessorKey: "operNm", header: "공정명" },
      { accessorKey: "stdTime", header: "표준시간" },
      {
        accessorKey: "useYn",
        header: "사용여부",
        cell: ({ getValue }) => (
          <Badge tone={getValue<string>() === "Y" ? "good" : "muted"}>
            {getValue<string>() === "Y" ? "사용" : "미사용"}
          </Badge>
        ),
      },
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
              disabled={detailLoadingOperCode === row.original.operCode}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(row.original.operCode);
              }}
            >
              {detailLoadingOperCode === row.original.operCode ? "조회 중..." : "상세"}
            </button>
          </div>
        ),
      },
    ],
    [detailLoadingOperCode]
  );

  const detailFields = [
    { label: "공정코드", key: "operCode", editable: false },
    { label: "부서코드", key: "depCode" },
    { label: "공정명", key: "operNm" },
    { label: "표준시간", key: "stdTime" },
    { label: "사용여부", key: "useYn", editable: false },
    { label: "생성일시", key: "createdAt", editable: false },
  ];

  const modalData = useMemo(() => {
    if (!modalOperation) return {};
    return {
      operCode: modalOperation.operCode,
      depCode: modalOperation.depCode,
      operNm: modalOperation.operNm,
      stdTime: modalOperation.stdTime,
      useYn: modalOperation.useYn === "Y" ? "사용" : "미사용",
      createdAt: formatDateTime(modalOperation.createdAt),
    };
  }, [modalOperation]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="공정 관리 목록" action="등록" onAction={() => setIsCreateModalOpen(true)}>
        <div className="relative min-h-[300px]">
          {isLoading && (
            <span>데이터를 불러오는 중입니다...</span>
          )}

          <CusTable
            data={operations}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.operCode)}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={setCurrentPage}
          />
        </div>
      </Panel>

      {/* 공정 상세/수정 모달 */}
      <RowDetailModal
        isOpen={modalOperation !== null}
        onClose={() => {
          if (!isDeactivating && !isUpdating) setModalOperation(null);
        }}
        onSave={handleSave}
        fields={detailFields}
        data={modalData as unknown as Record<string, string>}
        dangerAction={
          modalOperation?.useYn === "Y"
            ? {
                label: "공정 비활성화",
                loadingLabel: "비활성화 처리 중...",
                onClick: handleDeactivate,
                isLoading: isDeactivating,
              }
            : undefined
        }
      />

      {/* 신규 공정 등록 모달 */}
      <OperationCreateModal
        isOpen={isCreateModalOpen}
        isLoading={isCreating}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateOperation}
      />
    </section>
  );
}