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
import { BusinessPartnerApi, type BusinessPartnerOptionResponse } from "@/api/sales/BusinessPartner";
import { ItemApi, type ItemOptionResponse } from "@/api/master/Item";
import {
    FiberSalesOrderApi,
    type FiberSalesOrderLineResponse,
    type FiberSalesOrderResponse,
} from "@/api/sales/FiberSalesOrder";
import { FiberAllocationMiniBar } from "@/components/common/FiberSalesOrderAllocationSection";
import {
    FIBER_QTY_UNIT,
    FIBER_RAW_ITEM_CATEGORY,
    FIBER_STATUS_LABEL,
    FIBER_STATUS_OPTIONS,
    formatKg,
    formatWon,
} from "@/utils/fiberSalesOrderAllocation";
import Spinner from "@/components/common/Spinner";
import "@/pages/page/inpiSales/InpiSales.css";

/**
 * 목록 행 타입
 * - 목록 API 응답에는 제품별 배분(lines)이 없어서, 화면에서 상세 조회 결과를 붙여 쓴다.
 * - 백엔드 목록 응답에 lines 가 추가되면 LOAD_LINES_FROM_DETAIL 을 false 로 바꾸면 된다.
 */
type FiberOrderRow = FiberSalesOrderResponse & {
    lines?: FiberSalesOrderLineResponse[];
};

/** true: 목록 조회 후 현재 페이지 행마다 상세(getDetail)를 호출해 제품별 배분을 채운다 (페이지당 최대 10건) */
const LOAD_LINES_FROM_DETAIL = false;

const LIST_PATH = "/inpi-sales/sales-order";

export function InpiSalesOrderPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [orders, setOrders] = useState<FiberOrderRow[]>([]);
    const [businessPartnerOptions, setBusinessPartnerOptions] = useState<BusinessPartnerOptionResponse[]>([]);
    const [rawItemOptions, setRawItemOptions] = useState<ItemOptionResponse[]>([]);

    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const [isReady, setIsReady] = useState(false);

    const {
        sorting,
        sortParams,
        handleSortingChange,
    } = useTableSorting();

    // 정확한 새로고침 감지 및 초기화 로직 (씨드 수주 목록과 동일)
    useEffect(() => {
        const handleBeforeUnload = () => {
            sessionStorage.setItem("is_browser_reload", "true");
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        const isReload = sessionStorage.getItem("is_browser_reload") === "true";
        if (isReload) {
            sessionStorage.removeItem("is_browser_reload");
            if (searchParams.toString()) {
                setSearchParams({}, { replace: true });
            }
        }
        setIsReady(true);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    // URL에서 현재 검색조건 추출
    const currentPage = Number(searchParams.get("page") || "0");
    const queryOrderCode = searchParams.get("orderCode") || "";
    const queryBpCode = searchParams.get("bpCode") || "";
    const queryRawItemCode = searchParams.get("rawItemCode") || "";
    const queryStatus = searchParams.get("status") || "";
    const queryOrderDateFrom = searchParams.get("orderDateFrom") || "";
    const queryOrderDateTo = searchParams.get("orderDateTo") || "";

    // 검색 input
    const orderCodeRef = useRef<HTMLInputElement>(null);
    const bpCodeRef = useRef<HTMLSelectElement>(null);
    const rawItemCodeRef = useRef<HTMLSelectElement>(null);
    const statusRef = useRef<HTMLSelectElement>(null);
    const orderDateFromRef = useRef<HTMLInputElement>(null);
    const orderDateToRef = useRef<HTMLInputElement>(null);

    // 거래처 / 투입원료 옵션 API 호출
    const loadOptions = useCallback(async () => {
        try {
            const [bpRes, rawItemRes] = await Promise.all([
                BusinessPartnerApi.getOptions(),
                ItemApi.getOptions({ productType: 1, category: FIBER_RAW_ITEM_CATEGORY }),
            ]);
            setBusinessPartnerOptions(bpRes.data ?? []);
            setRawItemOptions(rawItemRes.data ?? []);
        } catch (error) {
            console.error("옵션 목록 조회 실패:", error);
        }
    }, []);

    useEffect(() => {
        loadOptions();
    }, [loadOptions]);

    // 검색 필드 정의
    const searchFields: SearchField[] = useMemo(() => [
        {
            type: "input",
            label: "수주번호",
            ref: orderCodeRef,
            name: "orderCode",
            value: queryOrderCode,
        },
        {
            type: "select",
            label: "거래처명",
            ref: bpCodeRef as any,
            value: queryBpCode,
            options: [
                { label: "전체", value: "" },
                ...businessPartnerOptions.map((opt) => ({
                    label: `${opt.bpNm} (${opt.bpCode ?? '-'})`,
                    value: opt.bpCode,
                })),
            ],
        },
        {
            type: "select",
            label: "투입원료",
            ref: rawItemCodeRef as any,
            value: queryRawItemCode,
            options: [
                { label: "전체", value: "" },
                ...rawItemOptions.map((opt) => ({
                    label: `${opt.itemNm ?? opt.itemCode} (${opt.itemCode})`,
                    value: opt.itemCode,
                })),
            ],
        },
        {
            type: "select",
            label: "상태",
            ref: statusRef as any,
            value: queryStatus,
            options: [
                { label: "전체", value: "" },
                ...FIBER_STATUS_OPTIONS.map((opt) => ({ label: opt.label, value: opt.value })),
            ],
        },
        // 수주일 범위는 단일 날짜 필드 2개(시작/종료)로 구성
        {
            type: "single-date",
            label: "수주일(시작)",
            ref: orderDateFromRef,
            name: "orderDateFrom",
            value: queryOrderDateFrom,
        },
        {
            type: "single-date",
            label: "수주일(종료)",
            ref: orderDateToRef,
            name: "orderDateTo",
            value: queryOrderDateTo,
        },
    ], [businessPartnerOptions, rawItemOptions]);

    // 섬유 수주 목록 조회
    const loadOrders = useCallback(async () => {
        if (!isReady) return;

        setIsLoading(true);

        try {
            const params: Record<string, any> = {
                page: currentPage,
                size: 10,
            };

            if (queryOrderCode) params.orderCode = queryOrderCode;
            if (queryBpCode) params.bpCode = queryBpCode;
            if (queryRawItemCode) params.rawItemCode = queryRawItemCode;
            if (queryStatus) params.status = queryStatus;
            if (queryOrderDateFrom) params.orderDateFrom = queryOrderDateFrom;
            if (queryOrderDateTo) params.orderDateTo = queryOrderDateTo;

            if (sortParams.length > 0) {
                params.sort = sortParams;
            }

            const response = await FiberSalesOrderApi.getList(params);
            const pageData = response.data;
            const rows: FiberOrderRow[] = pageData.content ?? [];

            // 제품별 배분은 상세 응답에만 있으므로 현재 페이지 행에 붙인다 (실패한 행은 "-" 표시)
            const rowsWithLines = LOAD_LINES_FROM_DETAIL
                ? await Promise.all(
                    rows.map(async (row) => {
                        if (row.lines) return row;
                        try {
                            const detail = await FiberSalesOrderApi.getDetail(row.orderCode);
                            return { ...row, lines: detail.data?.lines ?? [] };
                        } catch (error) {
                            console.error(`수주 배분 조회 실패(${row.orderCode}):`, error);
                            return row;
                        }
                    }),
                )
                : rows;

            setOrders(rowsWithLines);
            setTotalElements(pageData.totalElements ?? 0);
            setTotalPages(pageData.totalPages ?? 0);
        } catch (error) {
            console.error("섬유 수주 목록 조회 실패:", error);
            window.alert("섬유 수주 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, [
        isReady, currentPage, queryOrderCode, queryBpCode, queryRawItemCode,
        queryStatus, queryOrderDateFrom, queryOrderDateTo, sortParams,
    ]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    // 검색 실행
    const handleSearch = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("page", "0");

        const entries: [string, string][] = [
            ["orderCode", orderCodeRef.current?.value.trim() || ""],
            ["bpCode", bpCodeRef.current?.value.trim() || ""],
            ["rawItemCode", rawItemCodeRef.current?.value.trim() || ""],
            ["status", statusRef.current?.value.trim() || ""],
            ["orderDateFrom", orderDateFromRef.current?.value.trim() || ""],
            ["orderDateTo", orderDateToRef.current?.value.trim() || ""],
        ];

        // 값이 있으면 설정, 비어 있으면 파라미터 제거
        entries.forEach(([key, value]) => {
            if (value) nextParams.set(key, value);
            else nextParams.delete(key);
        });

        setSearchParams(nextParams);
    };

    // 검색 초기화
    const handleReset = () => {
        [orderCodeRef, orderDateFromRef, orderDateToRef].forEach((ref) => {
            if (ref.current) ref.current.value = "";
        });
        [bpCodeRef, rawItemCodeRef, statusRef].forEach((ref) => {
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

    // 상세 페이지 이동 (검색조건 유지)
    const handleRowClick = (orderCode: string) => {
        const queryString = searchParams.toString();
        navigate(
            `${LIST_PATH}/${encodeURIComponent(orderCode)}${queryString ? `?${queryString}` : ""
            }`
        );
    };

    // 테이블 컬럼 정의
    const columns: ColumnDef<FiberOrderRow>[] = useMemo(
        () => [
            { accessorKey: "orderCode", header: "수주번호" },
            {
                accessorKey: "bpNm",
                header: "거래처명",
                cell: ({ getValue }) => getValue<string>() || "-",
            },
            {
                accessorKey: "rawItemNm",
                header: "투입원료",
                cell: ({ getValue }) => getValue<string>() || "-",
            },
            {
                accessorKey: "requestInputQty",
                header: "투입원료 수량",
                cell: ({ getValue }) => `${formatKg(getValue<number>())} ${FIBER_QTY_UNIT}`,
            },
            {
                // 제품별 배분: 목업의 미니 막대 + 제품별 kg 텍스트
                id: "allocation",
                header: "제품별 배분",
                enableSorting: false,
                cell: ({ row }) => (
                    <FiberAllocationMiniBar
                        lines={row.original.lines}
                        totalQty={row.original.requestInputQty}
                    />
                ),
            },
            {
                accessorKey: "processingFee",
                header: "가공비",
                cell: ({ getValue }) => formatWon(getValue<number | null>()),
            },
            {
                accessorKey: "orderDate",
                header: "수주일",
                cell: ({ getValue }) => getValue<string>() || "-",
            },
            {
                accessorKey: "dueDate",
                header: "납기일",
                cell: ({ getValue }) => getValue<string>() || "-",
            },
            {
                accessorKey: "status",
                header: "상태",
                cell: ({ getValue }) => {
                    const status = getValue<string>();
                    return FIBER_STATUS_LABEL[status] ?? (status || "-");
                },
            },
        ],
        []
    );

    return (
        <section className="screenStack">
            <SearchBand
                fields={searchFields}
                onSearch={handleSearch}
                onReset={handleReset}
            />

            <Panel
                title="수주 관리 목록"
                action="등록"
                onAction={() => {
                    const queryString = searchParams.toString();
                    navigate(
                        `${LIST_PATH}/create${queryString ? `?${queryString}` : ""
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
                                data={orders}
                                columns={columns}
                                sorting={sorting}
                                onSortingChange={handleSortingChange}
                                onRowClick={(row) => handleRowClick(row.orderCode)}
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
