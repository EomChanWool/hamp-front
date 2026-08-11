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
import { useTableSorting } from "@/hooks/useTableSorting";
import type {
  FactoryZoneResponse,
  ApiResponseFactoryZoneResponse,
  ApiResponsePageFactoryZoneResponse,
  FactoryZoneUpdateRequest,
} from "@/types/master/FactoryZone";
import Spinner from "@/components/common/Spinner";

interface FactoryZoneCreateRequest extends FactoryZoneUpdateRequest {
  facCode: string;
}

export function MasterFactoryZonePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [factoryZones, setFactoryZones] = useState<FactoryZoneResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 인라인 수정 상태 관리 (현재 수정 중인 공장코드)
  const [editingFacCode, setEditingFacCode] = useState<string | null>(null);

  // 인라인 등록 상태 관리 (true면 테이블 맨 위에 새 입력 행이 생성됨)
  const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);

  // 타이핑 시 리렌더링 방지를 위한 폼 상태 Ref (수정 및 등록 공용)
  const editFormRef = useRef<FactoryZoneUpdateRequest & { facCode?: string }>({
    facCode: "",
    facNm: "",
    location: "",
    note: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingFacCode, setIsDeletingFacCode] = useState<string | null>(null);

  // 커스텀 훅으로 정렬 상태 및 핸들러 연동
  const { sorting, sortParams, handleSortingChange } = useTableSorting();

  const currentPage = Number(searchParams.get("page") || "0");
  const queryFacCode = searchParams.get("facCode") || "";
  const queryFacNm = searchParams.get("facNm") || "";
  const queryLocation = searchParams.get("location") || "";
  const queryUseYn = searchParams.get("useYn") || "";

  const facCodeRef = useRef<HTMLInputElement>(null);
  const facNmRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const useYnRef = useRef<HTMLSelectElement>(null);

  const searchFields: SearchField[] = [
    { type: "input", label: "공장코드", ref: facCodeRef },
    { type: "input", label: "공장명", ref: facNmRef },
    { type: "input", label: "위치", ref: locationRef },
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
      if (facCodeRef.current) facCodeRef.current.value = queryFacCode;
      if (facNmRef.current) facNmRef.current.value = queryFacNm;
      if (locationRef.current) locationRef.current.value = queryLocation;
      if (useYnRef.current) useYnRef.current.value = queryUseYn;
    }, 0);

    return () => clearTimeout(timer);
  }, [
    queryFacCode,
    queryFacNm,
    queryLocation,
    queryUseYn,
  ]);

  // 공장 목록 조회 (GET /factory-zones)
  const loadFactoryZones = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page: currentPage,
        size: 10,
      };
      if (queryFacCode) params.facCode = queryFacCode;
      if (queryFacNm) params.facNm = queryFacNm;
      if (queryLocation) params.location = queryLocation;
      if (queryUseYn) params.useYn = queryUseYn;

      // 정렬 파라미터 반영
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
  }, [
    currentPage,
    queryFacCode,
    queryFacNm,
    queryLocation,
    queryUseYn,
    sortParams,
  ]);

  useEffect(() => {
    loadFactoryZones();
  }, [loadFactoryZones]);

  // 검색 핸들러
  const handleSearch = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");

    const facCode = facCodeRef.current?.value.trim();
    const facNm = facNmRef.current?.value.trim();
    const location = locationRef.current?.value.trim();
    const useYn = useYnRef.current?.value.trim();

    if (facCode) nextParams.set("facCode", facCode);
    else nextParams.delete("facCode");

    if (facNm) nextParams.set("facNm", facNm);
    else nextParams.delete("facNm");

    if (location) nextParams.set("location", location);
    else nextParams.delete("location");

    if (useYn) nextParams.set("useYn", useYn);
    else nextParams.delete("useYn");

    setEditingFacCode(null);
    setIsCreatingNewRow(false);
    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    [facCodeRef, facNmRef, locationRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    if (useYnRef.current) {
      useYnRef.current.value = "";
    }
    setEditingFacCode(null);
    setIsCreatingNewRow(false);
    setSearchParams({
      page: "0",
    });
  };

  const handlePageChange = (newPage: number) => {
    setEditingFacCode(null);
    setIsCreatingNewRow(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  // 인라인 등록 행 활성화
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

  // 인라인 신규 등록 API 저장 (POST /factory-zones)
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
      await loadFactoryZones();
    } catch (err) {
      console.error("등록 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || "등록에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 인라인 편집 시작
  const handleStartEdit = (row: FactoryZoneResponse) => {
    setIsCreatingNewRow(false);
    editFormRef.current = {
      facNm: row.facNm ?? "",
      location: row.location ?? "",
      note: row.note ?? "",
    };
    setEditingFacCode(row.facCode);
  };

  // 인라인 편집 취소
  const handleCancelEdit = () => {
    setEditingFacCode(null);
    editFormRef.current = { facNm: "", location: "", note: "" };
  };

  // 인라인 수정 저장 (PUT /factory-zones/{facCode})
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

      const successMessage = response.data?.message || "수정되었습니다.";
      window.alert(successMessage);

      setFactoryZones((prev) =>
        prev.map((item) =>
          item.facCode === facCode
            ? {
              ...item,
              facNm: updatePayload.facNm ?? item.facNm,
              location: updatePayload.location ?? item.location,
              note: updatePayload.note ?? item.note,
            }
            : item
        )
      );

      setEditingFacCode(null);
      await loadFactoryZones();
    } catch (err) {
      console.error("저장 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 공장 삭제(비활성화) 처리 (DELETE /factory-zones/{facCode})
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
      await loadFactoryZones();
    } catch (error) {
      console.error("공장 삭제 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || "공장 삭제에 실패했습니다.");
    } finally {
      setIsDeletingFacCode(null);
    }
  };

  // 테이블 컬럼 정의
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
              />
              <CusPagination
                page={currentPage}
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