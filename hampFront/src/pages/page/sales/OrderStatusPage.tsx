import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import Spinner from "@/components/common/Spinner";
import { useTableSorting } from "@/hooks/useTableSorting";
import { BusinessPartnerApi, type BusinessPartnerOptionResponse } from "@/api/sales/BusinessPartner";
import { SalesOrderApi, type SalesOrderStatusLineResponse, type SalesOrderStatusGroupResponse } from "@/api/sales/SalesOrder";
import { Badge } from "@/components/common/Badge";
import "./Sales.css";

// 진행률 구간 임계값 — 로직(getProgressToneClass)과 범례 텍스트가 이 값을 함께 참조하므로
// 기준이 바뀌면 여기 한 곳만 수정하면 됨
const PROGRESS_HIGH_THRESHOLD = 90; // 이상: 초록
const PROGRESS_MID_THRESHOLD = 50;  // 이상: 주황 (미만은 빨강)

// 진행률 구간(90%↑ / 50~89% / 50%↓)에 따른 색상 클래스
function getProgressToneClass(pct: number | null | undefined): "barHigh" | "barMid" | "barLow" {
    const value = pct ?? 0;
    if (value >= PROGRESS_HIGH_THRESHOLD) return "barHigh";
    if (value >= PROGRESS_MID_THRESHOLD) return "barMid";
    return "barLow";
}

export function OrderStatusPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [orderStatusList, setOrderStatusList] = useState<SalesOrderStatusLineResponse[]>([]);
    const [businessPartnerOptions, setBusinessPartnerOptions] = useState<BusinessPartnerOptionResponse[]>([]);
    const [groupData, setGroupData] = useState<SalesOrderStatusGroupResponse[]>([]);

    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);

    // 그룹별 생산 진행률 패널 전용 로딩/에러 상태
    const [isGroupLoading, setIsGroupLoading] = useState(false);
    const [isGroupError, setIsGroupError] = useState(false);

    const [groupTab, setGroupTab] = useState<'item' | 'bp' | 'order'>('order');

    const {
        sorting,
        sortParams,
        handleSortingChange,
    } = useTableSorting();

    // 새로고침 감지 및 초기화 처리
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
    const queryItemCode = searchParams.get("itemCode") || "";

    // 검색 입력용 Ref
    const orderCodeRef = useRef<HTMLInputElement>(null);
    const bpCodeRef = useRef<HTMLSelectElement>(null);
    const itemCodeRef = useRef<HTMLInputElement>(null);

    // 거래처 옵션 API 호출
    const loadBusinessPartnerOptions = useCallback(async () => {
        try {
            const response = await BusinessPartnerApi.getOptions();
            setBusinessPartnerOptions(response.data ?? []);
        } catch (error) {
            console.error("거래처 옵션 목록 조회 실패:", error);
        }
    }, []);

    useEffect(() => {
        loadBusinessPartnerOptions();
    }, [loadBusinessPartnerOptions]);

    // 검색 필드 정의
    const searchFields: SearchField[] = useMemo(() => [
        {
            type: "input",
            label: "수주코드",
            ref: orderCodeRef,
            name: "orderCode",
        },
        {
            type: "select",
            label: "거래처코드",
            ref: bpCodeRef as any,
            options: [
                { label: "전체", value: "" },
                ...businessPartnerOptions.map((opt) => ({
                    label: `${opt.bpCode} (${opt.bpNm ?? '-'})`,
                    value: opt.bpCode,
                })),
            ],
        },
        {
            type: "input",
            label: "품목코드",
            ref: itemCodeRef,
            name: "itemCode",
        },
    ], [businessPartnerOptions]);

    // URL 값 → SearchBand 입력 폼 동기화
    useEffect(() => {
        if (orderCodeRef.current) orderCodeRef.current.value = queryOrderCode;
        if (bpCodeRef.current) bpCodeRef.current.value = queryBpCode;
        if (itemCodeRef.current) itemCodeRef.current.value = queryItemCode;
    }, [queryOrderCode, queryBpCode, queryItemCode, businessPartnerOptions]);

    // 수주현황 목록 조회 API
    const fetchStatusList = useCallback(async () => {
        if (!isReady) return;
        setIsLoading(true);

        try {
            const params: Record<string, any> = {
                page: currentPage,
                size: 10,
            };

            if (queryOrderCode) params.orderCode = queryOrderCode;
            if (queryBpCode) params.bpCode = queryBpCode;
            if (queryItemCode) params.itemCode = queryItemCode;
            if (sortParams.length > 0) params.sort = sortParams;

            const res = await SalesOrderApi.getStatusList(params);
            if (res && res.data) {
                setOrderStatusList(res.data.content || []);
                setTotalElements(res.data.totalElements || 0);
                setTotalPages(res.data.totalPages || 0);
            }
        } catch (error) {
            console.error('수주현황 목록 조회 실패:', error);
            window.alert('수주현황 데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [isReady, currentPage, queryOrderCode, queryBpCode, queryItemCode, sortParams]);

    // 그룹별 생산 진행률 조회 API
    const fetchStatusSummary = useCallback(async (currentGroupTab: 'item' | 'bp' | 'order') => {
        if (!isReady) return;
        setIsGroupLoading(true);
        setIsGroupError(false);

        try {
            const params: {
                groupBy: 'item' | 'bp' | 'order';
                orderCode?: string;
                bpCode?: string;
                itemCode?: string;
                [key: string]: any;
            } = {
                groupBy: currentGroupTab,
            };

            if (queryOrderCode) params.orderCode = queryOrderCode;
            if (queryBpCode) params.bpCode = queryBpCode;
            if (queryItemCode) params.itemCode = queryItemCode;

            const res = await SalesOrderApi.getStatusSummary(params);
            if (res && res.data) {
                setGroupData(res.data);
            }
        } catch (error) {
            console.error('그룹별 생산 진행률 조회 실패:', error);
            setIsGroupError(true);
            setGroupData([]);
        } finally {
            setIsGroupLoading(false);
        }
    }, [isReady, queryOrderCode, queryBpCode, queryItemCode]);

    // 데이터 연동 트리거
    useEffect(() => {
        fetchStatusList();
    }, [fetchStatusList]);

    useEffect(() => {
        fetchStatusSummary(groupTab);
    }, [groupTab, fetchStatusSummary]);

    // 검색 실행
    const handleSearch = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("page", "0");

        const orderCode = orderCodeRef.current?.value.trim() || "";
        const bpCode = bpCodeRef.current?.value.trim() || "";
        const itemCode = itemCodeRef.current?.value.trim() || "";

        if (orderCode) nextParams.set("orderCode", orderCode);
        else nextParams.delete("orderCode");

        if (bpCode) nextParams.set("bpCode", bpCode);
        else nextParams.delete("bpCode");

        if (itemCode) nextParams.set("itemCode", itemCode);
        else nextParams.delete("itemCode");

        setSearchParams(nextParams);
    };

    // 검색 초기화
    const handleReset = () => {
        if (orderCodeRef.current) orderCodeRef.current.value = "";
        if (bpCodeRef.current) bpCodeRef.current.value = "";
        if (itemCodeRef.current) itemCodeRef.current.value = "";

        setSearchParams({ page: "0" }, { replace: true });
    };

    // 페이지 변경
    const handlePageChange = (newPage: number) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("page", String(newPage));
        setSearchParams(nextParams);
    };

    // 테이블 컬럼 정의
    const columns: ColumnDef<SalesOrderStatusLineResponse>[] = useMemo(
        () => [
            { accessorKey: 'orderCode', header: '수주코드' },
            { accessorKey: 'itemCode', header: '품목코드' },
            { accessorKey: 'itemNm', header: '품목명' },
            {
                accessorKey: 'orderQty',
                header: '주문수량',
                cell: ({ row }) => (row.original.orderQty ?? 0).toLocaleString()
            },
            {
                accessorKey: 'orderAmount',
                header: '주문금액',
                cell: ({ row }) => (row.original.orderAmount ?? 0).toLocaleString()
            },
            {
                accessorKey: 'producedQty',
                header: '생산량',
                cell: ({ row }) => (row.original.producedQty ?? 0).toLocaleString()
            },
            {
                accessorKey: 'progressRate',
                header: '진행률',
                cell: ({ row }) => {
                    const pct = row.original.progressRate;

                    if (pct === null || pct === undefined) {
                        return (
                            <Badge tone="muted">
                                <span className="noDataBadge">
                                    <span className="noDataDot" />
                                    실적 미연동
                                </span>
                            </Badge>
                        );
                    }

                    const toneClass = getProgressToneClass(pct);
                    const safePct = Math.min(Math.max(pct, 0), 100);

                    return (
                        <div className="progressCell">
                            <div
                                className="progressTrack"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={safePct}
                            >
                                <div
                                    className={`progressFill ${toneClass}`}
                                    style={{ width: `${safePct}%` }}
                                />
                            </div>
                            <span className="progressPct">{pct}%</span>
                        </div>
                    );
                },
            },
        ],
        [],
    );

    return (
        <section className="screenStack">
            <SearchBand
                fields={searchFields}
                onSearch={handleSearch}
                onReset={handleReset}
            />

            <Panel title="그룹별 생산 진행률">
                <div className="summaryHeader">
                    <span className="summaryDesc">
                        기준을 선택하면 해당 기준으로 라인을 합산해 진행률을 비교합니다.
                    </span>

                    <div className="legend">
                        <span className="legendItem"><span className="legendDot legendHigh" /> {PROGRESS_HIGH_THRESHOLD}% 이상</span>
                        <span className="legendItem"><span className="legendDot legendMid" /> {PROGRESS_MID_THRESHOLD}~{PROGRESS_HIGH_THRESHOLD - 1}%</span>
                        <span className="legendItem"><span className="legendDot legendLow" /> {PROGRESS_MID_THRESHOLD}% 미만</span>
                    </div>
                </div>

                <div className="tabGroup" role="tablist" aria-label="그룹 집계 기준">
                    {(['item', 'bp', 'order'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={groupTab === tab}
                            onClick={() => setGroupTab(tab)}
                            className={`tabButton${groupTab === tab ? ' tabButtonActive' : ''}`}
                        >
                            {tab === 'item' ? '품목별' : tab === 'bp' ? '거래처별' : '수주번호별'}
                        </button>
                    ))}
                </div>

                {/* 그룹 행: 라벨(이름+건수) / 진행바 / 생산·주문수량 이 한 줄에 나란히 배치 */}
                {isGroupLoading ? (
                    <div className="groupStateBox">
                        <Spinner />
                    </div>
                ) : isGroupError ? (
                    <div className="groupStateBox groupStateError">
                        그룹 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                    </div>
                ) : (
                    <div className="groupList">
                        {groupData.map((item) => {
                            const pct = item.progressRate ?? 0;
                            const toneClass = getProgressToneClass(pct);
                            return (
                                <div key={item.groupKey} className="groupRow">
                                    <div className="groupInfo">
                                        <span className="groupName">{item.groupLabel}</span>
                                        <span className="groupCount">{item.lineCount}건 합산</span>
                                    </div>

                                    <div
                                        className="groupBarTrack"
                                        role="progressbar"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={Math.min(pct, 100)}
                                        aria-label={`${item.groupLabel} 생산 진행률`}
                                    >
                                        <div
                                            className={`groupBarFill ${toneClass}`}
                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                    </div>

                                    <div className="groupNumbers">
                                        {(item.totalProducedQty ?? 0).toLocaleString()} / {(item.totalOrderQty ?? 0).toLocaleString()}
                                    </div>
                                </div>
                            );
                        })}
                        {groupData.length === 0 && (
                            <div className="emptyState">
                                조회된 그룹 데이터가 없습니다.
                            </div>
                        )}
                    </div>
                )}
            </Panel>

            <Panel title="수주현황 목록">
                <div className="relative min-h-[300px]">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Spinner />
                        </div>
                    ) : (
                        <>
                            <CusTable
                                data={orderStatusList}
                                columns={columns}
                                sorting={sorting}
                                onSortingChange={handleSortingChange}
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
