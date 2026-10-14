import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTableSorting } from "@/hooks/useTableSorting";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { CheckIcon, ClockIcon } from "@heroicons/react/24/solid";
import { LotApi, type LotResponse } from "@/api/Lot";
import { useSearchParams } from "react-router-dom";
import type { StatusTone } from "@/types";
import Spinner from "@/components/common/Spinner";

const lotFlowPanel = {
  title: "LOT 흐름",
  items: [
    { label: "원료 투입", value: "완료", tone: "good" as StatusTone },
    { label: "생산", value: "완료", tone: "good" as StatusTone },
    { label: "검사", value: "완료", tone: "good" as StatusTone },
    { label: "출고", value: "대기", tone: "muted" as StatusTone },
  ],
};

export function FoodLotManagePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [lots, setLots] = useState<LotResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 새로고침 초기화가 끝난 뒤에 목록 조회를 시작하기 위한 상태
  const [isReady, setIsReady] = useState(false);

  const { sorting, sortParams, handleSortingChange } = useTableSorting();

  // [정확한 새로고침 감지]
  // 브라우저가 닫히거나 새로고침(F5)될 때만 플래그 설정
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

  // 새로고침 때문에 setSearchParams가 실행된 경우 조회 가능 상태로 변경
  useEffect(() => {
    const isReload = sessionStorage.getItem("is_browser_reload") === "true";
    if (!isReload && !isReady) {
      setIsReady(true);
    }
  }, [searchParams, isReady]);

  // URL에서 현재 검색조건 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryLotCode = searchParams.get("lotCode") || "";
  const queryShipYn = searchParams.get("shipYn") || "";
  const queryDateFrom = searchParams.get("productionDateFrom") || "";
  const queryDateTo = searchParams.get("productionDateTo") || "";

  // 검색 input refs
  const producedStartRef = useRef<HTMLInputElement>(null);
  const producedEndRef = useRef<HTMLInputElement>(null);
  const lotCodeRef = useRef<HTMLInputElement>(null);
  const shippedRef = useRef<HTMLInputElement>(null);

  // 검색 필드
  const searchFields: SearchField[] = [
    {
      type: "date",
      label: "생산일자",
      startRef: producedStartRef,
      endRef: producedEndRef,
    },
    {
      type: "input",
      label: "LOT번호",
      ref: lotCodeRef,
      name: "lotCode",
    },
    {
      type: "input",
      label: "출고여부",
      ref: shippedRef,
      name: "shipYn",
    },
  ];

  // URL → SearchBand input 동기화
  useEffect(() => {
    if (producedStartRef.current) {
      producedStartRef.current.value = queryDateFrom;
    }

    if (producedEndRef.current) {
      producedEndRef.current.value = queryDateTo;
    }

    if (lotCodeRef.current) {
      lotCodeRef.current.value = queryLotCode;
    }

    if (shippedRef.current) {
      shippedRef.current.value = queryShipYn;
    }
  }, [queryDateFrom, queryDateTo, queryLotCode, queryShipYn]);

  // LOT 목록 조회
  const loadLots = useCallback(async () => {
    if (!isReady) return;

    setIsLoading(true);

    try {
      const params: {
        page: number;
        size: number;
        sort?: string[];
        lotCode?: string;
        shipYn?: string;
        productionDateFrom?: string;
        productionDateTo?: string;
      } = {
        page: currentPage,
        size: 10,
      };

      if (queryLotCode) params.lotCode = queryLotCode;
      if (queryShipYn) params.shipYn = queryShipYn;
      if (queryDateFrom) params.productionDateFrom = queryDateFrom;
      if (queryDateTo) params.productionDateTo = queryDateTo;

      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await LotApi.getList(params);
      const pageData = response.data;

      setLots(pageData?.content ?? []);
      setTotalElements(pageData?.totalElements ?? 0);
      setTotalPages(pageData?.totalPages ?? 0);
    } catch (error) {
      console.error("LOT 목록 조회 실패:", error);
      window.alert("LOT 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [
    isReady,
    currentPage,
    queryLotCode,
    queryShipYn,
    queryDateFrom,
    queryDateTo,
    sortParams,
  ]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  // 검색
  const handleSearch = () => {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("page", "0");

    const values: Record<string, string> = {
      lotCode: lotCodeRef.current?.value.trim() || "",
      shipYn: shippedRef.current?.value.trim() || "",
      productionDateFrom: producedStartRef.current?.value || "",
      productionDateTo: producedEndRef.current?.value || "",
    };

    Object.entries(values).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });

    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    [producedStartRef, producedEndRef, lotCodeRef, shippedRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });

    setSearchParams({ page: "0" }, { replace: true });
  };

  // 페이지 이동
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("page", String(newPage));

    setSearchParams(nextParams);
  };

  // 테이블 컬럼
  const columns: ColumnDef<LotResponse>[] = useMemo(
    () => [
      {
        accessorKey: "lotCode",
        header: "LOT번호",
      },
      {
        accessorKey: "productionDate",
        header: "생산일자",
      },
      {
        accessorKey: "productionQty",
        header: "생산수량",
      },
      {
        accessorKey: "currentStatus",
        header: "현재상태",
      },
      {
        accessorKey: "shipYn",
        header: "출고여부",
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <Badge tone={val === 1 ? "good" : "muted"}>
              {val === 1 ? "출고완료" : "미출고"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "labelPrintYn",
        header: "라벨출력상태",
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <Badge tone={val === 1 ? "good" : "muted"}>
              {val === 1 ? "출력완료" : "미출력"}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <section className="screenStack">
      <Panel title={lotFlowPanel.title}>
        <ol className="lotFlow">
          {lotFlowPanel.items.map((item, index) => {
            const currentIdx = lotFlowPanel.items.findIndex((i) => i.tone !== "good");
            const state = item.tone === "good" ? "done" : index === currentIdx ? "current" : "pending";

            return (
              <li key={item.label} className={`lotFlow__step is-${state}`}>
                <span className="lotFlow__no">STEP {String(index + 1).padStart(2, "0")}</span>
                <div className="lotFlow__rail">
                  <span className="lotFlow__dot" aria-hidden>
                    {state === "done" ? <CheckIcon width={18} height={18} /> : <ClockIcon width={18} height={18} />}
                  </span>
                </div>
                <strong className="lotFlow__label">{item.label}</strong>
                <Badge tone={item.tone}>{item.value}</Badge>
              </li>
            );
          })}
        </ol>
      </Panel>

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="식품 LOT관리 목록">
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={lots}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                noDataMessage="조회된 LOT 데이터가 없습니다."
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
