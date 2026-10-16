import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { useTableSorting } from "@/hooks/useTableSorting";
import Spinner from "@/components/common/Spinner";
import { Badge } from "@components/common/Badge";
import {
  ShipmentOrderApi,
  type ShipmentOrderListResponse,
} from "@/api/ShipmentOrder";
import "@/pages/page/food/Food.css";

/**
 * 출고지시서 상태 정의
 * ※ 백엔드 상태 코드가 다르면 이 배열만 수정하면 검색 select / 뱃지 라벨이 함께 바뀝니다.
 */
const STATUS_OPTIONS = [
  { label: "대기", value: "WAIT", tone: "muted" },
  { label: "진행중", value: "PROGRESS", tone: "info" },
  { label: "완료", value: "DONE", tone: "good" },
  { label: "지연", value: "DELAY", tone: "danger" },
] as const;

/** 상태 코드 → { 라벨, 뱃지 톤 } 변환 (한글 값이 내려와도 대응) */
const getStatusMeta = (status?: string) => {
  const s = status?.trim();
  const found = STATUS_OPTIONS.find((o) => o.value === s || o.label === s);
  return found ?? { label: s || "-", value: s ?? "", tone: "muted" as const };
};

export function SeedOutboundManagePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ------------------------------------------
  // 목록 상태
  // ------------------------------------------
  const [shipments, setShipments] = useState<ShipmentOrderListResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 새로고침 초기화가 끝난 뒤에 목록 조회를 시작하기 위한 상태
  const [isReady, setIsReady] = useState(false);

  // 테이블 정렬 (공통 훅)
  const { sorting, sortParams, handleSortingChange } = useTableSorting();

  // ------------------------------------------
  // 브라우저 새로고침 감지 → 검색조건 초기화
  // (FoodWorkOrdersPage 와 동일한 동작)
  // ------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("is_browser_reload", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // URL 초기화가 끝나기를 기다리는 중인지 표시 (이전 검색조건으로 불필요한 조회가 나가는 것 방지)
  const resetPendingRef = useRef(false);

  // 진입 시 실제 새로고침이었다면 URL 검색조건을 비우고, 아니면 바로 조회 준비 완료
  useEffect(() => {
    const isReload = sessionStorage.getItem("is_browser_reload") === "true";

    if (isReload) {
      sessionStorage.removeItem("is_browser_reload");
      if (searchParams.toString()) {
        // URL 을 비운 뒤(아래 효과에서) 조회를 시작한다
        resetPendingRef.current = true;
        setSearchParams({}, { replace: true });
        return;
      }
    }

    setIsReady(true);
  }, []);

  // URL 이 비워지면 그때 조회 준비 완료 처리
  useEffect(() => {
    if (resetPendingRef.current && searchParams.toString() === "") {
      resetPendingRef.current = false;
      setIsReady(true);
    }
  }, [searchParams]);

  // ------------------------------------------
  // URL 에서 현재 검색조건 추출
  // ------------------------------------------
  const currentPage = Number(searchParams.get("page") || "0");
  const queryOrderCode = searchParams.get("orderCode") || "";
  const queryStatus = searchParams.get("status") || "";
  const queryManagerId = searchParams.get("managerId") || "";
  const queryShipDateFrom = searchParams.get("shipDateFrom") || "";
  const queryShipDateTo = searchParams.get("shipDateTo") || "";

  // 검색 input / select refs
  const orderCodeRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const managerIdRef = useRef<HTMLInputElement>(null);
  const shipDateFromRef = useRef<HTMLInputElement>(null);
  const shipDateToRef = useRef<HTMLInputElement>(null);

  // 검색 필드 정의
  const searchFields: SearchField[] = [
    {
      type: "date",
      label: "출고일자",
      startRef: shipDateFromRef,
      endRef: shipDateToRef,
    },
    {
      type: "input",
      label: "수주번호",
      ref: orderCodeRef,
      name: "orderCode",
    },
    {
      type: "select",
      label: "상태",
      ref: statusRef,
      options: [
        { label: "전체", value: "" },
        ...STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      ],
    },
    {
      type: "input",
      label: "담당자",
      ref: managerIdRef,
      name: "managerId",
    },
  ];

  // URL → SearchBand input / select 값 동기화 (뒤로가기 / 새로고침 후에도 검색값 유지)
  useEffect(() => {
    if (orderCodeRef.current) orderCodeRef.current.value = queryOrderCode;
    if (statusRef.current) statusRef.current.value = queryStatus;
    if (managerIdRef.current) managerIdRef.current.value = queryManagerId;
    if (shipDateFromRef.current) shipDateFromRef.current.value = queryShipDateFrom;
    if (shipDateToRef.current) shipDateToRef.current.value = queryShipDateTo;
  }, [
    queryOrderCode,
    queryStatus,
    queryManagerId,
    queryShipDateFrom,
    queryShipDateTo,
  ]);

  // ------------------------------------------
  // 출고지시서 목록 조회
  // ------------------------------------------
  const loadShipments = useCallback(async () => {
    if (!isReady) return;

    setIsLoading(true);

    try {
      // 값이 있는 조건만 파라미터에 담는다
      const params: Record<string, any> = {
        page: currentPage,
        size: 10,
      };
      if (queryOrderCode) params.orderCode = queryOrderCode;
      if (queryStatus) params.status = queryStatus;
      if (queryManagerId) params.managerId = queryManagerId;
      if (queryShipDateFrom) params.shipDateFrom = queryShipDateFrom;
      if (queryShipDateTo) params.shipDateTo = queryShipDateTo;
      if (sortParams.length > 0) params.sort = sortParams;

      const response = await ShipmentOrderApi.getList(params);
      const pageData = response.data;

      setShipments(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("출고지시서 목록 조회 실패:", error);
      window.alert("출고지시서 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [
    isReady,
    currentPage,
    queryOrderCode,
    queryStatus,
    queryManagerId,
    queryShipDateFrom,
    queryShipDateTo,
    sortParams,
  ]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  // ------------------------------------------
  // 이벤트 핸들러
  // ------------------------------------------

  /** 검색 실행: 입력값을 URL 쿼리스트링에 반영 (조회는 URL 변경으로 트리거) */
  const handleSearch = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");

    const fields: [string, string][] = [
      ["orderCode", orderCodeRef.current?.value.trim() || ""],
      ["status", statusRef.current?.value.trim() || ""],
      ["managerId", managerIdRef.current?.value.trim() || ""],
      ["shipDateFrom", shipDateFromRef.current?.value.trim() || ""],
      ["shipDateTo", shipDateToRef.current?.value.trim() || ""],
    ];

    fields.forEach(([key, value]) => {
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
    });

    setSearchParams(nextParams);
  };

  /** 검색 초기화 */
  const handleReset = () => {
    [orderCodeRef, statusRef, managerIdRef, shipDateFromRef, shipDateToRef].forEach(
      (ref) => {
        if (ref.current) ref.current.value = "";
      }
    );
    setSearchParams({ page: "0" }, { replace: true });
  };

  /** 페이지 이동 */
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  /** 상세 페이지 이동 (현재 검색조건을 쿼리스트링으로 넘겨 목록 복귀 시 유지) */
  const handleRowClick = (row: ShipmentOrderListResponse) => {
    const queryString = searchParams.toString();
    navigate(
      `/io/seed-outbound-manage/${encodeURIComponent(row.shipId)}${queryString ? `?${queryString}` : ""
      }`
    );
  };

  /** 등록 페이지 이동 */
  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(
      `/io/seed-outbound-manage/create${queryString ? `?${queryString}` : ""
      }`
    );
  };

  // ------------------------------------------
  // 테이블 컬럼 정의
  // ------------------------------------------
  const columns: ColumnDef<ShipmentOrderListResponse>[] = useMemo(
    () => [
      {
        accessorKey: "shipId",
        header: "출고지시ID",
        cell: ({ getValue }) => (
          <span className="food-table-code-cell">{getValue<string>() || "-"}</span>
        ),
      },
      {
        accessorKey: "orderCode",
        header: "수주번호",
        cell: ({ getValue }) => getValue<string>() || "-",
      },
      {
        accessorKey: "bpNm",
        header: "거래처",
        cell: ({ getValue }) => getValue<string>() || "-",
      },
      {
        accessorKey: "shipDate",
        header: "출고일자",
        cell: ({ getValue }) => getValue<string>() || "-",
      },
      {
        accessorKey: "status",
        header: "상태",
        cell: ({ getValue }) => {
          const meta = getStatusMeta(getValue<string>());
          return <Badge tone={meta.tone}>{meta.label}</Badge>;
        },
      },
      {
        accessorKey: "managerNm",
        header: "담당자",
        cell: ({ row }) => {
          const { managerNm, managerId } = row.original;
          return managerNm ? `${managerNm} (${managerId})` : managerId || "-";
        },
      },
      {
        accessorKey: "lineCount",
        header: "라인 수",
        cell: ({ getValue }) => `${getValue<number>() ?? 0}건`,
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

  // ------------------------------------------
  // 렌더링
  // ------------------------------------------
  return (
    <section className="screenStack">
      <SearchBand
        fields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <Panel title="씨드 출고지시서 목록" action="등록" onAction={handleCreate}>
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={shipments}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                onRowClick={handleRowClick}
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
