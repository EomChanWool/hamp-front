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
  DepartmentResponse,
  ApiResponseDepartmentResponse,
  ApiResponsePageDepartmentResponse,
  DepartmentUpdateRequest,
  DepartmentOptionResponse,
  ApiResponseListDepartmentOptionResponse,
} from "@/types/master/Department";
import Spinner from "@/components/common/Spinner";

interface DepartmentCreateRequest extends DepartmentUpdateRequest {
  depCode: string;
}

export function MasterDepartmentPage() {
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 데이터 재조회를 위한 트리거 키
  const [refreshKey, setRefreshKey] = useState(0);

  // 페이지 및 검색 조건을 React State로 관리
  const [page, setPage] = useState(0);
  const [searchFilters, setSearchFilters] = useState({
    depCode: "",
    taskDesc: "",
    head: "",
    headPhone: "",
  });

  const [sorting, setSorting] = useState<SortingState>([]);

  // 서버로 보낼 sort 파라미터 변환
  const sortParams = useMemo(() => {
    return sorting.map((sort) => `${sort.id},${sort.desc ? "desc" : "asc"}`);
  }, [sorting]);

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
    setPage(0);
    setEditingDepCode(null);
    setIsCreatingNewRow(false);
  };

  // 인라인 수정 상태 관리
  const [editingDepCode, setEditingDepCode] = useState<string | null>(null);

  // 인라인 등록 상태 관리
  const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);

  // 타이핑 시 리렌더링 방지 폼 Ref
  const editFormRef = useRef<DepartmentUpdateRequest & { depCode?: string }>({
    depCode: "",
    head: "",
    headPhone: "",
    taskDesc: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingDepCode, setIsDeletingDepCode] = useState<string | null>(null);

  // 검색 필드 Refs
  const depCodeRef = useRef<HTMLSelectElement>(null);
  const taskDescRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLInputElement>(null);
  const headPhoneRef = useRef<HTMLInputElement>(null);

  // 부서 옵션 API 호출
  const loadDepartmentOptions = useCallback(async () => {
    try {
      const response = await apiClient.get<ApiResponseListDepartmentOptionResponse>(
        "/departments/options"
      );
      setDepartmentOptions(response.data.data ?? []);
    } catch (error) {
      console.error("부서 옵션 목록 조회 실패:", error);
    }
  }, []);

  useEffect(() => {
    loadDepartmentOptions();
  }, [loadDepartmentOptions]);

  // 검색 필드 정의
  const searchFields: SearchField[] = [
    {
      type: "select",
      label: "부서코드",
      ref: depCodeRef as any,
      options: [
        { label: "전체", value: "" },
        ...departmentOptions.map((opt) => ({
          label: `${opt.depCode} (${opt.taskDesc})`,
          value: opt.depCode,
        })),
      ],
    },
    { type: "input", label: "담당업무", ref: taskDescRef, name: "taskDesc" },
    { type: "input", label: "부서장", ref: headRef, name: "headRef" },
    { type: "input", label: "대표 연락처", ref: headPhoneRef, name: "headPhone" },
  ];

  // 부서 목록 조회
  const loadDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        size: 10,
      };
      if (searchFilters.depCode) params.depCode = searchFilters.depCode;
      if (searchFilters.taskDesc) params.taskDesc = searchFilters.taskDesc;
      if (searchFilters.head) params.head = searchFilters.head;
      if (searchFilters.headPhone) params.headPhone = searchFilters.headPhone;

      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await apiClient.get<ApiResponsePageDepartmentResponse>("/departments", {
        params,
      });

      const pageData = response.data.data;
      setDepartments(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("부서 목록 조회 실패:", error);
      window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [page, searchFilters, sortParams, refreshKey]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const handleSearch = () => {
    setPage(0);
    setSearchFilters({
      depCode: depCodeRef.current?.value.trim() || "",
      taskDesc: taskDescRef.current?.value.trim() || "",
      head: headRef.current?.value.trim() || "",
      headPhone: headPhoneRef.current?.value.trim() || "",
    });
    setEditingDepCode(null);
    setIsCreatingNewRow(false);
  };

  const handleReset = () => {
    if (depCodeRef.current) depCodeRef.current.value = "";
    if (taskDescRef.current) taskDescRef.current.value = "";
    if (headRef.current) headRef.current.value = "";
    if (headPhoneRef.current) headPhoneRef.current.value = "";

    setPage(0);
    setSearchFilters({
      depCode: "",
      taskDesc: "",
      head: "",
      headPhone: "",
    });
    setSorting([]);
    setEditingDepCode(null);
    setIsCreatingNewRow(false);
  };

  const handlePageChange = (newPage: number) => {
    setEditingDepCode(null);
    setIsCreatingNewRow(false);
    setPage(newPage);
  };

  const handleStartCreate = () => {
    if (isCreatingNewRow) return;
    setEditingDepCode(null);
    editFormRef.current = {
      depCode: "",
      head: "",
      headPhone: "",
      taskDesc: "",
    };
    setIsCreatingNewRow(true);
  };

  const handleCancelCreate = () => {
    setIsCreatingNewRow(false);
  };

  // 인라인 신규 등록 API 저장
  const handleSaveCreate = async () => {
    if (isUpdating) return;

    const newDepCode = editFormRef.current.depCode?.trim();
    if (!newDepCode) {
      window.alert("부서코드를 입력해주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const payload: DepartmentCreateRequest = {
        depCode: newDepCode,
        head: editFormRef.current.head?.trim() || null,
        headPhone: editFormRef.current.headPhone?.trim() || null,
        taskDesc: editFormRef.current.taskDesc?.trim() || null,
      };

      const response = await apiClient.post<ApiResponseDepartmentResponse>("/departments", payload);

      window.alert(response.data?.message || "등록되었습니다.");
      setIsCreatingNewRow(false);

      if (depCodeRef.current) depCodeRef.current.value = "";
      if (taskDescRef.current) taskDescRef.current.value = "";
      if (headRef.current) headRef.current.value = "";
      if (headPhoneRef.current) headPhoneRef.current.value = "";

      setPage(0);
      setSearchFilters({
        depCode: "",
        taskDesc: "",
        head: "",
        headPhone: "",
      });
      setSorting([]);
      await loadDepartmentOptions();
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error("등록 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || "등록에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartEdit = (row: DepartmentResponse) => {
    setIsCreatingNewRow(false);
    editFormRef.current = {
      head: row.head ?? "",
      headPhone: row.headPhone ?? "",
      taskDesc: row.taskDesc ?? "",
    };
    setEditingDepCode(row.depCode);
  };

  const handleCancelEdit = () => {
    setEditingDepCode(null);
    editFormRef.current = { head: "", headPhone: "", taskDesc: "" };
  };

  // 인라인 수정 저장
  const handleSaveEdit = async (depCode: string) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: DepartmentUpdateRequest = {
        head: editFormRef.current.head?.trim() ? editFormRef.current.head.trim() : null,
        headPhone: editFormRef.current.headPhone?.trim() ? editFormRef.current.headPhone.trim() : null,
        taskDesc: editFormRef.current.taskDesc?.trim() ? editFormRef.current.taskDesc.trim() : null,
      };

      const encodedDepCode = encodeURIComponent(depCode);
      const response = await apiClient.put<ApiResponseDepartmentResponse>(
        `/departments/${encodedDepCode}`,
        updatePayload
      );

      window.alert(response.data?.message || "수정되었습니다.");
      setEditingDepCode(null);
      await loadDepartmentOptions();
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error("수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 행 삭제
  const handleDeleteDepartment = async (depCode: string) => {
    if (isDeletingDepCode) return;

    const confirmed = window.confirm(`[${depCode}] 부서를 삭제하시겠습니까?`);
    if (!confirmed) return;

    setIsDeletingDepCode(depCode);
    try {
      const encodedDepCode = encodeURIComponent(depCode);
      await apiClient.delete(`/departments/${encodedDepCode}`);

      window.alert("부서가 삭제되었습니다.");
      await loadDepartmentOptions();
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("부서 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || "부서 삭제에 실패했습니다.");
    } finally {
      setIsDeletingDepCode(null);
    }
  };

  const columns: ColumnDef<DepartmentResponse>[] = useMemo(
    () => [
      {
        accessorKey: "depCode",
        header: "부서코드",
        cell: ({ row }) => {
          if (row.original.depCode === "__NEW_ROW__") {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.depCode ?? ""}
                onChange={(e) => {
                  editFormRef.current.depCode = e.target.value;
                }}
                placeholder="부서코드 입력"
                autoFocus
              />
            );
          }
          return row.original.depCode;
        },
      },
      {
        accessorKey: "head",
        header: "부서장",
        cell: ({ row }) => {
          const isNewRow = row.original.depCode === "__NEW_ROW__";
          const isEditing = row.original.depCode === editingDepCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.head ?? ""}
                onChange={(e) => {
                  editFormRef.current.head = e.target.value;
                }}
                placeholder="부서장 입력"
              />
            );
          }
          return row.original.head || "-";
        },
      },
      {
        accessorKey: "headPhone",
        header: "대표 연락처",
        cell: ({ row }) => {
          const isNewRow = row.original.depCode === "__NEW_ROW__";
          const isEditing = row.original.depCode === editingDepCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.headPhone ?? ""}
                onChange={(e) => {
                  editFormRef.current.headPhone = e.target.value;
                }}
                placeholder="연락처 입력"
              />
            );
          }
          return row.original.headPhone || "-";
        },
      },
      {
        accessorKey: "taskDesc",
        header: "담당업무",
        cell: ({ row }) => {
          const isNewRow = row.original.depCode === "__NEW_ROW__";
          const isEditing = row.original.depCode === editingDepCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.taskDesc ?? ""}
                onChange={(e) => {
                  editFormRef.current.taskDesc = e.target.value;
                }}
                placeholder="담당업무 입력"
              />
            );
          }
          return row.original.taskDesc || "-";
        },
      },
      {
        accessorKey: "createdAt",
        header: "등록일자",
        cell: ({ row, getValue }) => {
          if (row.original.depCode === "__NEW_ROW__") return "-";
          return formatDateTime(getValue<string>());
        },
      },
      {
        id: "actions",
        header: "관리",
        meta: { width: "130px" },
        cell: ({ row }) => {
          const isNewRow = row.original.depCode === "__NEW_ROW__";
          const isEditing = row.original.depCode === editingDepCode;
          const isDeleting = isDeletingDepCode === row.original.depCode;

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
                  onClick={() => handleSaveEdit(row.original.depCode)}
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
                disabled={editingDepCode !== null || isCreatingNewRow || isDeleting}
                onClick={() => handleStartEdit(row.original)}
              >
                수정
              </button>
              <button
                type="button"
                className="miniButton danger"
                disabled={editingDepCode !== null || isCreatingNewRow || isDeleting}
                onClick={() => handleDeleteDepartment(row.original.depCode)}
              >
                {isDeleting ? "삭제 중" : "삭제"}
              </button>
            </div>
          );
        },
      },
    ],
    [editingDepCode, isCreatingNewRow, isUpdating, isDeletingDepCode]
  );

  const displayDepartments = useMemo(() => {
    if (isCreatingNewRow) {
      const dummyNewRow: DepartmentResponse = {
        depCode: "__NEW_ROW__",
        head: "",
        headPhone: "",
        taskDesc: "",
        createdAt: "",
        updatedAt: "",
      };
      return [dummyNewRow, ...departments];
    }
    return departments;
  }, [isCreatingNewRow, departments]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="부서 관리 목록" action="등록" onAction={handleStartCreate}>
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={displayDepartments}
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