import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type {
  FactoryZoneResponse,
  ApiResponseFactoryZoneResponse,
  ApiResponsePageFactoryZoneResponse,
  FactoryZoneUpdateRequest,
  FactoryZoneOptionResponse,
  ApiResponseListFactoryZoneOptionResponse,
} from "@/types/master/FactoryZone";
import Spinner from "@/components/common/Spinner";

interface FactoryZoneCreateRequest extends FactoryZoneUpdateRequest {
  facCode: string;
}

export function MasterFactoryZonePage() {
  const [factoryZones, setFactoryZones] = useState<FactoryZoneResponse[]>([]);
  const [factoryZonesOptions, setFactoryZonesOptions] = useState<FactoryZoneOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 데이터 재조회를 위한 트리거 키
  const [refreshKey, setRefreshKey] = useState(0);

  // 페이지 및 검색 조건을 React State로 관리
  const [page, setPage] = useState(0);
  const [searchFilters, setSearchFilters] = useState({
    facCode: "",
    facNm: "",
    location: "",
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
    setEditingFacCode(null);
    setIsCreatingNewRow(false);
  };

  // 인라인 수정 상태 관리
  const [editingFacCode, setEditingFacCode] = useState<string | null>(null);

  // 인라인 등록 상태 관리
  const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);

  // 타이핑 시 리렌더링 방지 폼 Ref
  const editFormRef = useRef<FactoryZoneUpdateRequest & { facCode?: string }>({
    facCode: "",
    facNm: "",
    location: "",
    note: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingFacCode, setIsDeletingFacCode] = useState<string | null>(null);

  // 검색 필드 Refs
  const facCodeRef = useRef<HTMLInputElement>(null);
  const facNmRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const useYnRef = useRef<HTMLSelectElement>(null);

   // 부서 옵션 API 호출
  const loadFactoryZoneOptions = useCallback(async () => {
    try {
      const response = await apiClient.get<ApiResponseListFactoryZoneOptionResponse>(
        "/factory-zones/options"
      );
      setFactoryZonesOptions(response.data.data ?? []);
    } catch (error) {
      console.error("공장 옵션 목록 조회 실패:", error);
    }
  }, []);

  useEffect(() => {
    loadFactoryZoneOptions();
  }, [loadFactoryZoneOptions]);

  // 검색 필드 정의
  const searchFields: SearchField[] = [
     {
      type: "select",
      label: "공장코드",
      ref: facCodeRef as any,
      options: [
        { label: "전체", value: "" },
        ...factoryZonesOptions.map((opt) => ({
          label: `${opt.facCode} (${opt.facNm ?? '-'})`,
          value: opt.facCode,
        })),
      ],
    },
    { type: "input", label: "공장명", ref: facNmRef, name: "facNm" },
    { type: "input", label: "위치", ref: locationRef, name: "location" },
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

  // 공장 목록 조회
  const loadFactoryZones = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        size: 10,
      };
      if (searchFilters.facCode) params.facCode = searchFilters.facCode;
      if (searchFilters.facNm) params.facNm = searchFilters.facNm;
      if (searchFilters.location) params.location = searchFilters.location;
      if (searchFilters.useYn) params.useYn = searchFilters.useYn;

      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await apiClient.get<ApiResponsePageFactoryZoneResponse>("/factory-zones", {
        params,
      });

      const pageData = response.data.data;
      setFactoryZones(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("공장 목록 조회 실패:", error);
      window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [page, searchFilters, sortParams, refreshKey]);

  useEffect(() => {
    loadFactoryZones();
  }, [loadFactoryZones]);

  const handleSearch = () => {
    setPage(0);
    setSearchFilters({
      facCode: facCodeRef.current?.value.trim() || "",
      facNm: facNmRef.current?.value.trim() || "",
      location: locationRef.current?.value.trim() || "",
      useYn: useYnRef.current?.value.trim() || "",
    });
    setEditingFacCode(null);
    setIsCreatingNewRow(false);
  };

  const handleReset = () => {
    if (facCodeRef.current) facCodeRef.current.value = "";
    if (facNmRef.current) facNmRef.current.value = "";
    if (locationRef.current) locationRef.current.value = "";
    if (useYnRef.current) useYnRef.current.value = "";

    setPage(0);
    setSearchFilters({
      facCode: "",
      facNm: "",
      location: "",
      useYn: "",
    });
    setSorting([]);
    setEditingFacCode(null);
    setIsCreatingNewRow(false);
  };

  const handlePageChange = (newPage: number) => {
    setEditingFacCode(null);
    setIsCreatingNewRow(false);
    setPage(newPage);
  };

  const handleStartCreate = () => {
    if (isCreatingNewRow) return;
    setEditingFacCode(null);
    editFormRef.current = {
      facCode: "",
      facNm: "",
      location: "",
      note: "",
    };
    setIsCreatingNewRow(true);
  };

  const handleCancelCreate = () => {
    setIsCreatingNewRow(false);
  };

  // 인라인 신규 등록 API 저장
  const handleSaveCreate = async () => {
    if (isUpdating) return;

    const newFacCode = editFormRef.current.facCode?.trim();
    if (!newFacCode) {
      window.alert("공장코드를 입력해주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const payload: FactoryZoneCreateRequest = {
        facCode: newFacCode,
        facNm: editFormRef.current.facNm?.trim() || null,
        location: editFormRef.current.location?.trim() || null,
        note: editFormRef.current.note?.trim() || null,
      };

      const response = await apiClient.post<ApiResponseFactoryZoneResponse>("/factory-zones", payload);

      window.alert(response.data?.message || "등록되었습니다.");
      setIsCreatingNewRow(false);

      if (facCodeRef.current) facCodeRef.current.value = "";
      if (facNmRef.current) facNmRef.current.value = "";
      if (locationRef.current) locationRef.current.value = "";
      if (useYnRef.current) useYnRef.current.value = "";

      setPage(0);
      setSearchFilters({
        facCode: "",
        facNm: "",
        location: "",
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

  const handleStartEdit = (row: FactoryZoneResponse) => {
    setIsCreatingNewRow(false);
    editFormRef.current = {
      facNm: row.facNm ?? "",
      location: row.location ?? "",
      note: row.note ?? "",
    };
    setEditingFacCode(row.facCode);
  };

  const handleCancelEdit = () => {
    setEditingFacCode(null);
    editFormRef.current = { facNm: "", location: "", note: "" };
  };

  // 인라인 수정 저장
  const handleSaveEdit = async (facCode: string) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: FactoryZoneUpdateRequest = {
        facNm: editFormRef.current.facNm?.trim() ? editFormRef.current.facNm.trim() : null,
        location: editFormRef.current.location?.trim() ? editFormRef.current.location.trim() : null,
        note: editFormRef.current.note?.trim() ? editFormRef.current.note.trim() : null,
      };

      const encodedFacCode = encodeURIComponent(facCode);
      const response = await apiClient.put<ApiResponseFactoryZoneResponse>(
        `/factory-zones/${encodedFacCode}`,
        updatePayload
      );

      window.alert(response.data?.message || "수정되었습니다.");
      setEditingFacCode(null);
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
  const handleDeleteFactoryZone = async (row: FactoryZoneResponse) => {
    if (isDeletingFacCode || row.useYn !== "Y") return;

    const confirmed = window.confirm(
      `[${row.facCode}] ${row.facNm || ""} 공장을 삭제(비활성화)하시겠습니까?`
    );
    if (!confirmed) return;

    setIsDeletingFacCode(row.facCode);
    try {
      const encodedFacCode = encodeURIComponent(row.facCode);
      await apiClient.delete(`/factory-zones/${encodedFacCode}`);

      window.alert("공장이 삭제(비활성화)되었습니다.");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("공장 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || "공장 삭제에 실패했습니다.");
    } finally {
      setIsDeletingFacCode(null);
    }
  };

  const columns: ColumnDef<FactoryZoneResponse>[] = useMemo(
    () => [
      {
        accessorKey: "facCode",
        header: "공장코드",
        cell: ({ row }) => {
          if (row.original.facCode === "__NEW_ROW__") {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.facCode ?? ""}
                onChange={(e) => {
                  editFormRef.current.facCode = e.target.value;
                }}
                placeholder="공장코드 입력"
                autoFocus
              />
            );
          }
          return row.original.facCode;
        },
      },
      {
        accessorKey: "facNm",
        header: "공장명",
        cell: ({ row }) => {
          const isNewRow = row.original.facCode === "__NEW_ROW__";
          const isEditing = row.original.facCode === editingFacCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.facNm ?? ""}
                onChange={(e) => {
                  editFormRef.current.facNm = e.target.value;
                }}
                placeholder="공장명 입력"
              />
            );
          }
          return row.original.facNm || "-";
        },
      },
      {
        accessorKey: "location",
        header: "위치",
        cell: ({ row }) => {
          const isNewRow = row.original.facCode === "__NEW_ROW__";
          const isEditing = row.original.facCode === editingFacCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.location ?? ""}
                onChange={(e) => {
                  editFormRef.current.location = e.target.value;
                }}
                placeholder="위치 입력"
              />
            );
          }
          return row.original.location || "-";
        },
      },
      {
        accessorKey: "useYn",
        header: "사용여부",
        cell: ({ row, getValue }) => {
          if (row.original.facCode === "__NEW_ROW__") {
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
        accessorKey: "note",
        header: "비고",
        cell: ({ row }) => {
          const isNewRow = row.original.facCode === "__NEW_ROW__";
          const isEditing = row.original.facCode === editingFacCode;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                defaultValue={editFormRef.current.note ?? ""}
                onChange={(e) => {
                  editFormRef.current.note = e.target.value;
                }}
                placeholder="비고 입력"
              />
            );
          }
          return row.original.note || "-";
        },
      },
      {
        accessorKey: "createdAt",
        header: "등록일자",
        cell: ({ row, getValue }) => {
          if (row.original.facCode === "__NEW_ROW__") return "-";
          return formatDateTime(getValue<string>());
        },
      },
      {
        id: "actions",
        header: "관리",
        meta: { width: "130px" },
        cell: ({ row }) => {
          const isNewRow = row.original.facCode === "__NEW_ROW__";
          const isEditing = row.original.facCode === editingFacCode;
          const isDeleting = isDeletingFacCode === row.original.facCode;
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
                  onClick={() => handleSaveEdit(row.original.facCode)}
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
                disabled={editingFacCode !== null || isCreatingNewRow || isDeleting}
                onClick={() => handleStartEdit(row.original)}
              >
                수정
              </button>
              <button
                type="button"
                className="miniButton danger"
                disabled={editingFacCode !== null || isCreatingNewRow || isDeleting || !isUsed}
                onClick={() => handleDeleteFactoryZone(row.original)}
              >
                {isDeleting ? "삭제 중" : "삭제"}
              </button>
            </div>
          );
        },
      },
    ],
    [editingFacCode, isCreatingNewRow, isUpdating, isDeletingFacCode]
  );

  const displayFactoryZones = useMemo(() => {
    if (isCreatingNewRow) {
      const dummyNewRow: FactoryZoneResponse = {
        facCode: "__NEW_ROW__",
        facNm: "",
        location: "",
        note: "",
        useYn: "Y",
        createdAt: "",
        updatedAt: "",
      };
      return [dummyNewRow, ...factoryZones];
    }
    return factoryZones;
  }, [isCreatingNewRow, factoryZones]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="공장관리 목록" action="등록" onAction={handleStartCreate}>
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={displayFactoryZones}
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