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
import { formatDateTime } from "@/utils/common";
import { useTableSorting } from "@/hooks/useTableSorting";

import type { SalesOrderResponse } from "@/api/sales/SalesOrder"; 
import { SalesOrderApi } from "@/api/sales/SalesOrder";
import Spinner from "@/components/common/Spinner";

export function SalesOrderPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [salesOrders, setSalesOrders] = useState<SalesOrderResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // 새로고침 초기화가 끝난 뒤에 목록 조회를 시작하기 위한 상태
    const [isReady, setIsReady] = useState(false);

    const {
        sorting,
        sortParams,
        handleSortingChange,
    } = useTableSorting();

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
    const queryOrderCode = searchParams.get("orderCode") || "";
    const queryBpCode = searchParams.get("bpCode") || "";
    const queryStatus = searchParams.get("status") || "";
    const queryDueDate = searchParams.get("dueDate") || "";

    // 검색 input / select refs
    const orderCodeRef = useRef<HTMLInputElement>(null);
    const bpCodeRef = useRef<HTMLInputElement>(null);
    const statusRef = useRef<HTMLInputElement>(null); 
    const dueDateRef = useRef<HTMLInputElement>(null);

    // 검색 필드 정의
    const searchFields: SearchField[] = [
        {
            type: "input",
            label: "수주코드",
            ref: orderCodeRef,
            name: "orderCode",
        },
        {
            type: "input",
            label: "거래처코드",
            ref: bpCodeRef,
            name: "bpCode",
        },
        {
            type: "input",
            label: "상태",
            ref: statusRef,
            name: "status",
        },
        {
            type: "input", // 날짜 타입 컴포넌트에 맞춰 "date" 또는 "input" 사용
            label: "납기일자",
            ref: dueDateRef,
            name: "dueDate",
        },
    ];

    // URL → SearchBand input / select 동기화
    useEffect(() => {
        if (orderCodeRef.current) {
            orderCodeRef.current.value = queryOrderCode;
        }
        if (bpCodeRef.current) {
            bpCodeRef.current.value = queryBpCode;
        }
        if (statusRef.current) {
            statusRef.current.value = queryStatus;
        }
        if (dueDateRef.current) {
            dueDateRef.current.value = queryDueDate;
        }
    }, [
        queryOrderCode,
        queryBpCode,
        queryStatus,
        queryDueDate,
    ]);

    // 수주 목록 조회
    const loadSalesOrders = useCallback(async () => {
        if (!isReady) {
            return;
        }

        setIsLoading(true);

        try {
            const params: Record<string, any> = {
                page: currentPage,
                size: 10,
            };

            if (queryOrderCode) {
                params.orderCode = queryOrderCode;
            }
            if (queryBpCode) {
                params.bpCode = queryBpCode;
            }
            if (queryStatus) {
                params.status = queryStatus;
            }
            if (queryDueDate) {
                params.dueDate = queryDueDate;
            }

            if (sortParams.length > 0) {
                params.sort = sortParams;
            }

            const response = await SalesOrderApi.getList(params);
            const pageData = response.data;

            setSalesOrders(pageData.content ?? []);
            setTotalElements(pageData.totalElements ?? 0);
            setTotalPages(pageData.totalPages ?? 0);
        } catch (error) {
            console.error("수주 목록 조회 실패:", error);
            window.alert("수주 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, [
        isReady,
        currentPage,
        queryOrderCode,
        queryBpCode,
        queryStatus,
        queryDueDate,
        sortParams,
    ]);

    useEffect(() => {
        loadSalesOrders();
    }, [loadSalesOrders]);

    // 검색 실행
    const handleSearch = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("page", "0");

        const orderCode = orderCodeRef.current?.value.trim() || "";
        const bpCode = bpCodeRef.current?.value.trim() || "";
        const status = statusRef.current?.value.trim() || "";
        const dueDate = dueDateRef.current?.value.trim() || "";

        if (orderCode) {
            nextParams.set("orderCode", orderCode);
        } else {
            nextParams.delete("orderCode");
        }

        if (bpCode) {
            nextParams.set("bpCode", bpCode);
        } else {
            nextParams.delete("bpCode");
        }

        if (status) {
            nextParams.set("status", status);
        } else {
            nextParams.delete("status");
        }

        if (dueDate) {
            nextParams.set("dueDate", dueDate);
        } else {
            nextParams.delete("dueDate");
        }

        setSearchParams(nextParams);
    };

    // 검색 초기화
    const handleReset = () => {
        if (orderCodeRef.current) orderCodeRef.current.value = "";
        if (bpCodeRef.current) bpCodeRef.current.value = "";
        if (statusRef.current) statusRef.current.value = "";
        if (dueDateRef.current) dueDateRef.current.value = "";

        setSearchParams({ page: "0" }, { replace: true });
    };

    // 페이지 이동
    const handlePageChange = (newPage: number) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("page", String(newPage));
        setSearchParams(nextParams);
    };

    // 상세 페이지 이동
    const handleRowClick = (orderCode: string) => {
        const queryString = searchParams.toString();
        navigate(
            `/sales/sales-order/${encodeURIComponent(orderCode)}${
                queryString ? `?${queryString}` : ""
            }`
        );
    };

    // 테이블 컬럼 정의
    const columns: ColumnDef<SalesOrderResponse>[] = useMemo(
        () => [
            { accessorKey: "orderCode", header: "수주코드" },
            {
                accessorKey: "bpCode",
                header: "거래처코드",
                cell: ({ getValue }) => getValue<string>() || "-",
            },
            {
                accessorKey: "dueDate",
                header: "납기일자",
                cell: ({ getValue }) => getValue<string>() || "-",
            },
            {
                accessorKey: "status",
                header: "상태",
                cell: ({ getValue }) => getValue<string>() || "-",
            },
            {
                accessorKey: "note",
                header: "비고",
                cell: ({ getValue }) => getValue<string>() || "-",
            },
            {
                accessorKey: "createdAt",
                header: "등록일시",
                cell: ({ getValue }) => {
                    const val = getValue<string>();
                    return val ? formatDateTime(val) : "-";
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
                        `/sales/sales-order/create${
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
                                data={salesOrders}
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