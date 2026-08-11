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
  DefectResponse,
  ApiResponseDefectResponse,
  ApiResponsePageDefectResponse,
  DefectUpdateRequest,
} from "@/types/master/Defect";
import { Badge } from "@/components/common/Badge";

export function MasterDefectsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [defects, setDefects] = useState<DefectResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 인라인 수정 상태 관리 (현재 수정 중인 불량코드)
  const [editingDefCode, setEditingDefCode] = useState<string | null>(null);

  // 타이핑 시 리렌더링을 방지하여 한 글자 입력 버그를 원천 차단하는 Ref
  const editFormRef = useRef<DefectUpdateRequest>({
    operCode: "",
    defNm: "",
    defType: "",
    severity: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingDefCode, setIsDeletingDefCode] = useState<string | null>(null);

  // URL 쿼리 파라미터 값 추출
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

  // 검색 필드 정의
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

  // 검색 필드 DOM 값과 URL 쿼리 파라미터 동기화
  useEffect(() => {
    const timer = setTimeout(() => {
      if (defCodeRef.current) defCodeRef.current.value = queryDefCode;
      if (operCodeRef.current) operCodeRef.current.value = queryOperCode;
      if (defNmRef.current) defNmRef.current.value = queryDefNm;
      if (defTypeRef.current) defTypeRef.current.value = queryDefType;
      if (severityRef.current) severityRef.current.value = querySeverity;
      if (useYnRef.current) useYnRef.current.value = queryUseYn;
    }, 0);

    return () => clearTimeout(timer);
  }, [
    queryDefCode,
    queryOperCode,
    queryDefNm,
    queryDefType,
    querySeverity,
    queryUseYn,
  ]);

  // 불량 목록 조회
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
      window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
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

  useEffect(() => {
    loadDefects();
  }, [loadDefects]);

  const handleSearch = () => {
    const nextParams: Record<string, string> = {
      page: "0",
    };

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

    setEditingDefCode(null);
    setSearchParams(nextParams);
  };

  const handleReset = () => {
    [defCodeRef, operCodeRef, defNmRef, defTypeRef, severityRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    if (useYnRef.current) useYnRef.current.value = "";

    setEditingDefCode(null);
    setSearchParams({
      page: "0",
    });
  };

  const handlePageChange = (newPage: number) => {
    setEditingDefCode(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(
      queryString
        ? `/master/defects/create?${queryString}`
        : "/master/defects/create"
    );
  };

  // 인라인 편집 시작
  const handleStartEdit = (row: DefectResponse) => {
    editFormRef.current = {
      operCode: row.operCode ?? "",
      defNm: row.defNm ?? "",
      defType: row.defType ?? "",
      severity: row.severity ?? "",
    };
    setEditingDefCode(row.defCode);
  };

  // 인라인 편집 취소
  const handleCancelEdit = () => {
    setEditingDefCode(null);
    editFormRef.current = { operCode: "", defNm: "", defType: "", severity: "" };
  };

  // 인라인 수정 저장
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

      // 로컬 데이터 목록 즉시 갱신 (Optimistic Update)
      setDefects((prev) =>
        prev.map((item) =>
          item.defCode === defCode
            ? {
                ...item,
                operCode: updatePayload.operCode ?? item.operCode,
                defNm: updatePayload.defNm ?? item.defNm,
                defType: updatePayload.defType ?? item.defType,
                severity: updatePayload.severity ?? item.severity,
              }
            : item
        )
      );

      setEditingDefCode(null);
      await loadDefects();
    } catch (err) {
      console.error("수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 행 삭제
  const handleDeleteDefect = async (defCode: string) => {
    if (isDeletingDefCode) return;

    const confirmed = window.confirm(`[${defCode}] 불량 항목을 삭제(비활성화)하시겠습니까?`);
    if (!confirmed) return;

    setIsDeletingDefCode(defCode);
    try {
      const encodedDefCode = encodeURIComponent(defCode);
      await apiClient.delete(`/defects/${encodedDefCode}`);

      window.alert("불량 항목이 삭제(비활성화)되었습니다.");
      await loadDefects();
    } catch (error) {
      console.error("불량 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || "불량 삭제에 실패했습니다.");
    } finally {
      setIsDeletingDefCode(null);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<DefectResponse>[] = useMemo(
    () => [
      {
        accessorKey: "defCode",
        header: "불량코드",
      },
      {
        accessorKey: "operCode",
        header: "공정코드",
        cell: ({ row }) => {
          const isEditing = row.original.defCode === editingDefCode;
          if (isEditing) {
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
          const isEditing = row.original.defCode === editingDefCode;
          if (isEditing) {
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
          const isEditing = row.original.defCode === editingDefCode;
          if (isEditing) {
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
          const isEditing = row.original.defCode === editingDefCode;
          if (isEditing) {
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
        cell: ({ getValue }) => {
          const isUse = getValue<string>() === "Y";
          return <Badge tone={isUse ? "good" : "muted"}>{isUse ? "사용" : "미사용"}</Badge>;
        },
      },
      {
        accessorKey: "createdAt",
        header: "등록일자",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
      {
        id: "actions",
        header: "관리",
        meta: { width: "130px" },
        cell: ({ row }) => {
          const isEditing = row.original.defCode === editingDefCode;
          const isDeleting = isDeletingDefCode === row.original.defCode;
          const isUsed = row.original.useYn === "Y";

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
                disabled={editingDefCode !== null || isDeleting}
                onClick={() => handleStartEdit(row.original)}
              >
                수정
              </button>
              <button
                type="button"
                className="miniButton danger"
                disabled={editingDefCode !== null || isDeleting || !isUsed}
                onClick={() => handleDeleteDefect(row.original.defCode)}
              >
                {isDeleting ? "삭제 중" : "삭제"}
              </button>
            </div>
          );
        },
      },
    ],
    [editingDefCode, isUpdating, isDeletingDefCode]
  );

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="불량관리 목록" action="등록" onAction={handleCreate}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={defects}
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