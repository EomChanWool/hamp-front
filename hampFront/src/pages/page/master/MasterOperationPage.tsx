import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
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

interface OperationCreateRequest extends OperationUpdateRequest {
  operCode: string;
}

export function MasterOperationPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [operations, setOperations] = useState<OperationResponse[]>([]);
  const [operationOptions, setOperationOptions] = useState<OperationOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 인라인 수정 상태 관리 (현재 수정 중인 공정코드)
  const [editingOperCode, setEditingOperCode] = useState<string | null>(null);

  // 인라인 등록 상태 관리 (true면 테이블 맨 위에 새 입력 행이 생성됨)
  const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);

  // 타이핑 시 리렌더링 방지를 위한 폼 상태 Ref (수정 및 등록 공용)
  const editFormRef = useRef<OperationUpdateRequest & { operCode?: string }>({
    operCode: "",
    depCode: "",
    operNm: "",
    stdTime: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingOperCode, setIsDeletingOperCode] = useState<string | null>(null);

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

  // 검색 필드 DOM 값과 URL 쿼리 파라미터 동기화 (타이밍 이슈 방지 setTimeout 적용)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (operCodeRef.current) operCodeRef.current.value = queryOperCode;
      if (depCodeRef.current) depCodeRef.current.value = queryDepCode;
      if (operNmRef.current) operNmRef.current.value = queryOperNm;
      if (useYnRef.current) useYnRef.current.value = queryUseYn;
      if (stdTimeRef.current) stdTimeRef.current.value = queryStdTime;
    }, 0);

    return () => clearTimeout(timer);
  }, [
    queryOperCode,
    queryDepCode,
    queryOperNm,
    queryUseYn,
    queryStdTime,
    operationOptions,
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

  // 공정 목록 조회
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

    setEditingOperCode(null);
    setIsCreatingNewRow(false);
    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    [depCodeRef, operNmRef, stdTimeRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    if (operCodeRef.current) operCodeRef.current.value = "";
    if (useYnRef.current) useYnRef.current.value = "";

    setEditingOperCode(null);
    setIsCreatingNewRow(false);
    setSearchParams({
      page: "0",
    });
  };

  const handlePageChange = (newPage: number) => {
    setEditingOperCode(null);
    setIsCreatingNewRow(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  // 인라인 등록 행 활성화
  const handleStartCreate = () => {
    if (isCreatingNewRow) return;
    setEditingOperCode(null);
    editFormRef.current = {
      operCode: "",
      depCode: "",
      operNm: "",
      stdTime: "",
    };
    setIsCreatingNewRow(true);
  };

  const handleCancelCreate = () => {
    setIsCreatingNewRow(false);
  };

  // 인라인 신규 등록 API 저장 (POST /operations)
  const handleSaveCreate = async () => {
    if (isUpdating) return;

    const newOperCode = editFormRef.current.operCode?.trim();
    if (!newOperCode) {
      window.alert("공정코드를 입력해주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const payload: OperationCreateRequest = {
        operCode: newOperCode,
        depCode: editFormRef.current.depCode?.trim() || null,
        operNm: editFormRef.current.operNm?.trim() || null,
        stdTime: editFormRef.current.stdTime?.toString().trim() || null,
      };

      const response = await apiClient.post<ApiResponseOperationResponse>("/operations", payload);

      window.alert(response.data?.message || "등록되었습니다.");
      setIsCreatingNewRow(false);
      await loadOperations();
      await fetchOperationOptions();
    } catch (err) {
      console.error("등록 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || "등록에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 인라인 편집 시작
  const handleStartEdit = (row: OperationResponse) => {
    setIsCreatingNewRow(false);
    editFormRef.current = {
      depCode: row.depCode ?? "",
      operNm: row.operNm ?? "",
      stdTime: row.stdTime?.toString() ?? "",
    };
    setEditingOperCode(row.operCode);
  };

  // 인라인 편집 취소
  const handleCancelEdit = () => {
    setEditingOperCode(null);
    editFormRef.current = { depCode: "", operNm: "", stdTime: "" };
  };

  // 인라인 수정 저장
  const handleSaveEdit = async (operCode: string) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: OperationUpdateRequest = {
        depCode: editFormRef.current.depCode?.trim() ? editFormRef.current.depCode.trim() : null,
        operNm: editFormRef.current.operNm?.trim() ? editFormRef.current.operNm.trim() : null,
        stdTime: editFormRef.current.stdTime?.toString().trim() ? editFormRef.current.stdTime.toString().trim() : null,
      };

      const encodedOperCode = encodeURIComponent(operCode);
      const response = await apiClient.put<ApiResponseOperationResponse>(
        `/operations/${encodedOperCode}`,
        updatePayload
      );

      window.alert(response.data?.message || "수정되었습니다.");

      // 로컬 데이터 목록 즉시 갱신 (Optimistic Update)
      setOperations((prev) =>
        prev.map((item) =>
          item.operCode === operCode
            ? {
                ...item,
                depCode: updatePayload.depCode ?? item.depCode,
                operNm: updatePayload.operNm ?? item.operNm,
                stdTime: updatePayload.stdTime ?? item.stdTime,
              }
            : item
        )
      );

      setEditingOperCode(null);
      await loadOperations();
      await fetchOperationOptions();
    } catch (err) {
      console.error("수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 공정 삭제(비활성화) 처리
  const handleDeleteOperation = async (row: OperationResponse) => {
    if (isDeletingOperCode || row.useYn !== "Y") return;

    const confirmed = window.confirm(`[${row.operCode}] ${row.operNm || ""} 공정을 삭제(비활성화)하시겠습니까?`);
    if (!confirmed) return;

    setIsDeletingOperCode(row.operCode);
    try {
      const encodedOperCode = encodeURIComponent(row.operCode);
      await apiClient.delete(`/operations/${encodedOperCode}`);

      window.alert("공정이 삭제(비활성화)되었습니다.");
      await loadOperations();
      await fetchOperationOptions();
    } catch (error) {
      console.error("공정 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || "공정 삭제에 실패했습니다.");
    } finally {
      setIsDeletingOperCode(null);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<OperationResponse>[] = useMemo(
    () => [
      {
        accessorKey: "operCode",
        header: "공정코드",
        cell: ({ row }) => {
          if (row.original.operCode === "__NEW_ROW__") {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.operCode ?? ""}
                onChange={(e) => {
                  editFormRef.current.operCode = e.target.value;
                }}
                placeholder="공정코드 입력"
                autoFocus
              />
            );
          }
          return row.original.operCode;
        },
      },
      {
        accessorKey: "depCode",
        header: "부서코드",
        cell: ({ row }) => {
          const isNewRow = row.original.operCode === "__NEW_ROW__";
          const isEditing = row.original.operCode === editingOperCode;
          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.depCode ?? ""}
                onChange={(e) => {
                  editFormRef.current.depCode = e.target.value;
                }}
                placeholder="부서코드 입력"
              />
            );
          }
          return row.original.depCode || "-";
        },
      },
      {
        accessorKey: "operNm",
        header: "공정명",
        cell: ({ row }) => {
          const isNewRow = row.original.operCode === "__NEW_ROW__";
          const isEditing = row.original.operCode === editingOperCode;
          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.operNm ?? ""}
                onChange={(e) => {
                  editFormRef.current.operNm = e.target.value;
                }}
                placeholder="공정명 입력"
              />
            );
          }
          return row.original.operNm || "-";
        },
      },
      {
        accessorKey: "stdTime",
        header: "표준시간",
        cell: ({ row }) => {
          const isNewRow = row.original.operCode === "__NEW_ROW__";
          const isEditing = row.original.operCode === editingOperCode;
          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                type="text"
                defaultValue={editFormRef.current.stdTime?.toString() ?? ""}
                onChange={(e) => {
                  editFormRef.current.stdTime = e.target.value;
                }}
                placeholder="표준시간 입력"
              />
            );
          }
          return row.original.stdTime || "-";
        },
      },
      {
        accessorKey: "useYn",
        header: "사용여부",
        cell: ({ row, getValue }) => {
          if (row.original.operCode === "__NEW_ROW__") {
            return <Badge tone="good">사용</Badge>;
          }
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
        header: "등록일자",
        cell: ({ row, getValue }) => {
          if (row.original.operCode === "__NEW_ROW__") return "-";
          return formatDateTime(getValue<string>());
        },
      },
      {
        id: "actions",
        header: "관리",
        meta: { width: "130px" },
        cell: ({ row }) => {
          const isNewRow = row.original.operCode === "__NEW_ROW__";
          const isEditing = row.original.operCode === editingOperCode;
          const isDeleting = isDeletingOperCode === row.original.operCode;
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
                  onClick={() => handleSaveEdit(row.original.operCode)}
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
                disabled={editingOperCode !== null || isCreatingNewRow || isDeleting}
                onClick={() => handleStartEdit(row.original)}
              >
                수정
              </button>
              <button
                type="button"
                className="miniButton danger"
                disabled={editingOperCode !== null || isCreatingNewRow || isDeleting || !isUsed}
                onClick={() => handleDeleteOperation(row.original)}
              >
                {isDeleting ? "삭제 중" : "삭제"}
              </button>
            </div>
          );
        },
      },
    ],
    [editingOperCode, isCreatingNewRow, isUpdating, isDeletingOperCode]
  );

  const displayOperations = useMemo(() => {
    if (isCreatingNewRow) {
      const dummyNewRow: OperationResponse = {
        operCode: "__NEW_ROW__",
        depCode: "",
        operNm: "",
        stdTime: "",
        useYn: "Y",
        createdAt: "",
        updatedAt: "",
      };
      return [dummyNewRow, ...operations];
    }
    return operations;
  }, [isCreatingNewRow, operations]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="공정 관리 목록" action="등록" onAction={handleStartCreate}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={displayOperations}
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