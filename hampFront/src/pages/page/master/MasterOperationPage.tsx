import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
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
  OperationOptionResponse,
  ApiResponseListOperationOptionResponse,
} from "@/types/master/Operation";

export function MasterOperationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [operations, setOperations] = useState<OperationResponse[]>([]);
  const [operationOptions, setOperationOptions] = useState<OperationOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingOperCode, setDetailLoadingOperCode] = useState<string | null>(null);

  // 수정 및 비활성화 상태 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [modalOperation, setModalOperation] = useState<OperationResponse | null>(null);

  const detailRequestIdRef = useRef(0);

  // URL 쿼리 파라미터 값 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryOperCode = searchParams.get("operCode") || "";
  const queryDepCode = searchParams.get("depCode") || "";
  const queryOperNm = searchParams.get("operNm") || "";
  const queryUseYn = searchParams.get("useYn") || "";
  const queryStdTime = searchParams.get("stdTime") || "";

  // 검색 필드 Refs
  const operCodeRef = useRef<HTMLSelectElement>(null);
  const depCodeRef = useRef<HTMLInputElement>(null);
  const operNmRef = useRef<HTMLInputElement>(null);
  const useYnRef = useRef<HTMLSelectElement>(null);
  const stdTimeRef = useRef<HTMLInputElement>(null);

  // 공정 옵션 목록 API 호출
  const fetchOperationOptions = useCallback(async () => {
    try {
      const response = await apiClient.get<ApiResponseListOperationOptionResponse>(
        "/operations/options"
      );
      setOperationOptions(response.data.data ?? []);
    } catch (error) {
      console.error("공정 옵션 목록 조회 실패:", error);
    }
  }, []);

  useEffect(() => {
    fetchOperationOptions();
  }, [fetchOperationOptions]);

  // 검색 필드 DOM 값과 URL 쿼리 파라미터 동기화
  useEffect(() => {
    if (operCodeRef.current) operCodeRef.current.value = queryOperCode;
    if (depCodeRef.current) depCodeRef.current.value = queryDepCode;
    if (operNmRef.current) operNmRef.current.value = queryOperNm;
    if (useYnRef.current) useYnRef.current.value = queryUseYn;
    if (stdTimeRef.current) stdTimeRef.current.value = queryStdTime;
  }, [
    queryOperCode,
    queryDepCode,
    queryOperNm,
    queryUseYn,
    queryStdTime,
  ]);

  // 검색 밴드 구성
  const searchFields: SearchField[] = [
    {
      type: "select",
      label: "공정코드",
      ref: operCodeRef as any,
      options: [
        { label: "전체", value: "" },
        ...operationOptions.map((opt) => ({
          label: `${opt.operCode} (${opt.operNm})`,
          value: opt.operCode,
        })),
      ],
    },
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
    { type: "single-date", label: "표준시간", ref: stdTimeRef },
  ];

  // 1. 공정 목록 조회 (GET /operations)
  const loadOperations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        size: 10,
      };
      if (queryOperCode) params.operCode = queryOperCode;
      if (queryDepCode) params.depCode = queryDepCode;
      if (queryOperNm) params.operNm = queryOperNm;
      if (queryUseYn) params.useYn = queryUseYn;
      if (queryStdTime) params.stdTime = queryStdTime;

      const response = await apiClient.get<ApiResponsePageOperationResponse>("/operations", {
        params,
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
  }, [
    currentPage,
    queryOperCode,
    queryDepCode,
    queryOperNm,
    queryUseYn,
    queryStdTime,
  ]);

  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  // 검색 핸들러
  const handleSearch = () => {
    const nextParams: Record<string, string> = {
      page: "0",
    };

    const operCode = operCodeRef.current?.value.trim();
    const depCode = depCodeRef.current?.value.trim();
    const operNm = operNmRef.current?.value.trim();
    const useYn = useYnRef.current?.value.trim();
    const stdTime = stdTimeRef.current?.value.trim();

    if (operCode) nextParams.operCode = operCode;
    if (depCode) nextParams.depCode = depCode;
    if (operNm) nextParams.operNm = operNm;
    if (useYn) nextParams.useYn = useYn;
    if (stdTime) nextParams.stdTime = stdTime;

    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    [depCodeRef, operNmRef, stdTimeRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    if (operCodeRef.current) operCodeRef.current.value = "";
    if (useYnRef.current) useYnRef.current.value = "";

    setSearchParams({
      page: "0",
    });
  };

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  // 2. 공정 단건 상세 조회 (GET /operations/{operCode})
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

  // 3. 등록 페이지로 이동 (검색 조건 유지)
  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(
      queryString
        ? `/master/operations/create?${queryString}`
        : "/master/operations/create"
    );
  };

  // 4. 공정 정보 수정 처리 (PUT /operations/{operCode})
  const handleSave = async (updated: Record<string, string>) => {
    if (!modalOperation || isUpdating) return;

    setIsUpdating(true);
    try {
      const depCodeVal = "depCode" in updated ? updated.depCode : modalOperation.depCode;
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
      await loadOperations();
      await fetchOperationOptions();
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

  // 5. 공정 비활성화 처리 (DELETE /operations/{operCode})
  const handleDeactivate = async () => {
    if (!modalOperation || modalOperation.useYn !== "Y" || isDeactivating) return;

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
      await loadOperations();
      await fetchOperationOptions();
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
        cell: ({ getValue }) => {
          const isUse = getValue<string>() === "Y";
          return (
            <Badge tone={isUse ? "good" : "muted"}>
              {isUse ? "사용" : "미사용"}
            </Badge>
          );
        },
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
      operNm: modalOperation.operNm ?? "",
      stdTime: modalOperation.stdTime ?? "",
      useYn: modalOperation.useYn === "Y" ? "사용" : "미사용",
      createdAt: formatDateTime(modalOperation.createdAt),
    };
  }, [modalOperation]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="공정 관리 목록" action="등록" onAction={handleCreate}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={operations}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.operCode)}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={handlePageChange}
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
    </section>
  );
}