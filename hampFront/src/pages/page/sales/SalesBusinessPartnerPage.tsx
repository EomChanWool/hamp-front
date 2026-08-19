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

import type { BusinessPartnerResponse } from "@/api/sales/BusinessPartner"; 
import { BusinessPartnerApi } from "@/api/sales/BusinessPartner";
import Spinner from "@/components/common/Spinner";

export function SalesBusinessPartnerPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [partners, setPartners] = useState<BusinessPartnerResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const {
        sorting,
        sortParams,
        handleSortingChange,
    } = useTableSorting();

    // [브라우저 새로고침 감지]
    useEffect(() => {
        const handleBeforeUnload = () => {
            sessionStorage.setItem("is_browser_reload", "true");
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
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

    useEffect(() => {
        const isReload = sessionStorage.getItem("is_browser_reload") === "true";
        if (!isReload && !isReady) {
            setIsReady(true);
        }
    }, [searchParams, isReady]);

    // URL 파라미터 추출
    const currentPage = Number(searchParams.get("page") || "0");
    const queryBpCode = searchParams.get("bpCode") || "";
    const queryBpNm = searchParams.get("bpNm") || "";
    const queryCeoNm = searchParams.get("ceoNm") || "";

    // 검색 refs
    const bpCodeRef = useRef<HTMLInputElement>(null);
    const bpNmRef = useRef<HTMLInputElement>(null);
    const ceoNmRef = useRef<HTMLInputElement>(null);

    const searchFields: SearchField[] = [
        { type: "input", label: "거래처코드", ref: bpCodeRef, name: "bpCode" },
        { type: "input", label: "거래처명", ref: bpNmRef, name: "bpNm" },
        { type: "input", label: "대표자명", ref: ceoNmRef, name: "ceoNm" },
    ];

    // URL 동기화
    useEffect(() => {
        if (bpCodeRef.current) bpCodeRef.current.value = queryBpCode;
        if (bpNmRef.current) bpNmRef.current.value = queryBpNm;
        if (ceoNmRef.current) ceoNmRef.current.value = queryCeoNm;
    }, [queryBpCode, queryBpNm, queryCeoNm]);

    // 목록 조회
    const loadPartners = useCallback(async () => {
        if (!isReady) return;
        setIsLoading(true);

        try {
            const params: Record<string, any> = {
                page: currentPage,
                size: 10,
                ...(queryBpCode && { bpCode: queryBpCode }),
                ...(queryBpNm && { bpNm: queryBpNm }),
                ...(queryCeoNm && { ceoNm: queryCeoNm }),
                ...(sortParams.length > 0 && { sort: sortParams }),
            };

            const response = await BusinessPartnerApi.getList(params);
            const pageData = response.data;

            setPartners(pageData.content ?? []);
            setTotalElements(pageData.totalElements ?? 0);
            setTotalPages(pageData.totalPages ?? 0);
        } catch (error) {
            console.error("거래처 목록 조회 실패:", error);
            window.alert("거래처 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, [isReady, currentPage, queryBpCode, queryBpNm, queryCeoNm, sortParams]);

    useEffect(() => {
        loadPartners();
    }, [loadPartners]);

    const handleSearch = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("page", "0");
        
        const fields = [
            { key: "bpCode", ref: bpCodeRef },
            { key: "bpNm", ref: bpNmRef },
            { key: "ceoNm", ref: ceoNmRef },
        ];

        fields.forEach(({ key, ref }) => {
            const val = ref.current?.value.trim();
            if (val) nextParams.set(key, val);
            else nextParams.delete(key);
        });

        setSearchParams(nextParams);
    };

    const handleReset = () => {
        [bpCodeRef, bpNmRef, ceoNmRef].forEach(ref => { if(ref.current) ref.current.value = "" });
        setSearchParams({ page: "0" }, { replace: true });
    };

    const handleRowClick = (bpCode: string) => {
        navigate(`/sales/business-partner/${encodeURIComponent(bpCode)}?${searchParams.toString()}`);
    };

    const columns: ColumnDef<BusinessPartnerResponse>[] = useMemo(() => [
        { accessorKey: "bpCode", header: "거래처코드" },
        { accessorKey: "bpNm", header: "거래처명" },
        { accessorKey: "ceoNm", header: "대표자명" },
        { accessorKey: "phone", header: "연락처" },
        { 
            accessorKey: "createdAt", 
            header: "등록일시", 
            cell: ({ getValue }) => formatDateTime(getValue<string>()) 
        },
    ], []);

    return (
        <section className="screenStack">
            <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />
            <Panel
                title="거래처 관리 목록"
                action="등록"
                onAction={() => navigate(`/sales/business-partner/create?${searchParams.toString()}`)}
            >
                <div className="relative min-h-[300px]">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center"><Spinner /></div>
                    ) : (
                        <>
                            <CusTable
                                data={partners}
                                columns={columns}
                                sorting={sorting}
                                onSortingChange={handleSortingChange}
                                onRowClick={(row) => handleRowClick(row.bpCode)}
                                noDataMessage="조회된 거래처가 없습니다."
                            />
                            <CusPagination
                                page={currentPage}
                                totalPages={totalPages}
                                totalCount={totalElements}
                                onPageChange={(p) => {
                                    const next = new URLSearchParams(searchParams);
                                    next.set("page", String(p));
                                    setSearchParams(next);
                                }}
                            />
                        </>
                    )}
                </div>
            </Panel>
        </section>
    );
}