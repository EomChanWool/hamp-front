import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { DepartmentCreateModal } from "@components/common/DepartmentCreateModal";
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
  DepartmentCreateRequest,
  DepartmentOptionResponse,
  ApiResponseListDepartmentOptionResponse,
} from "@/types/master/Department";

export function MasterDepartmentPage() {
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // 인라인 수정 상태 관리 (현재 수정 중인 부서코드와 폼 데이터)
  const [editingDepCode, setEditingDepCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DepartmentUpdateRequest>({
    head: "",
    headPhone: "",
    taskDesc: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingDepCode, setIsDeletingDepCode] = useState<string | null>(null);

  // 등록 모달 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);

  // 검색 필드 Refs
  const depCodeRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const taskDescRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLInputElement>(null);
  const headPhoneRef = useRef<HTMLInputElement>(null);

  // 부서 옵션 API 호출
  const loadDepartmentOptions = async () => {
    try {
      const response = await apiClient.get<ApiResponseListDepartmentOptionResponse>(
        "/departments/options"
      );
      setDepartmentOptions(response.data.data ?? []);
    } catch (error) {
      console.error("부서 옵션 목록 조회 실패:", error);
    }
  };

  useEffect(() => {
    loadDepartmentOptions();
  }, []);

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
  const loadDepartments = async (page: number, params: Record<string, string>) => {
    setIsLoading(true);
    try {
      const cleanedParams = Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (value && value.trim() !== "") acc[key] = value.trim();
          return acc;
        },
        {} as Record<string, string>
      );

      const response = await apiClient.get<ApiResponsePageDepartmentResponse>("/departments", {
        params: { ...cleanedParams, page, size: 10 },
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
  };

  useEffect(() => {
    loadDepartments(currentPage, searchParams);
  }, [currentPage, searchParams]);

  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (depCodeRef.current?.value.trim()) params.depCode = depCodeRef.current.value.trim();
    if (taskDescRef.current?.value.trim()) params.taskDesc = taskDescRef.current.value.trim();
    if (headRef.current?.value.trim()) params.head = headRef.current.value.trim();
    if (headPhoneRef.current?.value.trim()) params.headPhone = headPhoneRef.current.value.trim();

    setCurrentPage(0);
    setEditingDepCode(null); // 검색 시 편집 모드 해제
    setSearchParams(params);
  };

  const handleReset = () => {
    [depCodeRef, taskDescRef, headRef, headPhoneRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });

    setCurrentPage(0);
    setEditingDepCode(null);
    setSearchParams({});
  };

  // 신규 부서 등록
  const handleCreateDepartment = async (formData: DepartmentCreateRequest) => {
    setIsCreating(true);
    try {
      await apiClient.post("/departments", formData);
      window.alert("성공적으로 등록되었습니다.");
      setIsCreateModalOpen(false);
      await loadDepartments(currentPage, searchParams);
      await loadDepartmentOptions();
    } catch (error) {
      console.error("부서 등록 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || "부서 등록 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  // 인라인 편집 시작
  const handleStartEdit = (row: DepartmentResponse) => {
    setEditingDepCode(row.depCode);
    setEditForm({
      head: row.head ?? "",
      headPhone: row.headPhone ?? "",
      taskDesc: row.taskDesc ?? "",
    });
  };

  // 인라인 편집 취소
  const handleCancelEdit = () => {
    setEditingDepCode(null);
    setEditForm({ head: "", headPhone: "", taskDesc: "" });
  };

  // 인라인 수정 저장
  const handleSaveEdit = async (depCode: string) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: DepartmentUpdateRequest = {
        head: editForm.head?.trim() ? editForm.head.trim() : null,
        headPhone: editForm.headPhone?.trim() ? editForm.headPhone.trim() : null,
        taskDesc: editForm.taskDesc?.trim() ? editForm.taskDesc.trim() : null,
      };

      const encodedDepCode = encodeURIComponent(depCode);
      const response = await apiClient.put<ApiResponseDepartmentResponse>(
        `/departments/${encodedDepCode}`,
        updatePayload
      );

      window.alert(response.data?.message || "수정되었습니다.");
      setEditingDepCode(null);
      await loadDepartments(currentPage, searchParams);
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
      await loadDepartments(currentPage, searchParams);
      await loadDepartmentOptions();
    } catch (error) {
      console.error("부서 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || "부서 삭제에 실패했습니다.");
    } finally {
      setIsDeletingDepCode(null);
    }
  };

  // 테이블 컬럼 정의 (인라인 수정 모드 반영)
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
                value={editForm.head ?? ""}
                onChange={(e) => setEditForm((prev) => ({ ...prev, head: e.target.value }))}
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
                value={editForm.headPhone ?? ""}
                onChange={(e) => setEditForm((prev) => ({ ...prev, headPhone: e.target.value }))}
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
                value={editForm.taskDesc ?? ""}
                onChange={(e) => setEditForm((prev) => ({ ...prev, taskDesc: e.target.value }))}
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
    [editingDepCode, editForm, isUpdating, isDeletingDepCode]
  );

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="부서 관리 목록" action="등록" onAction={() => setIsCreateModalOpen(true)}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={departments}
            columns={columns}
            // 인라인 수정을 사용할 경우 행 클릭 이벤트를 제거하거나, 클릭 시 자동 수정 모드로 진입하게 설정
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={(page) => {
              setEditingDepCode(null); // 페이지 변경 시 편집 상태 초기화
              setCurrentPage(page);
            }}
          />
        </div>
      </Panel>

      {/* 신규 부서 등록 모달 */}
      <DepartmentCreateModal
        isOpen={isCreateModalOpen}
        isLoading={isCreating}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateDepartment}
      />
    </section>
  );
}