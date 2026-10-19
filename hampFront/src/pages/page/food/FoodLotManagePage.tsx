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
import { LabelPrintModal, type LabelItem } from "@/components/modal/LabelPrintModal";

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

  // 체크박스 선택된 LOT 번호 (현재 페이지 기준)
  const [selectedLotCodes, setSelectedLotCodes] = useState<string[]>([]);
  // 라벨 인쇄 모달 오픈 여부 / 출력완료 처리(PUT) 진행 여부
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isPrintSubmitting, setIsPrintSubmitting] = useState(false);

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
    if (producedStartRef.current) producedStartRef.current.value = queryDateFrom;
    if (producedEndRef.current) producedEndRef.current.value = queryDateTo;
    if (lotCodeRef.current) lotCodeRef.current.value = queryLotCode;
    if (shippedRef.current) shippedRef.current.value = queryShipYn;
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

    setSelectedLotCodes([]);
    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    [producedStartRef, producedEndRef, lotCodeRef, shippedRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });

    setSelectedLotCodes([]);
    setSearchParams({ page: "0" }, { replace: true });
  };

  // 페이지 이동 (선택 목록은 현재 페이지 기준이라 함께 초기화)
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("page", String(newPage));

    setSelectedLotCodes([]);
    setSearchParams(nextParams);
  };

  // ── 라벨 인쇄 ─────────────────────────────────────────────────────────────

  // 모달에 넘길 라벨 목록 (선택된 LOT 만)
  const labelItems: LabelItem[] = useMemo(
    () =>
      lots
        .filter((l) => selectedLotCodes.includes(l.lotCode))
        .map((l) => ({
          id: l.lotCode,
          barcode: l.lotCode,
          title: l.lotCode,
          name: l.productionDate ? `생산일자 ${l.productionDate}` : undefined,
          qty: l.productionQty,
          qtyLabel: "생산수량",
        })),
    [lots, selectedLotCodes],
  );

  const handleOpenLabelModal = () => {
    if (selectedLotCodes.length === 0) {
      window.alert("인쇄할 항목을 최소 1개 이상 선택해주세요.");
      return;
    }
    setIsLabelModalOpen(true);
  };

  const handleCloseLabelModal = () => {
    if (isPrintSubmitting) return;
    setIsLabelModalOpen(false);
  };

  // 인쇄가 진행된 뒤 → 출력완료 상태로 변경(PUT)
  const handleLabelPrinted = useCallback(async () => {
    const lotCodes = labelItems.map((item) => item.id);
    if (lotCodes.length === 0) return;

    setIsPrintSubmitting(true);
    try {
      await LotApi.putLabelPrint({ lotCodes });

      window.alert(`${lotCodes.length}건이 라벨 출력완료로 처리되었습니다.`);
      setIsLabelModalOpen(false);
      setSelectedLotCodes([]);
      await loadLots();
    } catch (error) {
      console.error("라벨 출력 상태 변경 실패:", error);
      window.alert(
        "출력 상태 변경에 실패했습니다.\n라벨 인쇄는 진행되었을 수 있으니 확인 후 다시 시도해주세요.",
      );
    } finally {
      setIsPrintSubmitting(false);
    }
  }, [labelItems, loadLots]);

  // ── 테이블 ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<LotResponse>[] = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            className="checkbox"
            onChange={(e) => {
              setSelectedLotCodes(e.target.checked ? lots.map((l) => l.lotCode) : []);
            }}
            checked={selectedLotCodes.length === lots.length && lots.length > 0}
            style={{ cursor: "pointer", width: "16px", height: "16px" }}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="checkbox"
            checked={selectedLotCodes.includes(row.original.lotCode)}
            onChange={() => {
              setSelectedLotCodes((prev) =>
                prev.includes(row.original.lotCode)
                  ? prev.filter((code) => code !== row.original.lotCode)
                  : [...prev, row.original.lotCode],
              );
            }}
            style={{ cursor: "pointer", width: "16px", height: "16px" }}
          />
        ),
        meta: { width: "50px" },
      },
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
        // API 응답 필드명: labelPrintYn (1 = 출력완료)
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
    [lots, selectedLotCodes],
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

      <Panel
        title="식품 LOT관리 목록"
        action={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button type="button" className="ghostButton" onClick={handleOpenLabelModal}>
              선택 라벨 인쇄 ({selectedLotCodes.length}건)
            </button>
          </div>
        }
      >
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

      <LabelPrintModal
        isOpen={isLabelModalOpen}
        onClose={handleCloseLabelModal}
        items={labelItems}
        confirmMessage={`선택한 ${labelItems.length}건의 라벨을 인쇄하시겠습니까?`}
        onPrinted={handleLabelPrinted}
        isBusy={isPrintSubmitting}
      />
    </section>
  );
}
