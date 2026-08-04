import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
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
  const [detailLoadingDepCode, setDetailLoadingDepCode] = useState<string | null>(null);

  // 수정 및 삭제 상태 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalDepartment, setModalDepartment] = useState<DepartmentResponse | null>(null);

  // 등록 모달 및 생성 중 로딩 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const detailRequestIdRef = useRef(0);

  // 검색 필드 Refs (select도 HTMLSelectElement / HTMLInputElement ref로 공유 가능)
  const depCodeRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const taskDescRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLInputElement>(null);
  const headPhoneRef = useRef<HTMLInputElement>(null);

  // 부서 옵션 API 호출
  useEffect(() => {
    const fetchDepartmentOptions = async () => {
      try {
        const response = await apiClient.get<ApiResponseListDepartmentOptionResponse>(
          "/departments/options"
        );
        setDepartmentOptions(response.data.data ?? []);
      } catch (error) {
        console.error("부서 옵션 목록 조회 실패:", error);
      }
    };

    fetchDepartmentOptions();
  }, []);

  // 검색 필드 정의 (부서코드를 셀렉트 박스로 사용)
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

  // 부서 상세 조회
  const handleOpenDetail = async (depCode: string) => {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoadingDepCode(depCode);

    try {
      const encodedDepCode = encodeURIComponent(depCode);
      const response = await apiClient.get<ApiResponseDepartmentResponse>(
        `/departments/${encodedDepCode}`
      );
      const department = response.data.data;

      if (!department) throw new Error("부서 상세 데이터가 없습니다.");

      if (requestId === detailRequestIdRef.current) {
        setModalDepartment(department);
      }
    } catch (error) {
      console.error("부서 상세 조회 실패:", error);
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
        setDetailLoadingDepCode(null);
      }
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
    setSearchParams(params);
  };

  const handleReset = () => {
    [depCodeRef, taskDescRef, headRef, headPhoneRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });

    setCurrentPage(0);
    setSearchParams({});
  };

  // 신규 부서 등록 (등록 성공 시 옵션 목록도 새로고침하도록 추가)
  const handleCreateDepartment = async (formData: DepartmentCreateRequest) => {
    setIsCreating(true);
    try {
      await apiClient.post("/departments", formData);
      window.alert("성공적으로 등록되었습니다.");
      setIsCreateModalOpen(false);
      await loadDepartments(currentPage, searchParams);
      
      // 부서 신규 생성 시 옵션 드롭다운 리스트도 동기화
      const optRes = await apiClient.get<ApiResponseListDepartmentOptionResponse>("/departments/options");
      setDepartmentOptions(optRes.data.data ?? []);
    } catch (error) {
      console.error("부서 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "부서 등록 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  // 부서 정보 수정
  const handleSave = async (updated: Record<string, string>) => {
    if (!modalDepartment || isUpdating) return;

    setIsUpdating(true);
    try {
      const taskDescVal = "taskDesc" in updated ? updated.taskDesc : modalDepartment.taskDesc;
      const headVal = "head" in updated ? updated.head : modalDepartment.head;
      const headPhoneVal = "headPhone" in updated ? updated.headPhone : modalDepartment.headPhone;

      const updatePayload: DepartmentUpdateRequest = {
        taskDesc: taskDescVal?.trim() ? taskDescVal.trim() : null,
        head: headVal?.trim() ? headVal.trim() : null,
        headPhone: headPhoneVal?.trim() ? headPhoneVal.trim() : null,
      };

      const encodedDepCode = encodeURIComponent(modalDepartment.depCode);

      const response = await apiClient.put<ApiResponseDepartmentResponse>(
        `/departments/${encodedDepCode}`,
        updatePayload
      );

      const successMessage = response.data?.message || "수정되었습니다.";
      window.alert(successMessage);

      setModalDepartment(null);
      await loadDepartments(currentPage, searchParams);

      // 옵션 응답의 taskDesc 정보가 바뀔 수 있으므로 재호출
      const optRes = await apiClient.get<ApiResponseListDepartmentOptionResponse>("/departments/options");
      setDepartmentOptions(optRes.data.data ?? []);
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

  // 부서 삭제 처리
  const handleDeleteDepartment = async () => {
    if (!modalDepartment || isDeleting) return;

    const confirmed = window.confirm(
      `[${modalDepartment.depCode}] 부서를 삭제하시겠습니까?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const encodedDepCode = encodeURIComponent(modalDepartment.depCode);
      await apiClient.delete(`/departments/${encodedDepCode}`);
      
      window.alert("부서가 삭제되었습니다.");
      setModalDepartment(null);
      await loadDepartments(currentPage, searchParams);

      // 삭제 시 옵션 드롭다운 리스트 동기화
      const optRes = await apiClient.get<ApiResponseListDepartmentOptionResponse>("/departments/options");
      setDepartmentOptions(optRes.data.data ?? []);
    } catch (error) {
      console.error("부서 삭제 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "부서 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<DepartmentResponse>[] = useMemo(
    () => [
      { accessorKey: "depCode", header: "부서코드" },
      { accessorKey: "head", header: "부서장" },
      { accessorKey: "headPhone", header: "대표 연락처" },
      { accessorKey: "taskDesc", header: "담당업무" },
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
              disabled={detailLoadingDepCode === row.original.depCode}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(row.original.depCode);
              }}
            >
              {detailLoadingDepCode === row.original.depCode ? "조회 중..." : "상세"}
            </button>
          </div>
        ),
      },
    ],
    [detailLoadingDepCode]
  );

  const detailFields = [
    { label: "부서코드", key: "depCode", editable: false },
    { label: "부서장", key: "head" },
    { label: "대표 연락처", key: "headPhone" },
    { label: "담당업무", key: "taskDesc" },
    { label: "생성일시", key: "createdAt", editable: false },
    { label: "수정일시", key: "updatedAt", editable: false },
  ];

  const modalData = useMemo(() => {
    if (!modalDepartment) return {};
    return {
      depCode: modalDepartment.depCode,
      head: modalDepartment.head ?? "",
      headPhone: modalDepartment.headPhone ?? "",
      taskDesc: modalDepartment.taskDesc ?? "",
      createdAt: formatDateTime(modalDepartment.createdAt),
      updatedAt: formatDateTime(modalDepartment.updatedAt),
    };
  }, [modalDepartment]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="부서 관리 목록" action="등록" onAction={() => setIsCreateModalOpen(true)}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={departments}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.depCode)}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={setCurrentPage}
          />
        </div>
      </Panel>

      {/* 부서 상세/수정 모달 */}
      <RowDetailModal
        isOpen={modalDepartment !== null}
        onClose={() => {
          if (!isDeleting && !isUpdating) setModalDepartment(null);
        }}
        onSave={handleSave}
        fields={detailFields}
        data={modalData as unknown as Record<string, string>}
        dangerAction={{
          label: "부서 삭제",
          loadingLabel: "삭제 처리 중...",
          onClick: handleDeleteDepartment,
          isLoading: isDeleting,
        }}
      />

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