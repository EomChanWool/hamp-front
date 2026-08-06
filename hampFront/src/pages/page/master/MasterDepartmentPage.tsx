import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
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

export function MasterDepartmentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 인라인 수정 상태 관리 (현재 수정 중인 부서코드)
  const [editingDepCode, setEditingDepCode] = useState<string | null>(null);
  
  // 타이핑 시 리렌더링을 방지하여 한 글자 입력 버그를 원천 차단하는 Ref
  const editFormRef = useRef<DepartmentUpdateRequest>({
    head: "",
    headPhone: "",
    taskDesc: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingDepCode, setIsDeletingDepCode] = useState<string | null>(null);

  // URL 쿼리 파라미터 값 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryDepCode = searchParams.get("depCode") || "";
  const queryTaskDesc = searchParams.get("taskDesc") || "";
  const queryHead = searchParams.get("head") || "";
  const queryHeadPhone = searchParams.get("headPhone") || "";

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

  // 검색 필드 DOM 값과 URL 쿼리 파라미터 동기화
  useEffect(() => {
    if (depCodeRef.current) depCodeRef.current.value = queryDepCode;
    if (taskDescRef.current) taskDescRef.current.value = queryTaskDesc;
    if (headRef.current) headRef.current.value = queryHead;
    if (headPhoneRef.current) headPhoneRef.current.value = queryHeadPhone;
  }, [
    queryDepCode,
    queryTaskDesc,
    queryHead,
    queryHeadPhone,
    departmentOptions,
  ]);

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
    { type: "input", label: "담당업무", ref: taskDescRef },
    { type: "input", label: "부서장", ref: headRef },
    { type: "input", label: "대표 연락처", ref: headPhoneRef },
  ];

  // 부서 목록 조회
  const loadDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        size: 10,
      };
      if (queryDepCode) params.depCode = queryDepCode;
      if (queryTaskDesc) params.taskDesc = queryTaskDesc;
      if (queryHead) params.head = queryHead;
      if (queryHeadPhone) params.headPhone = queryHeadPhone;

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
  }, [
    currentPage,
    queryDepCode,
    queryTaskDesc,
    queryHead,
    queryHeadPhone,
  ]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const handleSearch = () => {
    const nextParams: Record<string, string> = {
      page: "0",
    };

    const depCode = depCodeRef.current?.value.trim();
    const taskDesc = taskDescRef.current?.value.trim();
    const head = headRef.current?.value.trim();
    const headPhone = headPhoneRef.current?.value.trim();

    if (depCode) nextParams.depCode = depCode;
    if (taskDesc) nextParams.taskDesc = taskDesc;
    if (head) nextParams.head = head;
    if (headPhone) nextParams.headPhone = headPhone;

    setEditingDepCode(null);
    setSearchParams(nextParams);
  };

  const handleReset = () => {
    [taskDescRef, headRef, headPhoneRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    if (depCodeRef.current) depCodeRef.current.value = "";

    setEditingDepCode(null);
    setSearchParams({
      page: "0",
    });
  };

  const handlePageChange = (newPage: number) => {
    setEditingDepCode(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(
      queryString
        ? `/master/department/create?${queryString}`
        : "/master/department/create"
    );
  };

  // 인라인 편집 시작
  const handleStartEdit = (row: DepartmentResponse) => {
    editFormRef.current = {
      head: row.head ?? "",
      headPhone: row.headPhone ?? "",
      taskDesc: row.taskDesc ?? "",
    };
    setEditingDepCode(row.depCode);
  };

  // 인라인 편집 취소
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

      // 로컬 데이터 목록 즉시 갱신 (Optimistic Update)
      setDepartments((prev) =>
        prev.map((item) =>
          item.depCode === depCode
            ? {
                ...item,
                head: updatePayload.head ?? item.head,
                headPhone: updatePayload.headPhone ?? item.headPhone,
                taskDesc: updatePayload.taskDesc ?? item.taskDesc,
              }
            : item
        )
      );

      setEditingDepCode(null);
      await loadDepartments();
      await loadDepartmentOptions();
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
      await loadDepartments();
      await loadDepartmentOptions();
    } catch (error) {
      console.error("부서 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || "부서 삭제에 실패했습니다.");
    } finally {
      setIsDeletingDepCode(null);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<DepartmentResponse>[] = useMemo(
    () => [
      {
        accessorKey: "depCode",
        header: "부서코드",
      },
      {
        accessorKey: "head",
        header: "부서장",
        cell: ({ row }) => {
          const isEditing = row.original.depCode === editingDepCode;
          if (isEditing) {
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
          const isEditing = row.original.depCode === editingDepCode;
          if (isEditing) {
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
          const isEditing = row.original.depCode === editingDepCode;
          if (isEditing) {
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
        header: "생성일시",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
      {
        id: "actions",
        header: "관리",
        meta: { width: "130px" },
        cell: ({ row }) => {
          const isEditing = row.original.depCode === editingDepCode;
          const isDeleting = isDeletingDepCode === row.original.depCode;

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
                  className="miniButton ghostButton"
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
                disabled={editingDepCode !== null || isDeleting}
                onClick={() => handleStartEdit(row.original)}
              >
                수정
              </button>
              <button
                type="button"
                className="miniButton danger"
                disabled={editingDepCode !== null || isDeleting}
                onClick={() => handleDeleteDepartment(row.original.depCode)}
              >
                {isDeleting ? "삭제 중" : "삭제"}
              </button>
            </div>
          );
        },
      },
    ],
    [editingDepCode, isUpdating, isDeletingDepCode]
  );

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="부서 관리 목록" action="등록" onAction={handleCreate}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={departments}
            columns={columns}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={handlePageChange}
          />
        </div>
      </Panel>
    </section>
  );
}