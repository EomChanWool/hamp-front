import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  DefectResponse,
  DefectDetailResponse,
  ApiResponseDefectDetailResponse,
  ApiResponsePageDefectResponse,
  DefectUpdateRequest,
} from "@/types/master/Defect";

export function MasterDefectsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [defects, setDefects] = useState<DefectResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingDefCode, setDetailLoadingDefCode] = useState<string | null>(null);

  // 수정 및 삭제 상태 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalDefect, setModalDefect] = useState<DefectDetailResponse | null>(null);

  const detailRequestIdRef = useRef(0);

  // URL에서 현재 페이지 및 검색어 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryDefCode = searchParams.get("defCode") || "";
  const queryOperCode = searchParams.get("operCode") || "";
  const queryDefNm = searchParams.get("defNm") || "";
  const queryDefType = searchParams.get("defType") || "";
  const querySeverity = searchParams.get("severity") || "";
  const queryUseYn = searchParams.get("useYn") || "";

  // 검색 필드 Refs
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

  // URL Query가 바뀔 때 Input/Select 필드 값 복원
  useEffect(() => {
    if (defCodeRef.current) defCodeRef.current.value = queryDefCode;
    if (operCodeRef.current) operCodeRef.current.value = queryOperCode;
    if (defNmRef.current) defNmRef.current.value = queryDefNm;
    if (defTypeRef.current) defTypeRef.current.value = queryDefType;
    if (severityRef.current) severityRef.current.value = querySeverity;
    if (useYnRef.current) useYnRef.current.value = queryUseYn;
  }, [
    queryDefCode,
    queryOperCode,
    queryDefNm,
    queryDefType,
    querySeverity,
    queryUseYn,
  ]);

  // 1. 불량 목록 조회 (useCallback으로 메모이제이션)
  const loadDefects = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        size: 10,
      };

      if (queryDefCode) params.defCode = queryDefCode;
      if (queryOperCode) params.operCode = queryOperCode;
      if (queryDefNm) params.defNm = queryDefNm;
      if (queryDefType) params.defType = queryDefType;
      if (querySeverity) params.severity = querySeverity;
      if (queryUseYn) params.useYn = queryUseYn;

      const response = await apiClient.get<ApiResponsePageDefectResponse>("/defects", {
        params,
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
  }, [
    currentPage,
    queryDefCode,
    queryOperCode,
    queryDefNm,
    queryDefType,
    querySeverity,
    queryUseYn,
  ]);

  // URL 쿼리 파라미터 변경 시 자동 재조회
  useEffect(() => {
    loadDefects();
  }, [loadDefects]);

  // 검색 버튼 클릭 시
  const handleSearch = () => {
    const nextParams: Record<string, string> = { page: "0" };

    const defCode = defCodeRef.current?.value.trim();
    const operCode = operCodeRef.current?.value.trim();
    const defNm = defNmRef.current?.value.trim();
    const defType = defTypeRef.current?.value.trim();
    const severity = severityRef.current?.value.trim();
    const useYn = useYnRef.current?.value.trim();

    if (defCode) nextParams.defCode = defCode;
    if (operCode) nextParams.operCode = operCode;
    if (defNm) nextParams.defNm = defNm;
    if (defType) nextParams.defType = defType;
    if (severity) nextParams.severity = severity;
    if (useYn) nextParams.useYn = useYn;

    setSearchParams(nextParams);
  };

  // 검색 초기화 시
  const handleReset = () => {
    [defCodeRef, operCodeRef, defNmRef, defTypeRef, severityRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    if (useYnRef.current) useYnRef.current.value = "";
    setSearchParams({ page: "0" });
  };

  // 페이지 이동 시
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  // 2. 불량 상세 조회 (GET /defects/{defCode})
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

  // 3. 등록 페이지로 이동
  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/defects/create?${queryString}` : "/master/defects/create");
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
      await loadDefects();
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

  // 5. 불량 삭제 처리 (DELETE /defects/{defCode})
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
      await loadDefects();
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

  // 모달 상세 필드 설정
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

      <Panel title="불량관리 목록" action="등록" onAction={handleCreate}>
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
            onPageChange={handlePageChange}
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
    </section>
  );
}