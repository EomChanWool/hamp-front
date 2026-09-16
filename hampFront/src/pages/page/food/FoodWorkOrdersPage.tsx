import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import {
  SearchBand,
  type SearchField,
} from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { useTableSorting } from "@/hooks/useTableSorting";
import Spinner from "@/components/common/Spinner";
import { Badge } from "@components/common/Badge";

import { KpiGrid, type KpiItem } from "@/components/kpi/KpiGrid";
import type { StatusTone } from "@/types";
import { WorkOrderApi, type WorkOrderResponse } from "@/api/WorkOrder"; 

export function FoodWorkOrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [workOrders, setWorkOrders] = useState<WorkOrderResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 새로고침 초기화가 끝난 뒤에 목록 조회를 시작하기 위한 상태
  const [isReady, setIsReady] = useState(false);

  // KPI 통계 상태값
  const [kpiStats, setKpiStats] = useState({
    total: 0,
    wait: 0,
    progress: 0,
    done: 0,
    delay: 0,
  });

  const {
    sorting,
    sortParams,
    handleSortingChange,
  } = useTableSorting();

  // [정확한 새로고침 감지]
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("is_browser_reload", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // 진입 시 실제 브라우저 새로고침 여부 확인 후 검색 조건 초기화
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

  useEffect(() => {
    const isReload = sessionStorage.getItem("is_browser_reload") === "true";
    if (!isReload && !isReady) {
      setIsReady(true);
    }
  }, [searchParams, isReady]);

  // URL에서 현재 검색조건 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryWorkId = searchParams.get("workId") || "";
  const queryStatus = searchParams.get("status") || "";
  const queryManagerId = searchParams.get("managerId") || "";
  const queryWorkDateFrom = searchParams.get("workDateFrom") || "";
  const queryWorkDateTo = searchParams.get("workDateTo") || "";

  // 검색 input / select refs
  const workIdRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const managerIdRef = useRef<HTMLInputElement>(null);
  const workDateFromRef = useRef<HTMLInputElement>(null);
  const workDateToRef = useRef<HTMLInputElement>(null);

  // 검색 필드 정의
  const searchFields: SearchField[] = [
    {
      type: "date",
      label: "작업일자",
      startRef: workDateFromRef,
      endRef: workDateToRef,
    },
    {
      type: "input",
      label: "작업지시ID",
      ref: workIdRef,
      name: "workId",
    },
    {
      type: "select",
      label: "상태",
      ref: statusRef,
      options: [
        { label: "전체", value: "" },
        { label: "대기", value: "WAIT" },
        { label: "진행중", value: "PROGRESS" },
        { label: "완료", value: "DONE" },
        { label: "지연", value: "DELAY" },
      ],
    },
    {
      type: "input",
      label: "담당자ID",
      ref: managerIdRef,
      name: "managerId",
    },
  ];

  // URL → SearchBand input / select 동기화
  useEffect(() => {
    if (workIdRef.current) workIdRef.current.value = queryWorkId;
    if (statusRef.current) statusRef.current.value = queryStatus;
    if (managerIdRef.current) managerIdRef.current.value = queryManagerId;
    if (workDateFromRef.current) workDateFromRef.current.value = queryWorkDateFrom;
    if (workDateToRef.current) workDateToRef.current.value = queryWorkDateTo;
  }, [
    queryWorkId,
    queryStatus,
    queryManagerId,
    queryWorkDateFrom,
    queryWorkDateTo,
  ]);

  // 작업지시 목록 및 KPI Summary 조회
  const loadWorkOrders = useCallback(async () => {
    if (!isReady) {
      return;
    }

    setIsLoading(true);

    try {
      const commonParams: Record<string, any> = {};
      if (queryWorkId) commonParams.workId = queryWorkId;
      if (queryManagerId) commonParams.managerId = queryManagerId;
      if (queryWorkDateFrom) commonParams.workDateFrom = queryWorkDateFrom;
      if (queryWorkDateTo) commonParams.workDateTo = queryWorkDateTo;

      // 1. 목록 조회 파라미터 (status 및 페이징, 정렬 포함)
      const listParams: Record<string, any> = {
        ...commonParams,
        page: currentPage,
        size: 10,
      };
      if (queryStatus) listParams.status = queryStatus;
      if (sortParams.length > 0) {
        listParams.sort = sortParams;
      }

      // 2. Summary API 호출 (status 필터는 제외하여 전체 상태 집계 유지)
      const [listResponse, summaryResponse] = await Promise.all([
        WorkOrderApi.getList(listParams),
        WorkOrderApi.getSummary ? WorkOrderApi.getSummary(commonParams) : Promise.resolve(null),
      ]);

      const pageData = listResponse.data;
      setWorkOrders(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);

      // Summary 데이터 반영
      if (summaryResponse && summaryResponse.data) {
        const { total, byStatus } = summaryResponse.data;
        
        let wait = 0;
        let progress = 0;
        let done = 0;
        let delay = 0;

        if (Array.isArray(byStatus)) {
          byStatus.forEach((item: { status: string; count: number }) => {
            const s = item.status?.trim();
            if (s === "WAIT" || s === "대기") wait = item.count;
            else if (s === "PROGRESS" || s === "진행중") progress = item.count;
            else if (s === "DONE" || s === "완료") done = item.count;
            else if (s === "DELAY" || s === "지연") delay = item.count;
          });
        }

        setKpiStats({
          total: total ?? 0,
          wait,
          progress,
          done,
          delay,
        });
      }

    } catch (error) {
      console.error("작업지시 목록 및 요약 조회 실패:", error);
      window.alert("작업지시 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [
    isReady,
    currentPage,
    queryWorkId,
    queryStatus,
    queryManagerId,
    queryWorkDateFrom,
    queryWorkDateTo,
    sortParams,
  ]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  // 검색 실행
  const handleSearch = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");

    const workId = workIdRef.current?.value.trim() || "";
    const status = statusRef.current?.value.trim() || "";
    const managerId = managerIdRef.current?.value.trim() || "";
    const workDateFrom = workDateFromRef.current?.value.trim() || "";
    const workDateTo = workDateToRef.current?.value.trim() || "";

    if (workId) nextParams.set("workId", workId);
    else nextParams.delete("workId");

    if (status) nextParams.set("status", status);
    else nextParams.delete("status");

    if (managerId) nextParams.set("managerId", managerId);
    else nextParams.delete("managerId");

    if (workDateFrom) nextParams.set("workDateFrom", workDateFrom);
    else nextParams.delete("workDateFrom");

    if (workDateTo) nextParams.set("workDateTo", workDateTo);
    else nextParams.delete("workDateTo");

    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    if (workIdRef.current) workIdRef.current.value = "";
    if (statusRef.current) statusRef.current.value = "";
    if (managerIdRef.current) managerIdRef.current.value = "";
    if (workDateFromRef.current) workDateFromRef.current.value = "";
    if (workDateToRef.current) workDateToRef.current.value = "";

    setSearchParams({ page: "0" }, { replace: true });
  };

  // 페이지 이동
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  // 상세 페이지 이동
  const handleRowClick = (workId: string) => {
    const queryString = searchParams.toString();
    navigate(
      `/food/work-order/${encodeURIComponent(workId)}${
        queryString ? `?${queryString}` : ""
      }`
    );
  };

  // 공통 KpiGrid에 전달할 kpis 데이터 구성
  const kpis: KpiItem[] = useMemo(
    () => [
      {
        label: "전체 작업지시",
        value: (
          <div style={{ display: 'inline-flex', alignItems: 'baseline' }}>
            {kpiStats.total}
            <span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px' }}>건</span>
          </div>
        ),
        tone: "neutral" as StatusTone,
      },
      {
        label: "대기",
        value: (
          <div style={{ display: 'inline-flex', alignItems: 'baseline' }}>
            {kpiStats.wait}
            <span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px' }}>건</span>
          </div>
        ),
        tone: "muted" as StatusTone,
      },
      {
        label: "진행중",
        value: (
          <div style={{ display: 'inline-flex', alignItems: 'baseline' }}>
            {kpiStats.progress}
            <span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px' }}>건</span>
          </div>
        ),
        tone: "info" as StatusTone,
      },
      {
        label: "완료",
        value: (
          <div style={{ display: 'inline-flex', alignItems: 'baseline' }}>
            {kpiStats.done}
            <span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px' }}>건</span>
          </div>
        ),
        tone: "good" as StatusTone,
      },
      {
        label: "지연",
        value: (
          <div style={{ display: 'inline-flex', alignItems: 'baseline' }}>
            {kpiStats.delay}
            <span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px' }}>건</span>
          </div>
        ),
        tone: "danger" as StatusTone,
      },
    ],
    [kpiStats]
  );

  // 테이블 컬럼 정의
  const columns: ColumnDef<WorkOrderResponse>[] = useMemo(
    () => [
      {
        accessorKey: "workId",
        header: "작업지시코드",
        cell: ({ getValue }) => <span style={{ fontWeight: 700 }}>{getValue<string>() || "-"}</span>,
      },
      {
        accessorKey: "workDate",
        header: "작업일자",
        cell: ({ getValue }) => getValue<string>() || "-",
      },
      {
        accessorKey: "status",
        header: "상태",
        cell: ({ getValue }) => {
          const value = getValue<string>();
          const tone = 
            value === 'DONE' || value === '완료' ? 'good' : 
            value === 'PROGRESS' || value === '진행중' ? 'info' : 
            value === 'DELAY' || value === '지연' ? 'danger' : 'muted';
          return <Badge tone={tone}>{value || "-"}</Badge>;
        },
      },
      {
        accessorKey: "managerNm",
        header: "담당자",
        cell: ({ row }) => {
          const managerNm = row.original.managerNm;
          const managerId = row.original.managerId;
          return managerNm ? `${managerNm} (${managerId})` : managerId || "-";
        },
      },
      {
        accessorKey: "orderCodes",
        header: "연결 수주",
        cell: ({ getValue }) => {
          const codes = getValue<string[]>();
          return codes && codes.length > 0 ? codes.join(", ") : "-";
        },
      },
      {
        accessorKey: "itemNms",
        header: "대상 품목",
        cell: ({ getValue }) => {
          const items = getValue<string[]>();
          return items && items.length > 0 ? items.join(", ") : "-";
        },
      },
      {
        accessorKey: "totalInstructQty",
        header: "지시수량 합계",
        cell: ({ getValue }) => {
          const qty = getValue<number>();
          return qty !== undefined && qty !== null ? qty.toLocaleString() : "0";
        },
      },
    ],
    []
  );

  return (
    <section className="screenStack">
      <div style={{ marginBottom: '16px' }}>
        <KpiGrid kpis={kpis} />
      </div>

      <SearchBand
        fields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <Panel
        title="식품 작업지시관리 목록"
        action="등록"
        onAction={() => {
          const queryString = searchParams.toString();
          navigate(
            `/food/work-order/create${
              queryString ? `?${queryString}` : ""
            }`
          );
        }}
      >
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={workOrders}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                onRowClick={(row) => handleRowClick(row.workId)}
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