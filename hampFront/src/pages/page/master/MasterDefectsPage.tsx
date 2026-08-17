import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type {
  DefectResponse,
  ApiResponseDefectResponse,
  ApiResponsePageDefectResponse,
  DefectUpdateRequest,
} from "@/api/master/Defect";
import { Badge } from "@/components/common/Badge";
import Spinner from "@/components/common/Spinner";
import type { ApiResponseListOperationOptionResponse, OperationOptionResponse } from "@/api/master/Operation";

interface DefectCreateRequest extends DefectUpdateRequest {
  defCode: string;
}

export function MasterDefectsPage() {
  const [defects, setDefects] = useState<DefectResponse[]>([]);
  const [operationOptions, setOperationOptions] = useState<OperationOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 데이터 재조회를 위한 트리거 키
  const [refreshKey, setRefreshKey] = useState(0);

  // 페이지 및 검색 조건을 React State로 관리
  const [page, setPage] = useState(0);
  const [searchFilters, setSearchFilters] = useState({
    defCode: "",
    operCode: "",
    defNm: "",
    defType: "",
    severity: "",
    useYn: "",
  });

  const [sorting, setSorting] = useState<SortingState>([]);

  // 서버로 보낼 sort 파라미터 변환
  const sortParams = useMemo(() => {
    return sorting.map((sort) => `${sort.id},${sort.desc ? "desc" : "asc"}`);
  }, [sorting]);

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
    setPage(0);
    setEditingDefCode(null);
    setIsCreatingNewRow(false);
  };

  // 인라인 수정 상태 관리
  const [editingDefCode, setEditingDefCode] = useState<string | null>(null);

  // 인라인 등록 상태 관리
  const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);

  // 타이핑 시 리렌더링 방지 폼 Ref
  const editFormRef = useRef<DefectUpdateRequest & { defCode?: string }>({
    defCode: "",
    operCode: "",
    defNm: "",
    defType: "",
    severity: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingDefCode, setIsDeletingDefCode] = useState<string | null>(null);

  // 검색 필드 Refs
  const defCodeRef = useRef<HTMLInputElement>(null);
  const operCodeRef = useRef<HTMLInputElement>(null);
  const defNmRef = useRef<HTMLInputElement>(null);
  const defTypeRef = useRef<HTMLInputElement>(null);
  const severityRef = useRef<HTMLInputElement>(null);
  const useYnRef = useRef<HTMLSelectElement>(null);

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


  // 검색 필드 정의
  const searchFields: SearchField[] = [
    { type: "input", label: "불량코드", ref: defCodeRef, name: "defCode" },
     {
      type: "select",
      label: "공정코드",
      ref: operCodeRef as any,
      options: [
        { label: "전체", value: "" },
        ...operationOptions.map((opt) => ({
          label: `${opt.operCode} (${opt.operNm ?? '-'})`,
          value: opt.operCode,
        })),
      ],
    },
    { type: "input", label: "불량명", ref: defNmRef, name: "defNm" },
    { type: "input", label: "불량유형", ref: defTypeRef, name: "defType" },
    { type: "input", label: "심각도", ref: severityRef, name: "severity" },
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

  // 불량 목록 조회
  const loadDefects = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        size: 10,
      };
      if (searchFilters.defCode) params.defCode = searchFilters.defCode;
      if (searchFilters.operCode) params.operCode = searchFilters.operCode;
      if (searchFilters.defNm) params.defNm = searchFilters.defNm;
      if (searchFilters.defType) params.defType = searchFilters.defType;
      if (searchFilters.severity) params.severity = searchFilters.severity;
      if (searchFilters.useYn) params.useYn = searchFilters.useYn;

      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await apiClient.get<ApiResponsePageDefectResponse>("/defects", {
        params,
      });

      const pageData = response.data.data;
      setDefects(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("불량 목록 조회 실패:", error);
      window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [page, searchFilters, sortParams, refreshKey]);

  useEffect(() => {
    loadDefects();
  }, [loadDefects]);

  const handleSearch = () => {
    setPage(0);
    setSearchFilters({
      defCode: defCodeRef.current?.value.trim() || "",
      operCode: operCodeRef.current?.value.trim() || "",
      defNm: defNmRef.current?.value.trim() || "",
      defType: defTypeRef.current?.value.trim() || "",
      severity: severityRef.current?.value.trim() || "",
      useYn: useYnRef.current?.value.trim() || "",
    });
    setEditingDefCode(null);
    setIsCreatingNewRow(false);
  };

  const handleReset = () => {
    if (defCodeRef.current) defCodeRef.current.value = "";
    if (operCodeRef.current) operCodeRef.current.value = "";
    if (defNmRef.current) defNmRef.current.value = "";
    if (defTypeRef.current) defTypeRef.current.value = "";
    if (severityRef.current) severityRef.current.value = "";
    if (useYnRef.current) useYnRef.current.value = "";

    setPage(0);
    setSearchFilters({
      defCode: "",
      operCode: "",
      defNm: "",
      defType: "",
      severity: "",
      useYn: "",
    });
    setSorting([]);
    setEditingDefCode(null);
    setIsCreatingNewRow(false);
  };

  const handlePageChange = (newPage: number) => {
    setEditingDefCode(null);
    setIsCreatingNewRow(false);
    setPage(newPage);
  };

  const handleStartCreate = () => {
    if (isCreatingNewRow) return;
    setEditingDefCode(null);
    editFormRef.current = {
      defCode: "",
      operCode: "",
      defNm: "",
      defType: "",
      severity: "",
    };
    setIsCreatingNewRow(true);
  };

  const handleCancelCreate = () => {
    setIsCreatingNewRow(false);
  };

  // 인라인 신규 등록 API 저장
  const handleSaveCreate = async () => {
    if (isUpdating) return;

    const newDefCode = editFormRef.current.defCode?.trim();
    if (!newDefCode) {
      window.alert("불량코드를 입력해주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const payload: DefectCreateRequest = {
        defCode: newDefCode,
        operCode: editFormRef.current.operCode?.trim() || null,
        defNm: editFormRef.current.defNm?.trim() || null,
        defType: editFormRef.current.defType?.trim() || null,
        severity: editFormRef.current.severity?.trim() || null,
      };

      const response = await apiClient.post<ApiResponseDefectResponse>("/defects", payload);

      window.alert(response.data?.message || "등록되었습니다.");
      setIsCreatingNewRow(false);

      if (defCodeRef.current) defCodeRef.current.value = "";
      if (operCodeRef.current) operCodeRef.current.value = "";
      if (defNmRef.current) defNmRef.current.value = "";
      if (defTypeRef.current) defTypeRef.current.value = "";
      if (severityRef.current) severityRef.current.value = "";
      if (useYnRef.current) useYnRef.current.value = "";

      // 등록 시에는 전체 목록으로 이동
      setPage(0);
      setSearchFilters({
        defCode: "",
        operCode: "",
        defNm: "",
        defType: "",
        severity: "",
        useYn: "",
      });
      setSorting([]);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error("등록 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || "등록에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartEdit = (row: DefectResponse) => {
    setIsCreatingNewRow(false);
    editFormRef.current = {
      operCode: row.operCode ?? "",
      defNm: row.defNm ?? "",
      defType: row.defType ?? "",
      severity: row.severity ?? "",
    };
    setEditingDefCode(row.defCode);
  };

  const handleCancelEdit = () => {
    setEditingDefCode(null);
    editFormRef.current = { operCode: "", defNm: "", defType: "", severity: "" };
  };

  // 인라인 수정 저장 (현재 검색 필터 상태 유지하며 새로고침)
  const handleSaveEdit = async (defCode: string) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: DefectUpdateRequest = {
        operCode: editFormRef.current.operCode?.trim() ? editFormRef.current.operCode.trim() : null,
        defNm: editFormRef.current.defNm?.trim() ? editFormRef.current.defNm.trim() : null,
        defType: editFormRef.current.defType?.trim() ? editFormRef.current.defType.trim() : null,
        severity: editFormRef.current.severity?.trim() ? editFormRef.current.severity.trim() : null,
      };

      const encodedDefCode = encodeURIComponent(defCode);
      const response = await apiClient.put<ApiResponseDefectResponse>(
        `/defects/${encodedDefCode}`,
        updatePayload
      );

      window.alert(response.data?.message || "수정되었습니다.");
      setEditingDefCode(null);
      setRefreshKey((prev) => prev + 1); // 현재 검색 조건 유지한 채 리프레시
    } catch (err) {
      console.error("수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 행 삭제 (현재 검색 필터 상태 유지하며 새로고침)
  const handleDeleteDefect = async (defCode: string) => {
    if (isDeletingDefCode) return;

    const confirmed = window.confirm(`[${defCode}] 불량 항목을 삭제(비활성화)하시겠습니까?`);
    if (!confirmed) return;

    setIsDeletingDefCode(defCode);
    try {
      const encodedDefCode = encodeURIComponent(defCode);
      await apiClient.delete(`/defects/${encodedDefCode}`);

      window.alert("불량 항목이 삭제(비활성화)되었습니다.");
      setRefreshKey((prev) => prev + 1); // 현재 검색 조건 유지한 채 리프레시
    } catch (error) {
      console.error("불량 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || "불량 삭제에 실패했습니다.");
    } finally {
      setIsDeletingDefCode(null);
    }
  };

  const columns: ColumnDef<DefectResponse>[] = useMemo(
    () => [
      {
        accessorKey: "defCode",
        header: "불량코드",
        cell: ({ row }) => {
          if (row.original.defCode === "__NEW_ROW__") {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.defCode ?? ""}
                onChange={(e) => {
                  editFormRef.current.defCode = e.target.value;
                }}
                placeholder="불량코드 입력"
                autoFocus
              />
            );
          }
          return row.original.defCode;
        },
      },
      {
        accessorKey: "operCode",
        header: "공정코드",
        cell: ({ row }) => {
          const isNewRow = row.original.defCode === "__NEW_ROW__";
          const isEditing = row.original.defCode === editingDefCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.operCode ?? ""}
                onChange={(e) => {
                  editFormRef.current.operCode = e.target.value;
                }}
                placeholder="공정코드 입력"
              />
            );
          }
          return row.original.operCode || "-";
        },
      },
      {
        accessorKey: "defNm",
        header: "불량명",
        cell: ({ row }) => {
          const isNewRow = row.original.defCode === "__NEW_ROW__";
          const isEditing = row.original.defCode === editingDefCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.defNm ?? ""}
                onChange={(e) => {
                  editFormRef.current.defNm = e.target.value;
                }}
                placeholder="불량명 입력"
              />
            );
          }
          return row.original.defNm || "-";
        },
      },
      {
        accessorKey: "defType",
        header: "불량유형",
        cell: ({ row }) => {
          const isNewRow = row.original.defCode === "__NEW_ROW__";
          const isEditing = row.original.defCode === editingDefCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.defType ?? ""}
                onChange={(e) => {
                  editFormRef.current.defType = e.target.value;
                }}
                placeholder="불량유형 입력"
              />
            );
          }
          return row.original.defType || "-";
        },
      },
      {
        accessorKey: "severity",
        header: "심각도",
        cell: ({ row }) => {
          const isNewRow = row.original.defCode === "__NEW_ROW__";
          const isEditing = row.original.defCode === editingDefCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.severity ?? ""}
                onChange={(e) => {
                  editFormRef.current.severity = e.target.value;
                }}
                placeholder="심각도 입력"
              />
            );
          }
          return row.original.severity || "-";
        },
      },
      {
        accessorKey: "useYn",
        header: "사용여부",
        cell: ({ row, getValue }) => {
          if (row.original.defCode === "__NEW_ROW__") {
            return <Badge tone="good">사용</Badge>;
          }
          const isUse = getValue<string>() === "Y";
          return <Badge tone={isUse ? "good" : "muted"}>{isUse ? "사용" : "미사용"}</Badge>;
        },
      },
      {
        accessorKey: "createdAt",
        header: "등록일자",
        cell: ({ row, getValue }) => {
          if (row.original.defCode === "__NEW_ROW__") return "-";
          return formatDateTime(getValue<string>());
        },
      },
      {
        id: "actions",
        header: "관리",
        meta: { width: "130px" },
        cell: ({ row }) => {
          const isNewRow = row.original.defCode === "__NEW_ROW__";
          const isEditing = row.original.defCode === editingDefCode;
          const isDeleting = isDeletingDefCode === row.original.defCode;
          const isUsed = row.original.useYn === "Y";

          if (isNewRow) {
            return (
              <div className="rowActions" style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className="miniButton primary"
                  disabled={isUpdating}
                  onClick={handleSaveCreate}
                >
                  {isUpdating ? "저장 중" : "저장"}
                </button>
                <button
                  type="button"
                  className="miniButton danger"
                  disabled={isUpdating}
                  onClick={handleCancelCreate}
                >
                  취소
                </button>
              </div>
            );
          }

          if (isEditing) {
            return (
              <div className="rowActions" style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className="miniButton primary"
                  disabled={isUpdating}
                  onClick={() => handleSaveEdit(row.original.defCode)}
                >
                  {isUpdating ? "저장 중" : "저장"}
                </button>
                <button
                  type="button"
                  className="miniButton danger"
                  disabled={isUpdating}
                  onClick={handleCancelEdit}
                >
                  취소
                </button>
              </div>
            );
          }

          return (
            <div className="rowActions" style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                className="miniButton"
                disabled={editingDefCode !== null || isCreatingNewRow || isDeleting}
                onClick={() => handleStartEdit(row.original)}
              >
                수정
              </button>
              <button
                type="button"
                className="miniButton danger"
                disabled={editingDefCode !== null || isCreatingNewRow || isDeleting || !isUsed}
                onClick={() => handleDeleteDefect(row.original.defCode)}
              >
                {isDeleting ? "삭제 중" : "삭제"}
              </button>
            </div>
          );
        },
      },
    ],
    [editingDefCode, isCreatingNewRow, isUpdating, isDeletingDefCode]
  );

  const displayDefects = useMemo(() => {
    if (isCreatingNewRow) {
      const dummyNewRow: DefectResponse = {
        defCode: "__NEW_ROW__",
        operCode: "",
        defNm: "",
        defType: "",
        severity: "",
        useYn: "Y",
        createdAt: "",
        updatedAt: "",
      };
      return [dummyNewRow, ...defects];
    }
    return defects;
  }, [isCreatingNewRow, defects]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="불량관리 목록" action="등록" onAction={handleStartCreate}>
         <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={displayDefects}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                noDataMessage="조회된 데이터가 없습니다."
              />
              <CusPagination
                page={page}
                totalPages={totalPages}
                totalCount={totalElements}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </Panel>
    </section>
  );
}