import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import type {
    OperationResponse,
    OperationUpdateRequest,
    OperationOptionResponse,
    OperationCreateRequest,
} from "@/api/master/Operation";
import { OperationApi } from "@/api/master/Operation";
import Spinner from "@/components/common/Spinner";
import { DepartmentApi, type DepartmentOptionResponse } from "@/api/master/Department";

export function MasterOperationPage() {
    const [operations, setOperations] = useState<OperationResponse[]>([]);
    const [operationOptions, setOperationOptions] = useState<OperationOptionResponse[]>([]);
    const [departmentOptions, setDepartmentOptions] = useState<DepartmentOptionResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // 데이터 재조회를 위한 트리거 키
    const [refreshKey, setRefreshKey] = useState(0);

    // 페이지 및 검색 조건을 React State로 관리
    const [page, setPage] = useState(0);
    const [searchFilters, setSearchFilters] = useState({
        operCode: "",
        depCode: "",
        operNm: "",
        useYn: "",
        stdTime: "",
    });

    const [sorting, setSorting] = useState<SortingState>([]);

    // 서버로 보낼 sort 파라미터 변환
    const sortParams = useMemo(() => {
        return sorting.map((sort) => `${sort.id},${sort.desc ? "desc" : "asc"}`);
    }, [sorting]);

    const handleSortingChange = (newSorting: SortingState) => {
        setSorting(newSorting);
        setPage(0);
        setEditingOperCode(null);
        setIsCreatingNewRow(false);
    };

    // 인라인 수정 상태 관리
    const [editingOperCode, setEditingOperCode] = useState<string | null>(null);

    // 인라인 등록 상태 관리
    const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);

    // 타이핑 시 리렌더링 방지 폼 Ref
    const editFormRef = useRef<{
        operCode?: string;
        depCode?: string;
        operNm?: string;
        stdTime?: string;
    }>({
        operCode: "",
        depCode: "",
        operNm: "",
        stdTime: "",
    });

    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeletingOperCode, setIsDeletingOperCode] = useState<string | null>(null);

    // 검색 필드 Refs
    const operCodeRef = useRef<HTMLSelectElement>(null);
    const depCodeRef = useRef<HTMLSelectElement>(null);
    const operNmRef = useRef<HTMLInputElement>(null);
    const useYnRef = useRef<HTMLSelectElement>(null);
    const stdTimeRef = useRef<HTMLInputElement>(null);

    // 옵션 목록을 한 번에 불러오는 함수
    const fetchOptions = useCallback(async () => {
        try {
            const [opRes, deptRes] = await Promise.all([
                OperationApi.getOptions(),
                DepartmentApi.getOptions(),
            ]);
            setOperationOptions(opRes.data ?? []);
            setDepartmentOptions(deptRes.data ?? []);
        } catch (error) {
            console.error("옵션 목록 조회 실패:", error);
        }
    }, []);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    // 검색 밴드 구성
    const searchFields: SearchField[] = [
        {
            type: "select",
            label: "공정코드",
            ref: operCodeRef as any,
            options: [
                { label: "전체", value: "" },
                ...operationOptions.map((opt) => ({
                    label: `${opt.operCode} (${opt.operNm ?? '-'})`,
                    value: opt.operCode,
                })),
            ],
        },
        {
            type: "select",
            label: "부서코드",
            ref: depCodeRef as any,
            options: [
                { label: "전체", value: "" },
                ...departmentOptions.map((opt) => ({
                    label: `${opt.depCode} (${opt.taskDesc ?? '-'})`,
                    value: opt.depCode,
                })),
            ],
        },
        { type: "input", label: "공정명", ref: operNmRef, name: "operNm" },
        {
            type: "select",
            label: "사용여부",
            ref: useYnRef as any,
            options: [
                { label: "전체", value: "" },
                { label: "사용", value: "Y" },
                { label: "미사용", value: "N" },
            ],
        },
        { type: "single-date", label: "표준시간", ref: stdTimeRef as any },
    ];

    // 공정 목록 조회
    const loadOperations = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: Record<string, any> = {
                page,
                size: 10,
            };
            if (searchFilters.operCode) params.operCode = searchFilters.operCode;
            if (searchFilters.depCode) params.depCode = searchFilters.depCode;
            if (searchFilters.operNm) params.operNm = searchFilters.operNm;
            if (searchFilters.useYn) params.useYn = searchFilters.useYn;
            if (searchFilters.stdTime) params.stdTime = searchFilters.stdTime;

            if (sortParams.length > 0) {
                params.sort = sortParams;
            }

            const response = await OperationApi.getList(params);

            const pageData = response.data;
            setOperations(pageData?.content ?? []);
            setTotalElements(pageData?.totalElements ?? 0);
            setTotalPages(pageData?.totalPages ?? 0);
        } catch (error) {
            console.error("공정 목록 조회 실패:", error);
            window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, [page, searchFilters, sortParams, refreshKey]);

    useEffect(() => {
        loadOperations();
    }, [loadOperations]);

    const handleSearch = () => {
        setPage(0);
        setSearchFilters({
            operCode: operCodeRef.current?.value.trim() || "",
            depCode: depCodeRef.current?.value.trim() || "",
            operNm: operNmRef.current?.value.trim() || "",
            useYn: useYnRef.current?.value.trim() || "",
            stdTime: stdTimeRef.current?.value.trim() || "",
        });
        setEditingOperCode(null);
        setIsCreatingNewRow(false);
    };

    const handleReset = () => {
        if (operCodeRef.current) operCodeRef.current.value = "";
        if (depCodeRef.current) depCodeRef.current.value = "";
        if (operNmRef.current) operNmRef.current.value = "";
        if (useYnRef.current) useYnRef.current.value = "";
        if (stdTimeRef.current) stdTimeRef.current.value = "";

        setPage(0);
        setSearchFilters({
            operCode: "",
            depCode: "",
            operNm: "",
            useYn: "",
            stdTime: "",
        });
        setSorting([]);
        setEditingOperCode(null);
        setIsCreatingNewRow(false);
    };

    const handlePageChange = (newPage: number) => {
        setEditingOperCode(null);
        setIsCreatingNewRow(false);
        setPage(newPage);
    };

    const handleStartCreate = () => {
        if (isCreatingNewRow) return;
        setEditingOperCode(null);
        editFormRef.current = {
            operCode: "",
            depCode: "",
            operNm: "",
            stdTime: "",
        };
        setIsCreatingNewRow(true);
    };

    const handleCancelCreate = () => {
        setIsCreatingNewRow(false);
    };

    // 인라인 신규 등록 API 저장
    const handleSaveCreate = async () => {
        if (isUpdating) return;

        const newOperCode = editFormRef.current.operCode?.trim();
        if (!newOperCode) {
            window.alert("공정코드를 입력해주세요.");
            return;
        }

        setIsUpdating(true);
        try {
            const payload: OperationCreateRequest = {
                operCode: newOperCode,
                depCode: editFormRef.current.depCode?.trim() ?? "",
                operNm: editFormRef.current.operNm?.trim() ?? "",
                stdTime: editFormRef.current.stdTime?.toString().trim() ?? "",
            };

            const response = await OperationApi.create(payload);

            window.alert(response.message || "등록되었습니다.");
            setIsCreatingNewRow(false);

            if (operCodeRef.current) operCodeRef.current.value = "";
            if (depCodeRef.current) depCodeRef.current.value = "";
            if (operNmRef.current) operNmRef.current.value = "";
            if (useYnRef.current) useYnRef.current.value = "";
            if (stdTimeRef.current) stdTimeRef.current.value = "";

            setPage(0);
            setSearchFilters({
                operCode: "",
                depCode: "",
                operNm: "",
                useYn: "",
                stdTime: "",
            });
            setSorting([]);
            setRefreshKey((prev) => prev + 1);
            await fetchOptions();
        } catch (err) {
            console.error("등록 실패:", err);
            const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
            window.alert(errorMessage || "등록에 실패했습니다.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleStartEdit = (row: OperationResponse) => {
        setIsCreatingNewRow(false);
        editFormRef.current = {
            depCode: row.depCode ?? "",
            operNm: row.operNm ?? "",
            stdTime: row.stdTime?.toString() ?? "",
        };
        setEditingOperCode(row.operCode);
    };

    const handleCancelEdit = () => {
        setEditingOperCode(null);
        editFormRef.current = { depCode: "", operNm: "", stdTime: "" };
    };

    // 인라인 수정 저장
    const handleSaveEdit = async (operCode: string) => {
        if (isUpdating) return;

        setIsUpdating(true);
        try {
            const updatePayload: OperationUpdateRequest = {
                depCode: editFormRef.current.depCode?.trim() ? editFormRef.current.depCode.trim() : "",
                operNm: editFormRef.current.operNm?.trim() ? editFormRef.current.operNm.trim() : "",
                stdTime: editFormRef.current.stdTime?.toString().trim() ? editFormRef.current.stdTime.toString().trim() : "",
            };

            const response = await OperationApi.update(operCode, updatePayload);

            window.alert(response.message || "수정되었습니다.");
            setEditingOperCode(null);
            setRefreshKey((prev) => prev + 1);
            await fetchOptions();
        } catch (err) {
            console.error("수정 실패:", err);
            const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
            window.alert(errorMessage || "수정에 실패했습니다.");
        } finally {
            setIsUpdating(false);
        }
    };

    // 행 삭제
    const handleDeleteOperation = async (row: OperationResponse) => {
        if (isDeletingOperCode || row.useYn !== "Y") return;

        const confirmed = window.confirm(`[${row.operCode}] ${row.operNm || ""} 공정을 삭제(비활성화)하시겠습니까?`);
        if (!confirmed) return;

        setIsDeletingOperCode(row.operCode);
        try {
            await OperationApi.delete(row.operCode);

            window.alert("공정이 삭제(비활성화)되었습니다.");
            setRefreshKey((prev) => prev + 1);
            await fetchOptions();
        } catch (error) {
            console.error("공정 삭제 실패:", error);
            const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
            window.alert(message || "공정 삭제에 실패했습니다.");
        } finally {
            setIsDeletingOperCode(null);
        }
    };

    const columns: ColumnDef<OperationResponse>[] = useMemo(
        () => [
            {
                accessorKey: "operCode",
                header: "공정코드",
                cell: ({ row }) => {
                    if (row.original.operCode === "__NEW_ROW__") {
                        return (
                            <input
                                className="tableInput"
                                defaultValue={editFormRef.current.operCode ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.operCode = e.target.value;
                                }}
                                placeholder="공정코드 입력"
                                autoFocus
                            />
                        );
                    }
                    return row.original.operCode;
                },
            },
            {
                accessorKey: "depCode",
                header: "부서코드",
                cell: ({ row }) => {
                    const isNewRow = row.original.operCode === "__NEW_ROW__";
                    const isEditing = row.original.operCode === editingOperCode;

                    if (isNewRow || isEditing) {
                        return (
                            <select
                                className="tableInput"
                                defaultValue={editFormRef.current.depCode ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.depCode = e.target.value;
                                }}
                            >
                                <option value="">부서 선택</option>
                                {departmentOptions.map((opt) => (
                                    <option key={opt.depCode} value={opt.depCode}>
                                        {opt.depCode} ({opt.taskDesc ?? "-"})
                                    </option>
                                ))}
                            </select>
                        );
                    }
                    return row.original.depCode || "-";
                },
            },
            {
                accessorKey: "operNm",
                header: "공정명",
                cell: ({ row }) => {
                    const isNewRow = row.original.operCode === "__NEW_ROW__";
                    const isEditing = row.original.operCode === editingOperCode;

                    if (isNewRow || isEditing) {
                        return (
                            <input
                                className="tableInput"
                                defaultValue={editFormRef.current.operNm ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.operNm = e.target.value;
                                }}
                                placeholder="공정명 입력"
                            />
                        );
                    }
                    return row.original.operNm || "-";
                },
            },
            {
                accessorKey: "stdTime",
                header: "표준시간",
                cell: ({ row }) => {
                    const isNewRow = row.original.operCode === "__NEW_ROW__";
                    const isEditing = row.original.operCode === editingOperCode;

                    if (isNewRow || isEditing) {
                        return (
                            <input
                                className="tableInput"
                                type="text"
                                defaultValue={editFormRef.current.stdTime?.toString() ?? ""}
                                onChange={(e) => {
                                    editFormRef.current.stdTime = e.target.value;
                                }}
                                placeholder="표준시간 입력"
                            />
                        );
                    }
                    return row.original.stdTime || "-";
                },
            },
            {
                accessorKey: "useYn",
                header: "사용여부",
                cell: ({ row, getValue }) => {
                    if (row.original.operCode === "__NEW_ROW__") {
                        return <Badge tone="good">사용</Badge>;
                    }
                    const isUse = getValue<string>() === "Y";
                    return (
                        <Badge tone={isUse ? "good" : "muted"}>
                            {isUse ? "사용" : "미사용"}
                        </Badge>
                    );
                },
            },
            {
                accessorKey: "createdAt",
                header: "등록일자",
                cell: ({ row, getValue }) => {
                    if (row.original.operCode === "__NEW_ROW__") return "-";
                    return formatDateTime(getValue<string>());
                },
            },
            {
                id: "actions",
                header: "관리",
                meta: { width: "130px" },
                cell: ({ row }) => {
                    const isNewRow = row.original.operCode === "__NEW_ROW__";
                    const isEditing = row.original.operCode === editingOperCode;
                    const isDeleting = isDeletingOperCode === row.original.operCode;
                    const isUsed = row.original.useYn === "Y";

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
                                    onClick={() => handleSaveEdit(row.original.operCode)}
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
                                disabled={editingOperCode !== null || isCreatingNewRow || isDeleting}
                                onClick={() => handleStartEdit(row.original)}
                            >
                                수정
                            </button>
                            <button
                                type="button"
                                className="miniButton danger"
                                disabled={editingOperCode !== null || isCreatingNewRow || isDeleting || !isUsed}
                                onClick={() => handleDeleteOperation(row.original)}
                            >
                                {isDeleting ? "삭제 중" : "삭제"}
                            </button>
                        </div>
                    );
                },
            },
        ],
        [editingOperCode, isCreatingNewRow, isUpdating, isDeletingOperCode, departmentOptions]
    );

    const displayOperations = useMemo(() => {
        if (isCreatingNewRow) {
            const dummyNewRow: OperationResponse = {
                operCode: "__NEW_ROW__",
                depCode: "",
                operNm: "",
                stdTime: "",
                useYn: "Y",
                createdAt: "",
                updatedAt: "",
            };
            return [dummyNewRow, ...operations];
        }
        return operations;
    }, [isCreatingNewRow, operations]);

    return (
        <section className="screenStack">
            <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

            <Panel title="공정 관리 목록" action="등록" onAction={handleStartCreate}>
                <div className="relative min-h-[300px]">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Spinner />
                        </div>
                    ) : (
                        <>
                            <CusTable
                                data={displayOperations}
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