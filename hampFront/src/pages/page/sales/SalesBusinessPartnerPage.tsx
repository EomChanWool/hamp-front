import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import {
    BusinessPartnerApi,
    type BusinessPartnerResponse,
    type BusinessPartnerUpdateRequest,
    type BusinessPartnerCreateRequest,
} from "@/api/sales/BusinessPartner";
import Spinner from "@/components/common/Spinner";

export function SalesBusinessPartnerPage() {
    const [partners, setPartners] = useState<BusinessPartnerResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // 데이터 재조회를 위한 트리거 키
    const [refreshKey, setRefreshKey] = useState(0);

    // 페이지 및 검색 조건을 React State로 관리
    const [page, setPage] = useState(0);
    const [searchFilters, setSearchFilters] = useState({
        bpCode: "",
        bpNm: "",
        ceoNm: "",
    });

    const [sorting, setSorting] = useState<SortingState>([]);

    // 서버로 보낼 sort 파라미터 변환
    const sortParams = useMemo(() => {
        return sorting.map((sort) => `${sort.id},${sort.desc ? "desc" : "asc"}`);
    }, [sorting]);

    const handleSortingChange = (newSorting: SortingState) => {
        setSorting(newSorting);
        setPage(0);
        setEditingBpCode(null);
        setIsCreatingNewRow(false);
    };

    // 인라인 수정 상태 관리
    const [editingBpCode, setEditingBpCode] = useState<string | null>(null);

    // 인라인 등록 상태 관리
    const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);

    // 타이핑 시 리렌더링 방지 폼 Ref
    const editFormRef = useRef<BusinessPartnerUpdateRequest & { bpCode?: string }>({
        bpCode: "",
        bpNm: "",
        ceoNm: "",
        phone: "",
        address: "",
        managerNm: "",
        managerPhone: "",
    });

    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeletingBpCode, setIsDeletingBpCode] = useState<string | null>(null);

    // 검색 필드 Refs
    const bpCodeRef = useRef<HTMLInputElement>(null);
    const bpNmRef = useRef<HTMLInputElement>(null);
    const ceoNmRef = useRef<HTMLInputElement>(null);

    // 검색 필드 정의
    const searchFields: SearchField[] = [
        { type: "input", label: "거래처코드", ref: bpCodeRef, name: "bpCode" },
        { type: "input", label: "거래처명", ref: bpNmRef, name: "bpNm" },
        { type: "input", label: "대표자명", ref: ceoNmRef, name: "ceoNm" },
    ];

    // 거래처 목록 조회
    const loadPartners = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: Record<string, any> = {
                page,
                size: 10,
            };
            if (searchFilters.bpCode) params.bpCode = searchFilters.bpCode;
            if (searchFilters.bpNm) params.bpNm = searchFilters.bpNm;
            if (searchFilters.ceoNm) params.ceoNm = searchFilters.ceoNm;

            if (sortParams.length > 0) {
                params.sort = sortParams;
            }

            const response = await BusinessPartnerApi.getList(params);

            const pageData = response.data;
            setPartners(pageData?.content ?? []);
            setTotalElements(pageData?.totalElements ?? 0);
            setTotalPages(pageData?.totalPages ?? 0);
        } catch (error) {
            console.error("거래처 목록 조회 실패:", error);
            window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, [page, searchFilters, sortParams, refreshKey]);

    useEffect(() => {
        loadPartners();
    }, [loadPartners]);

    const handleSearch = () => {
        setPage(0);
        setSearchFilters({
            bpCode: bpCodeRef.current?.value.trim() || "",
            bpNm: bpNmRef.current?.value.trim() || "",
            ceoNm: ceoNmRef.current?.value.trim() || "",
        });
        setEditingBpCode(null);
        setIsCreatingNewRow(false);
    };

    const handleReset = () => {
        if (bpCodeRef.current) bpCodeRef.current.value = "";
        if (bpNmRef.current) bpNmRef.current.value = "";
        if (ceoNmRef.current) ceoNmRef.current.value = "";

        setPage(0);
        setSearchFilters({
            bpCode: "",
            bpNm: "",
            ceoNm: "",
        });
        setSorting([]);
        setEditingBpCode(null);
        setIsCreatingNewRow(false);
    };

    const handlePageChange = (newPage: number) => {
        setEditingBpCode(null);
        setIsCreatingNewRow(false);
        setPage(newPage);
    };

    const handleStartCreate = () => {
        if (isCreatingNewRow) return;
        setEditingBpCode(null);
        editFormRef.current = {
            bpCode: "",
            bpNm: "",
            ceoNm: "",
            phone: "",
            address: "",
            managerNm: "",
            managerPhone: "",
        };
        setIsCreatingNewRow(true);
    };

    const handleCancelCreate = () => {
        setIsCreatingNewRow(false);
    };

    // 인라인 신규 등록 API 저장
    const handleSaveCreate = async () => {
        if (isUpdating) return;

        const newBpCode = editFormRef.current.bpCode?.trim();
        if (!newBpCode) {
            window.alert("거래처 코드를 입력해주세요.");
            return;
        }

        setIsUpdating(true);
        try {
            const payload: BusinessPartnerCreateRequest = {
                bpCode: newBpCode,
                bpNm: editFormRef.current.bpNm?.trim() || null,
                ceoNm: editFormRef.current.ceoNm?.trim() || null,
                phone: editFormRef.current.phone?.trim() || null,
                address: editFormRef.current.address?.trim() || null,
                managerNm: editFormRef.current.managerNm?.trim() || null,
                managerPhone: editFormRef.current.managerPhone?.trim() || null,
            };

            const response = await BusinessPartnerApi.create(payload);

            window.alert(response?.message || "등록되었습니다.");
            setIsCreatingNewRow(false);

            if (bpCodeRef.current) bpCodeRef.current.value = "";
            if (bpNmRef.current) bpNmRef.current.value = "";
            if (ceoNmRef.current) ceoNmRef.current.value = "";

            setPage(0);
            setSearchFilters({
                bpCode: "",
                bpNm: "",
                ceoNm: "",
            });
            setSorting([]);
            setRefreshKey((prev) => prev + 1);
        } catch (err) {
            console.error("등록 실패:", err);
            const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
            window.alert(errorMessage || "등록에 실패했습니다.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleStartEdit = (row: BusinessPartnerResponse) => {
        setIsCreatingNewRow(false);
        editFormRef.current = {
            bpNm: row.bpNm ?? "",
            ceoNm: row.ceoNm ?? "",
            phone: row.phone ?? "",
            address: row.address ?? "",
            managerNm: row.managerNm ?? "",
            managerPhone: row.managerPhone ?? "",
        };
        setEditingBpCode(row.bpCode);
    };

    const handleCancelEdit = () => {
        setEditingBpCode(null);
        editFormRef.current = { bpNm: "", ceoNm: "", phone: "", address: "", managerNm: "", managerPhone: "" };
    };

    // 인라인 수정 저장
    const handleSaveEdit = async (bpCode: string) => {
        if (isUpdating) return;

        setIsUpdating(true);
        try {
            const updatePayload: BusinessPartnerUpdateRequest = {
                bpNm: editFormRef.current.bpNm?.trim() ? editFormRef.current.bpNm.trim() : null,
                ceoNm: editFormRef.current.ceoNm?.trim() ? editFormRef.current.ceoNm.trim() : null,
                phone: editFormRef.current.phone?.trim() ? editFormRef.current.phone.trim() : null,
                address: editFormRef.current.address?.trim() ? editFormRef.current.address.trim() : null,
                managerNm: editFormRef.current.managerNm?.trim() ? editFormRef.current.managerNm.trim() : null,
                managerPhone: editFormRef.current.managerPhone?.trim() ? editFormRef.current.managerPhone.trim() : null,
            };

            const response = await BusinessPartnerApi.update(bpCode, updatePayload);

            window.alert(response?.message || "수정되었습니다.");
            setEditingBpCode(null);
            setRefreshKey((prev) => prev + 1);
        } catch (err) {
            console.error("수정 실패:", err);
            const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
            window.alert(errorMessage || "수정에 실패했습니다.");
        } finally {
            setIsUpdating(false);
        }
    };

    // 행 삭제
    const handleDeletePartner = async (row: BusinessPartnerResponse) => {
        if (isDeletingBpCode) return;

        const confirmed = window.confirm(
            `[${row.bpCode}] ${row.bpNm || ""} 거래처를 삭제하시겠습니까?`
        );
        if (!confirmed) return;

        setIsDeletingBpCode(row.bpCode);
        try {
            await BusinessPartnerApi.delete(row.bpCode);

            window.alert("거래처가 삭제되었습니다.");
            setRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error("거래처 삭제 실패:", error);
            const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
            window.alert(message || "거래처 삭제에 실패했습니다.");
        } finally {
            setIsDeletingBpCode(null);
        }
    };

    const columns: ColumnDef<BusinessPartnerResponse>[] = useMemo(
        () => [
            {
                accessorKey: "bpCode",
                header: "거래처코드",
                cell: ({ row }) => {
                    if (row.original.bpCode === "__NEW_ROW__") {
                        return (
                            <input
                                className="tableInput"
                                defaultValue={editFormRef.current.bpCode ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.bpCode = e.target.value;
                                }}
                                placeholder="거래처코드 입력"
                                autoFocus
                            />
                        );
                    }
                    return row.original.bpCode;
                },
            },
            {
                accessorKey: "bpNm",
                header: "거래처명",
                cell: ({ row }) => {
                    const isNewRow = row.original.bpCode === "__NEW_ROW__";
                    const isEditing = row.original.bpCode === editingBpCode;

                    if (isNewRow || isEditing) {
                        return (
                            <input
                                className="tableInput"
                                defaultValue={editFormRef.current.bpNm ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.bpNm = e.target.value;
                                }}
                                placeholder="거래처명 입력"
                            />
                        );
                    }
                    return row.original.bpNm || "-";
                },
            },
            {
                accessorKey: "ceoNm",
                header: "대표자명",
                cell: ({ row }) => {
                    const isNewRow = row.original.bpCode === "__NEW_ROW__";
                    const isEditing = row.original.bpCode === editingBpCode;

                    if (isNewRow || isEditing) {
                        return (
                            <input
                                className="tableInput"
                                defaultValue={editFormRef.current.ceoNm ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.ceoNm = e.target.value;
                                }}
                                placeholder="대표자명 입력"
                            />
                        );
                    }
                    return row.original.ceoNm || "-";
                },
            },
            {
                accessorKey: "phone",
                header: "전화번호",
                cell: ({ row }) => {
                    const isNewRow = row.original.bpCode === "__NEW_ROW__";
                    const isEditing = row.original.bpCode === editingBpCode;

                    if (isNewRow || isEditing) {
                        return (
                            <input
                                className="tableInput"
                                defaultValue={editFormRef.current.phone ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.phone = e.target.value;
                                }}
                                placeholder="전화번호 입력"
                            />
                        );
                    }
                    return row.original.phone || "-";
                },
            },
            {
                accessorKey: "address",
                header: "주소",
                cell: ({ row }) => {
                    const isNewRow = row.original.bpCode === "__NEW_ROW__";
                    const isEditing = row.original.bpCode === editingBpCode;

                    if (isNewRow || isEditing) {
                        return (
                            <input
                                className="tableInput"
                                defaultValue={editFormRef.current.address ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.address = e.target.value;
                                }}
                                placeholder="주소 입력"
                            />
                        );
                    }
                    return row.original.address || "-";
                },
            },
            {
                accessorKey: "managerNm",
                header: "담당자명",
                cell: ({ row }) => {
                    const isNewRow = row.original.bpCode === "__NEW_ROW__";
                    const isEditing = row.original.bpCode === editingBpCode;

                    if (isNewRow || isEditing) {
                        return (
                            <input
                                className="tableInput"
                                defaultValue={editFormRef.current.managerNm ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.managerNm = e.target.value;
                                }}
                                placeholder="담당자명 입력"
                            />
                        );
                    }
                    return row.original.managerNm || "-";
                },
            },
            {
                accessorKey: "managerPhone",
                header: "담당자 연락처",
                cell: ({ row }) => {
                    const isNewRow = row.original.bpCode === "__NEW_ROW__";
                    const isEditing = row.original.bpCode === editingBpCode;

                    if (isNewRow || isEditing) {
                        return (
                            <input
                                className="tableInput"
                                defaultValue={editFormRef.current.managerPhone ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.managerPhone = e.target.value;
                                }}
                                placeholder="담당자 연락처 입력"
                            />
                        );
                    }
                    return row.original.managerPhone || "-";
                },
            },
            {
                accessorKey: "createdAt",
                header: "등록일자",
                cell: ({ row, getValue }) => {
                    if (row.original.bpCode === "__NEW_ROW__") return "-";
                    return formatDateTime(getValue<string>());
                },
            },
            {
                id: "actions",
                header: "관리",
                meta: { width: "130px" },
                cell: ({ row }) => {
                    const isNewRow = row.original.bpCode === "__NEW_ROW__";
                    const isEditing = row.original.bpCode === editingBpCode;
                    const isDeleting = isDeletingBpCode === row.original.bpCode;

                    if (isNewRow) {
                        return (
                            <div className="rowActions" style={{ display: "flex", gap: "4px" }}>
                                <button
                                    type="button"
                                    className="miniButton primary"
                                    disabled={isUpdating}
                                    onClick={handleSaveCreate}
                                >
                                    {isUpdating ? "저장 중" : "저장"}
                                </button>
                                <button
                                    type="button"
                                    className="miniButton danger"
                                    disabled={isUpdating}
                                    onClick={handleCancelCreate}
                                >
                                    취소
                                </button>
                            </div>
                        );
                    }

                    if (isEditing) {
                        return (
                            <div className="rowActions" style={{ display: "flex", gap: "4px" }}>
                                <button
                                    type="button"
                                    className="miniButton primary"
                                    disabled={isUpdating}
                                    onClick={() => handleSaveEdit(row.original.bpCode)}
                                >
                                    {isUpdating ? "저장 중" : "저장"}
                                </button>
                                <button
                                    type="button"
                                    className="miniButton danger"
                                    disabled={isUpdating}
                                    onClick={handleCancelEdit}
                                >
                                    취소
                                </button>
                            </div>
                        );
                    }

                    return (
                        <div className="rowActions" style={{ display: "flex", gap: "4px" }}>
                            <button
                                type="button"
                                className="miniButton"
                                disabled={editingBpCode !== null || isCreatingNewRow || isDeleting}
                                onClick={() => handleStartEdit(row.original)}
                            >
                                수정
                            </button>
                            <button
                                type="button"
                                className="miniButton danger"
                                disabled={editingBpCode !== null || isCreatingNewRow || isDeleting}
                                onClick={() => handleDeletePartner(row.original)}
                            >
                                {isDeleting ? "삭제 중" : "삭제"}
                            </button>
                        </div>
                    );
                },
            },
        ],
        [editingBpCode, isCreatingNewRow, isUpdating, isDeletingBpCode]
    );

    const displayPartners = useMemo(() => {
        if (isCreatingNewRow) {
            const dummyNewRow: BusinessPartnerResponse = {
                bpCode: "__NEW_ROW__",
                bpNm: "",
                ceoNm: "",
                phone: "",
                address: "",
                managerNm: "",
                managerPhone: "",
                createdAt: "",
                updatedAt: "",
            };
            return [dummyNewRow, ...partners];
        }
        return partners;
    }, [isCreatingNewRow, partners]);

    return (
        <section className="screenStack">
            <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

            <Panel title="거래처 관리 목록" action="등록" onAction={handleStartCreate}>
                <div className="relative min-h-[300px]">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Spinner />
                        </div>
                    ) : (
                        <>
                            <CusTable
                                data={displayPartners}
                                columns={columns}
                                sorting={sorting}
                                onSortingChange={handleSortingChange}
                                noDataMessage="조회된 데이터가 없습니다."
                            />
                            <CusPagination
                                page={page}
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