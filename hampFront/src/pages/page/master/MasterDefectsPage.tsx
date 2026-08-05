import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
import { DefectCreateModal } from "@components/common/DefectCreateModal";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";

import type {
  DefectResponse,
  DefectDetailResponse,
  ApiResponseDefectDetailResponse,
  ApiResponsePageDefectResponse,
  DefectCreateRequest,
  DefectUpdateRequest,
} from "@/types/master/Defect";

export function MasterDefectsPage() {
  const [defects, setDefects] = useState<DefectResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingDefCode, setDetailLoadingDefCode] = useState<string | null>(null);

  // 수정 및 삭제 상태 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalDefect, setModalDefect] = useState<DefectDetailResponse | null>(null);

  // 등록 모달 상태 관리
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const detailRequestIdRef = useRef(0);

  // 검색 필드 Refs (defCode, operCode, defNm, defType, severity, useYn)
  const defCodeRef = useRef<HTMLInputElement>(null);
  const operCodeRef = useRef<HTMLInputElement>(null);
  const defNmRef = useRef<HTMLInputElement>(null);
  const defTypeRef = useRef<HTMLInputElement>(null);
  const severityRef = useRef<HTMLInputElement>(null);
  const useYnRef = useRef<HTMLSelectElement>(null);

  const searchFields: SearchField[] = [
    { type: "input", label: "불량코드", ref: defCodeRef },
    { type: "input", label: "공정코드", ref: operCodeRef },
    { type: "input", label: "불량명", ref: defNmRef },
    { type: "input", label: "불량유형", ref: defTypeRef },
    { type: "input", label: "심각도", ref: severityRef },
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

  // 1. 불량 목록 조회 (GET /defects)
  const loadDefects = async (page: number, params: Record<string, string>) => {
    setIsLoading(true);
    try {
      const cleanedParams = Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (value && value.trim() !== "") acc[key] = value.trim();
          return acc;
        },
        {} as Record<string, string>
      );

      const response = await apiClient.get<ApiResponsePageDefectResponse>("/defects", {
        params: { ...cleanedParams, page, size: 10 },
      });

      const pageData = response.data.data;
      setDefects(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("불량 목록 조회 실패:", error);
      window.alert("불량 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 불량 단건 상세 조회 (GET /defects/{defCode})
  const handleOpenDetail = async (defCode: string) => {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoadingDefCode(defCode);

    try {
      const encodedDefCode = encodeURIComponent(defCode);
      const response = await apiClient.get<ApiResponseDefectDetailResponse>(
        `/defects/${encodedDefCode}`
      );
      const defect = response.data.data;

      if (!defect) throw new Error("불량 상세 데이터가 없습니다.");

      if (requestId === detailRequestIdRef.current) {
        setModalDefect(defect);
      }
    } catch (error) {
      console.error("불량 상세 조회 실패:", error);
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
        setDetailLoadingDefCode(null);
      }
    }
  };

  useEffect(() => {
    loadDefects(currentPage, searchParams);
  }, [currentPage, searchParams]);

  // 검색 핸들러
  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (defCodeRef.current?.value.trim()) params.defCode = defCodeRef.current.value.trim();
    if (operCodeRef.current?.value.trim()) params.operCode = operCodeRef.current.value.trim();
    if (defNmRef.current?.value.trim()) params.defNm = defNmRef.current.value.trim();
    if (defTypeRef.current?.value.trim()) params.defType = defTypeRef.current.value.trim();
    if (severityRef.current?.value.trim()) params.severity = severityRef.current.value.trim();
    if (useYnRef.current?.value.trim()) params.useYn = useYnRef.current.value.trim();

    setCurrentPage(0);
    setSearchParams(params);
  };

  // 검색 초기화
  const handleReset = () => {
    [defCodeRef, operCodeRef, defNmRef, defTypeRef, severityRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    if (useYnRef.current) useYnRef.current.value = "";

    setCurrentPage(0);
    setSearchParams({});
  };

  // 3. 신규 불량 등록 처리 (POST /defects)
  const handleCreateDefect = async (formData: DefectCreateRequest) => {
    setIsCreating(true);
    try {
      await apiClient.post("/defects", formData);
      window.alert("불량 항목이 성공적으로 등록되었습니다.");
      setIsCreateModalOpen(false);
      await loadDefects(currentPage, searchParams);
    } catch (error) {
      console.error("불량 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "불량 등록 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  // 4. 불량 정보 수정 처리 (PUT /defects/{defCode})
  const handleSave = async (updated: Record<string, string>) => {
    if (!modalDefect || isUpdating) return;

    setIsUpdating(true);
    try {
      const operCodeVal = "operCode" in updated ? updated.operCode : modalDefect.operCode;
      const defNmVal = "defNm" in updated ? updated.defNm : modalDefect.defNm;
      const defTypeVal = "defType" in updated ? updated.defType : modalDefect.defType;
      const severityVal = "severity" in updated ? updated.severity : modalDefect.severity;

      const updatePayload: DefectUpdateRequest = {
        operCode: operCodeVal?.trim() ? operCodeVal.trim() : null,
        defNm: defNmVal?.trim() ? defNmVal.trim() : null,
        defType: defTypeVal?.trim() ? defTypeVal.trim() : null,
        severity: severityVal?.trim() ? severityVal.trim() : null,
      };

      const encodedDefCode = encodeURIComponent(modalDefect.defCode);

      const response = await apiClient.put(`/defects/${encodedDefCode}`, updatePayload);

      const successMessage = response.data?.message || "수정되었습니다.";
      window.alert(successMessage);

      setModalDefect(null);
      await loadDefects(currentPage, searchParams);
    } catch (err) {
      console.error("불량 수정 실패:", err);
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.message
        : null;
      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 5. 불량 정보 삭제 처리 (DELETE /defects/{defCode})
  const handleDeleteDefect = async () => {
    if (!modalDefect || isDeleting) return;

    const confirmed = window.confirm(
      `${modalDefect.defNm ?? modalDefect.defCode} 불량 항목을 삭제하시겠습니까?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const encodedDefCode = encodeURIComponent(modalDefect.defCode);
      await apiClient.delete(`/defects/${encodedDefCode}`);
      window.alert("불량 항목이 삭제되었습니다.");
      setModalDefect(null);
      await loadDefects(currentPage, searchParams);
    } catch (error) {
      console.error("불량 삭제 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "불량 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<DefectResponse>[] = useMemo(
    () => [
      { accessorKey: "defCode", header: "불량코드" },
      { accessorKey: "operCode", header: "공정코드" },
      { accessorKey: "defNm", header: "불량명" },
      { accessorKey: "defType", header: "불량유형" },
      { accessorKey: "severity", header: "심각도" },
      { accessorKey: "useYn", header: "사용여부" },
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
              disabled={detailLoadingDefCode === row.original.defCode}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(row.original.defCode);
              }}
            >
              {detailLoadingDefCode === row.original.defCode ? "조회 중..." : "상세"}
            </button>
          </div>
        ),
      },
    ],
    [detailLoadingDefCode]
  );

  // 모달 상세 필드 설정 (상세 조회 추가 응답 항목 포함)
  const detailFields = [
    { label: "불량코드", key: "defCode", editable: false },
    { label: "공정코드", key: "operCode" },
    { label: "공정명", key: "operNm", editable: false },
    { label: "부서코드", key: "depCode", editable: false },
    { label: "작업설명", key: "taskDesc", editable: false },
    { label: "담당자", key: "head", editable: false },
    { label: "불량명", key: "defNm" },
    { label: "불량유형", key: "defType" },
    { label: "심각도", key: "severity" },
    { label: "사용여부", key: "useYn", editable: false },
    { label: "생성일시", key: "createdAt", editable: false },
    { label: "수정일시", key: "updatedAt", editable: false },
  ];

  const modalData = useMemo(() => {
    if (!modalDefect) return {};
    return {
      defCode: modalDefect.defCode,
      operCode: modalDefect.operCode ?? "",
      operNm: modalDefect.operNm ?? "",
      depCode: modalDefect.depCode ?? "",
      taskDesc: modalDefect.taskDesc ?? "",
      head: modalDefect.head ?? "",
      defNm: modalDefect.defNm ?? "",
      defType: modalDefect.defType ?? "",
      severity: modalDefect.severity ?? "",
      useYn: modalDefect.useYn ?? "",
      createdAt: formatDateTime(modalDefect.createdAt),
      updatedAt: formatDateTime(modalDefect.updatedAt),
    };
  }, [modalDefect]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="불량관리 목록" action="등록" onAction={() => setIsCreateModalOpen(true)}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={defects}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.defCode)}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={setCurrentPage}
          />
        </div>
      </Panel>

      {/* 불량 상세/수정 모달 */}
      <RowDetailModal
        isOpen={modalDefect !== null}
        onClose={() => {
          if (!isDeleting && !isUpdating) setModalDefect(null);
        }}
        onSave={handleSave}
        fields={detailFields}
        data={modalData as unknown as Record<string, string>}
        dangerAction={{
          label: "불량 삭제",
          loadingLabel: "삭제 처리 중...",
          onClick: handleDeleteDefect,
          isLoading: isDeleting,
        }}
      />

      {/* 신규 불량 등록 모달 */}
      <DefectCreateModal
        isOpen={isCreateModalOpen}
        isLoading={isCreating}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateDefect}
      />
    </section>
  );
}