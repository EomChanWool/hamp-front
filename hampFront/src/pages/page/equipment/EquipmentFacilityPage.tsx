import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import { useTableSorting } from "@/hooks/useTableSorting";
import Spinner from "@/components/common/Spinner";

import type {
  FacilityResponse,
  ApiResponsePageFacilityResponse,
  StatusType,
} from "@/types/equipment/Facility";
import { STATUS_TONE, STATUS_TYPE_LABEL } from "@/types/equipment/Facility";
import { Badge } from "@/components/common/Badge";
import type { ApiResponseListEquipmentOptionResponse, EquipmentOptionResponse } from "@/types/master/Equipment";
import type { ApiResponseListFactoryZoneOptionResponse, FactoryZoneOptionResponse } from "@/types/master/FactoryZone";

export function EquipmentFacilityPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [facilities, setFacilities] = useState<FacilityResponse[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOptionResponse[]>([]);
  const [factoryZoneOptions, setFactoryZoneOptions] = useState<FactoryZoneOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 새로고침 초기화가 끝난 뒤에 목록 조회를 시작하기 위한 상태
  const [isReady, setIsReady] = useState(false);

  // 커스텀 훅으로 정렬 상태 및 핸들러 연동
  const { sorting, sortParams, handleSortingChange } = useTableSorting();

  // 브라우저 새로고침(F5) 감지 및 처리
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("is_browser_reload", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const isReload = sessionStorage.getItem("is_browser_reload") === "true";

    if (isReload) {
      sessionStorage.removeItem("is_browser_reload");
      if (searchParams.toString()) {
        setSearchParams({}, { replace: true });
        return;
      }
    }
    setIsReady(true);
  }, []);

  // URL 쿼리스트링에서 상태 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryFcltNm = searchParams.get("fcltNm") || "";
  const queryEqCode = searchParams.get("eqCode") || "";
  const queryCurrentStatus = searchParams.get("currentStatus") || "";
  const queryFacCode = searchParams.get("facCode") || "";

  // 검색 필드 Refs 
  const fcltNmRef = useRef<HTMLInputElement>(null);
  const eqCodeRef = useRef<HTMLInputElement>(null);
  const currentStatusRef = useRef<HTMLSelectElement>(null);
  const facCodeRef = useRef<HTMLInputElement>(null);

  const fetchOptions = useCallback(async () => {
    try {
      const [eqRes, facRes] = await Promise.all([
        apiClient.get<ApiResponseListEquipmentOptionResponse>("/equipment/options"),
        apiClient.get<ApiResponseListFactoryZoneOptionResponse>("/factory-zones/options")
      ]);
      setEquipmentOptions(eqRes.data.data ?? []);
      setFactoryZoneOptions(facRes.data.data ?? []);
    } catch (error) {
      console.error("옵션 목록 조회 실패:", error);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const searchFields: SearchField[] = [
    { type: "input", label: "설비명", ref: fcltNmRef, name: "fcltNm" },
    {
      type: "select",
      label: "장비코드",
      ref: eqCodeRef as any,
      options: [
        { label: "전체", value: "" },
        ...equipmentOptions.map((opt) => ({
          label: `${opt.eqCode} (${opt.eqNm ?? '-'})`,
          value: opt.eqCode,
        })),
      ],
    },
    {
      type: "select",
      label: "공장코드",
      ref: facCodeRef as any,
      options: [
        { label: "전체", value: "" },
        ...factoryZoneOptions.map((opt) => ({
          label: `${opt.facCode} (${opt.facNm ?? '-'})`,
          value: opt.facCode,
        })),
      ],
    },
    {
      type: "select",
      label: "현재상태",
      ref: currentStatusRef as any,
      options: [
        { label: "전체", value: "" },
        { label: "정지", value: "0" },
        { label: "작동", value: "1" },
        { label: "고장", value: "2" },
      ],
    },
    { type: "input", label: "공장코드", ref: facCodeRef, name: "facCode" },
  ];

  // URL 쿼리스트링 값과 검색창 input 값 동기화
  useEffect(() => {
    if (fcltNmRef.current) fcltNmRef.current.value = queryFcltNm;
    if (eqCodeRef.current) eqCodeRef.current.value = queryEqCode;
    if (currentStatusRef.current) currentStatusRef.current.value = queryCurrentStatus;
    if (facCodeRef.current) facCodeRef.current.value = queryFacCode;
  }, [queryFcltNm, queryEqCode, queryCurrentStatus, queryFacCode]);

  // 설비 목록 조회 (GET /facilities)
  const loadFacilities = useCallback(async () => {
    if (!isReady) {
      return;
    }

    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page: currentPage,
        size: 10,
      };
      if (queryFcltNm) params.fcltNm = queryFcltNm;
      if (queryEqCode) params.eqCode = queryEqCode;
      if (queryCurrentStatus) params.currentStatus = Number(queryCurrentStatus);
      if (queryFacCode) params.facCode = queryFacCode;

      // 정렬 파라미터 반영 (Spring Pageable 형식)
      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await apiClient.get<ApiResponsePageFacilityResponse>("/facilities", {
        params,
      });

      const pageData = response.data.data;
      setFacilities(pageData?.content ?? []);
      setTotalElements(pageData?.totalElements ?? 0);
      setTotalPages(pageData?.totalPages ?? 0);
    } catch (error) {
      console.error("설비 목록 조회 실패:", error);
      window.alert("설비 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [
    isReady,
    currentPage,
    queryFcltNm,
    queryEqCode,
    queryCurrentStatus,
    queryFacCode,
    sortParams,
  ]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // 검색 핸들러
  const handleSearch = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");

    const fcltNm = fcltNmRef.current?.value.trim();
    const eqCode = eqCodeRef.current?.value.trim();
    const currentStatus = currentStatusRef.current?.value.trim();
    const facCode = facCodeRef.current?.value.trim();

    if (fcltNm) nextParams.set("fcltNm", fcltNm);
    else nextParams.delete("fcltNm");

    if (eqCode) nextParams.set("eqCode", eqCode);
    else nextParams.delete("eqCode");

    if (currentStatus) nextParams.set("currentStatus", currentStatus);
    else nextParams.delete("currentStatus");

    if (facCode) nextParams.set("facCode", facCode);
    else nextParams.delete("facCode");

    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    [fcltNmRef, eqCodeRef, currentStatusRef, facCodeRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    setSearchParams({ page: "0" }, { replace: true });
  };

  // 페이지네이션 핸들러
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  // 등록 페이지로 이동 (검색 상태 유지)
  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(
      queryString
        ? `/equipment/facility/create?${queryString}`
        : "/equipment/facility/create"
    );
  };

  // 상세 페이지로 이동 (검색 상태 유지)
  const handleOpenDetail = (fcltCode: string) => {
    const queryString = searchParams.toString();
    navigate(
      queryString
        ? `/equipment/facility/${encodeURIComponent(fcltCode)}?${queryString}`
        : `/equipment/facility/${encodeURIComponent(fcltCode)}`
    );
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<FacilityResponse>[] = useMemo(
    () => [
      { accessorKey: "fcltCode", header: "설비코드" },
      {
        accessorKey: "fcltNm",
        header: "설비명",
        cell: ({ getValue }) => getValue<string>() || "-",
      },
      { accessorKey: "eqNm", header: "설비종류" },
      { accessorKey: "facNm", header: "설비위치" },
      {
        accessorKey: "currentStatus",
        header: "현재상태",
        cell: ({ getValue }) => {
          const value = getValue() as StatusType;
          return (
            <Badge tone={STATUS_TONE[value]}>
              {STATUS_TYPE_LABEL[value]}
            </Badge>
          );
        },
      },
      {
        accessorKey: "useYn",
        header: "사용여부",
        cell: ({ getValue }) => (
          <Badge
            tone={
              getValue<boolean>()
                ? "good"
                : "muted"
            }
          >
            {getValue<boolean>()
              ? "사용"
              : "미사용"}
          </Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "등록일자",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
    ],
    [searchParams]
  );

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="설비관리 목록" action="등록" onAction={handleCreate}>
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={facilities}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                onRowClick={(row) => handleOpenDetail(row.fcltCode)}
                noDataMessage="조회된 데이터가 없습니다."
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