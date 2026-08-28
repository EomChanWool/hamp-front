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

export function OrderStatusPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [orderStatusList, setOrderStatusList] = useState<SalesOrderStatusLineResponse[]>([]);
    const [businessPartnerOptions, setBusinessPartnerOptions] = useState<BusinessPartnerOptionResponse[]>([]);
    const [groupData, setGroupData] = useState<SalesOrderStatusGroupResponse[]>([]);

    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);

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

    // 페이지 변경 (유지 필요)
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
                                <span style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px' 
                                }}>
                                    <span style={{ 
                                        width: '6px', 
                                        height: '6px', 
                                        borderRadius: '50%', 
                                        background: '#64748b',
                                        flexShrink: 0 
                                    }} />
                                    실적 미연동
                                </span>
                            </Badge>
                        );
                    }

                    const barColor = pct >= 90 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                    const safePct = Math.min(Math.max(pct, 0), 100);

                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                            <div style={{ 
                                position: 'relative',
                                width: '80px', 
                                height: '8px', 
                                background: '#e2e8f0', 
                                borderRadius: '4px', 
                                overflow: 'hidden', 
                                flexShrink: 0 
                            }}>
                                <div style={{ 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    bottom: 0,
                                    width: `${safePct}%`, 
                                    background: barColor, 
                                    borderRadius: '4px',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '35px', textAlign: 'right' }}>
                                {pct}%
                            </span>
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
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        기준을 선택하면 해당 기준으로 데이터를 합산해 진행률을 비교합니다.
                    </span>

                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                        <span><span style={{ color: '#10b981', fontWeight: 'bold' }}>■</span> 90% 이상</span>
                        <span><span style={{ color: '#f59e0b', fontWeight: 'bold' }}>■</span> 50~89%</span>
                        <span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>■</span> 50% 미만</span>
                    </div>
                </div>

                {/* 세그먼트 버튼 스타일 적용된 탭 영역 */}
                <div style={{ display: 'flex', background: 'var(--border)', padding: '3px', borderRadius: '8px', gap: '4px', marginBottom: '20px', width: 'fit-content' }}>
                    {(['item', 'bp', 'order'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setGroupTab(tab)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                background: groupTab === tab ? 'var(--bg-card, #fff)' : 'transparent',
                                color: groupTab === tab ? 'var(--text-main)' : 'var(--text-muted)',
                                boxShadow: groupTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: groupTab === tab ? 600 : 500,
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {tab === 'item' ? '품목별' : tab === 'bp' ? '거래처별' : '수주별'}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {groupData.map((item) => {
                        const pct = item.progressRate ?? 0;
                        const barColor = pct >= 90 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                        return (
                            <div key={item.groupKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                                    <span>{item.groupLabel} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>({item.lineCount}건 합산)</span></span>
                                    <span style={{ fontFamily: 'monospace' }}>
                                        {(item.totalProducedQty ?? 0).toLocaleString()} / {(item.totalOrderQty ?? 0).toLocaleString()} ({pct}%)
                                    </span>
                                </div>
                                <div style={{ width: '100%', height: '10px', background: 'var(--border)', borderRadius: '5px', overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${Math.min(pct, 100)}%`,
                                            height: '100%',
                                            background: barColor,
                                            borderRadius: '5px',
                                            transition: 'width 0.3s ease',
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {groupData.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            조회된 그룹 데이터가 없습니다.
                        </div>
                    )}
                </div>
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