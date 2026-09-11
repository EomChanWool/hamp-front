import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { Panel } from '@components/card/Panel';
import { SearchBand, type SearchField } from '@components/search/SearchBand';
import { CusTable } from '@components/table/CusTable';
import { CusPagination } from '@components/table/CusPagination';
import Spinner from '@/components/common/Spinner';
import { formatDateTime } from '@/utils/common';
import axios from 'axios';
import {
    StockHistoryApi,
    type StockHistoryResponse,
    type StockAdjustmentRequest,
} from '@/api/seed/StockHistory';
import { ItemApi, type ItemOptionResponse } from '@/api/master/Item';
import { 
    PencilIcon,
    ArrowPathIcon,
    PlayIcon 
} from "@heroicons/react/16/solid";

export function SeedInventoryManagePage() {
    const [historyList, setHistoryList] = useState<StockHistoryResponse[]>([]);
    const [itemOptions, setItemOptions] = useState<ItemOptionResponse[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const [refreshKey, setRefreshKey] = useState(0);
    const [page, setPage] = useState(0);

    const [selectedDirection, setSelectedDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');

    const [searchFilters, setSearchFilters] = useState({
        category: '',
        itemCode: '',
        ioType: '',
    });

    const [sorting, setSorting] = useState<SortingState>([]);

    const sortParams = useMemo(() => {
        return sorting.map((sort) => `${sort.id},${sort.desc ? 'desc' : 'asc'}`);
    }, [sorting]);

    const handleSortingChange = (newSorting: SortingState) => {
        setSorting(newSorting);
        setPage(0);
        setEditingId(null);
        setIsCreatingNewRow(false);
    };

    const [editingId, setEditingId] = useState<number | null>(null);
    const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);

    const editFormRef = useRef<{
        itemCode?: string;
        direction?: 'INCREASE' | 'DECREASE';
        qty?: number;
        note?: string;
    }>({
        itemCode: '',
        direction: 'INCREASE',
        qty: 1,
        note: '',
    });

    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

    const categoryRef = useRef<HTMLSelectElement>(null);
    const itemCodeRef = useRef<HTMLSelectElement>(null);
    const ioTypeRef = useRef<HTMLSelectElement>(null);

    const fetchItemOptions = useCallback(async () => {
        try {
            const res = await ItemApi.getOptions({ productType: 0 });
            setItemOptions(res.data ?? []);
        } catch (error) {
            console.error('품목 옵션 조회 실패:', error);
        }
    }, []);

    useEffect(() => {
        fetchItemOptions();
    }, [fetchItemOptions]);

    const searchFields: SearchField[] = useMemo(
        () => [
            {
                type: 'select',
                label: '구분',
                ref: categoryRef,
                name: 'category',
                options: [
                    { label: '전체', value: '' },
                    { label: '원료', value: '0' },
                    { label: '반제품', value: '1' },
                    { label: '완제품', value: '2' },
                ],
            },
            {
                type: 'select',
                label: '품목코드',
                ref: itemCodeRef,
                name: 'itemCode',
                options: [
                    { label: '전체', value: '' },
                    ...itemOptions.map((opt) => ({
                        label: `${opt.itemCode} (${opt.itemNm ?? '-'})`,
                        value: opt.itemCode,
                    })),
                ],
            },
            {
                type: 'select',
                label: '처리구분',
                ref: ioTypeRef,
                name: 'ioType',
                options: [
                    { label: '전체', value: '' },
                    { label: '신고입고', value: '신고입고' },
                    { label: '신고입고취소', value: '신고입고취소' },
                    { label: '조정', value: '조정' },
                ],
            },
        ],
        [itemOptions]
    );

    const loadHistories = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: Record<string, any> = {
                page,
                size: 10,
            };
            if (searchFilters.category !== '') params.category = Number(searchFilters.category);
            if (searchFilters.itemCode) params.itemCode = searchFilters.itemCode;
            if (searchFilters.ioType) params.ioType = searchFilters.ioType;

            if (sortParams.length > 0) {
                params.sort = sortParams;
            }

            const response = await StockHistoryApi.getList(params);
            const pageData = response.data;

            setHistoryList(pageData?.content ?? []);
            setTotalElements(pageData?.totalElements ?? 0);
            setTotalPages(pageData?.totalPages ?? 0);
        } catch (error) {
            console.error('재고이력 목록 조회 실패:', error);
            window.alert('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [page, searchFilters, sortParams, refreshKey]);

    useEffect(() => {
        loadHistories();
    }, [loadHistories]);

    const handleSearch = () => {
        setPage(0);
        setSearchFilters({
            category: categoryRef.current?.value || '',
            itemCode: itemCodeRef.current?.value.trim() || '',
            ioType: ioTypeRef.current?.value || '',
        });
        setEditingId(null);
        setIsCreatingNewRow(false);
    };

    const handleReset = () => {
        if (categoryRef.current) categoryRef.current.value = '';
        if (itemCodeRef.current) itemCodeRef.current.value = '';
        if (ioTypeRef.current) ioTypeRef.current.value = '';

        setPage(0);
        setSearchFilters({ category: '', itemCode: '', ioType: '' });
        setSorting([]);
        setEditingId(null);
        setIsCreatingNewRow(false);
    };

    const handlePageChange = (newPage: number) => {
        setEditingId(null);
        setIsCreatingNewRow(false);
        setPage(newPage);
    };

    const handleStartCreate = () => {
        if (isCreatingNewRow) return;
        setEditingId(null);
        editFormRef.current = {
            itemCode: '',
            direction: 'INCREASE',
            qty: 1,
            note: '',
        };
        setSelectedDirection('INCREASE');
        setIsCreatingNewRow(true);
    };

    const handleCancelCreate = () => {
        setIsCreatingNewRow(false);
    };

    const handleSaveCreate = async () => {
        if (isUpdating) return;

        const itemCode = editFormRef.current.itemCode?.trim();
        if (!itemCode) {
            window.alert('품목을 선택해주세요.');
            return;
        }

        const qty = Number(editFormRef.current.qty);
        if (!qty || qty <= 0) {
            window.alert('조정 수량은 0보다 커야 합니다.');
            return;
        }

        setIsUpdating(true);
        try {
            const payload: StockAdjustmentRequest = {
                itemCode,
                direction: editFormRef.current.direction ?? 'INCREASE',
                qty,
                note: editFormRef.current.note || null,
            };

            await StockHistoryApi.adjust(payload);
            window.alert('재고 조정이 등록되었습니다.');
            setIsCreatingNewRow(false);
            setPage(0);
            setRefreshKey((prev) => prev + 1);
        } catch (err) {
            console.error('등록 실패:', err);
            const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
            window.alert(errorMessage || '등록에 실패했습니다.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleStartEdit = (row: StockHistoryResponse) => {
        if (row.ioType !== '조정') {
            window.alert('신고입고 및 신고입고취소 내역은 수정할 수 없습니다. (조정 건만 수정 가능)');
            return;
        }
        setIsCreatingNewRow(false);
        const direction = row.increaseQty > 0 ? 'INCREASE' : 'DECREASE';
        editFormRef.current = {
            itemCode: row.itemCode ?? '',
            direction,
            qty: row.increaseQty > 0 ? row.increaseQty : row.decreaseQty,
            note: row.note ?? '',
        };
        setSelectedDirection(direction);
        setEditingId(row.sthiId);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    const handleSaveEdit = async (_sthiId: number) => {
        if (isUpdating) return;
        window.alert(`[목업] sthiId: ${_sthiId} 수정 API 연동 대기 중입니다.`);
        setEditingId(null);
    };

    const handleDelete = async (row: StockHistoryResponse) => {
        if (row.ioType !== '조정') {
            window.alert('조정 건만 삭제할 수 있습니다.');
            return;
        }
        if (isDeletingId) return;

        const confirmed = window.confirm(`[${row.itemNm}] 해당 재고이력 항목을 삭제하시겠습니까?`);
        if (!confirmed) return;

        setIsDeletingId(row.sthiId);
        try {
            window.alert(`[목업] sthiId: ${row.sthiId} 삭제 API 연동 대기 중입니다.`);
            setRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('삭제 실패:', error);
            window.alert('삭제에 실패했습니다.');
        } finally {
            setIsDeletingId(null);
        }
    };

    const columns: ColumnDef<StockHistoryResponse>[] = useMemo(
        () => [
            {
                accessorKey: 'processedDate',
                header: '처리일자',
                meta: { width: '130px' },
                cell: ({ row }) => {
                    const isNew = row.original.sthiId === -999999;
                    if (isNew) return '-';
                    return row.original.processedDate ? row.original.processedDate.slice(0, 10) : '-';
                },
            },
            {
                accessorKey: 'itemCode',
                header: '품목코드',
                meta: { width: '220px' },
                cell: ({ row }) => {
                    const isNew = row.original.sthiId === -999999;
                    const isEditing = row.original.sthiId === editingId;

                    if (isNew || isEditing) {
                        return (
                            <select
                                className="tableInput"
                                defaultValue={editFormRef.current.itemCode}
                                onChange={(e) => {
                                    editFormRef.current.itemCode = e.target.value;
                                }}
                            >
                                <option value="" disabled>품목 선택</option>
                                {itemOptions.map((opt) => (
                                    <option key={opt.itemCode} value={opt.itemCode}>
                                        {opt.itemNm ?? '-'} ({opt.itemCode})
                                    </option>
                                ))}
                            </select>
                        );
                    }

                    const categoryLabel = row.original.category === 0 ? '원료' : row.original.category === 1 ? '반제품' : '완제품';
                    return (
                        <div className="itemCell">
                            <span className="itemCell__name">{row.original.itemNm} ({categoryLabel})</span>
                            <span className="itemCell__code">{row.original.itemCode}</span>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'ioType',
                header: '처리구분',
                meta: { width: '150px' },
                cell: ({ row }) => {
                    const isNew = row.original.sthiId === -999999;
                    const isEditing = row.original.sthiId === editingId;

                    if (isNew || isEditing) {
                        return (
                            <select
                                className="tableInput"
                                defaultValue={editFormRef.current.direction}
                                onChange={(e) => {
                                    const dir = e.target.value as 'INCREASE' | 'DECREASE';
                                    editFormRef.current.direction = dir;
                                    setSelectedDirection(dir);
                                }}
                            >
                                <option value="INCREASE">증가 (조정)</option>
                                <option value="DECREASE">감소 (조정)</option>
                            </select>
                        );
                    }

                    const ioType = row.original.ioType;
                    
                    let badgeClass = 'badge info';
                    let iconNode = null;

                    if (ioType === '조정') {
                        badgeClass = 'badge warn';
                        iconNode = <PencilIcon className="w-3.5 h-3.5 inline-block mr-1" />;
                    } else if (ioType === '신고입고취소') {
                        badgeClass = 'badge muted';
                        // 신고입고취소 아이콘 (회전 화살표)
                        iconNode = <ArrowPathIcon className="w-3.5 h-3.5 inline-block mr-1" />;
                    } else {
                        // 신고입고 아이콘 (상향 삼각형 모양을 위해 PlayIcon을 위로 회전)
                        badgeClass = 'badge info';
                        iconNode = <PlayIcon className="w-3 h-3 inline-block mr-1 rotate-[-90deg]" />;
                    }

                    return (
                        <span className={badgeClass}>
                            {iconNode}
                            {ioType}
                        </span>
                    );
                },
            },
            {
                accessorKey: 'increaseQty',
                header: '증가수량',
                meta: { width: '110px' },
                cell: ({ row }) => {
                    const isNew = row.original.sthiId === -999999;
                    const isEditing = row.original.sthiId === editingId;

                    if ((isNew || isEditing) && selectedDirection === 'INCREASE') {
                        return (
                            <input
                                className="tableInput"
                                type="number"
                                min="0.01"
                                step="any"
                                defaultValue={editFormRef.current.qty}
                                onChange={(e) => {
                                    editFormRef.current.qty = Number(e.target.value);
                                }}
                            />
                        );
                    }
                    if (isNew || isEditing) return '-';
                    return row.original.increaseQty > 0 ? `+${row.original.increaseQty.toLocaleString()}` : '-';
                },
            },
            {
                accessorKey: 'decreaseQty',
                header: '감소수량',
                meta: { width: '110px' },
                cell: ({ row }) => {
                    const isNew = row.original.sthiId === -999999;
                    const isEditing = row.original.sthiId === editingId;

                    if ((isNew || isEditing) && selectedDirection === 'DECREASE') {
                        return (
                            <input
                                className="tableInput"
                                type="number"
                                min="0.01"
                                step="any"
                                defaultValue={editFormRef.current.qty}
                                onChange={(e) => {
                                    editFormRef.current.qty = Number(e.target.value);
                                }}
                            />
                        );
                    }
                    if (isNew || isEditing) return '-';
                    return row.original.decreaseQty > 0 ? `-${row.original.decreaseQty.toLocaleString()}` : '-';
                },
            },
            {
                accessorKey: 'note',
                header: '비고',
                cell: ({ row }) => {
                    const isNew = row.original.sthiId === -999999;
                    const isEditing = row.original.sthiId === editingId;

                    if (isNew || isEditing) {
                        return (
                            <input
                                className="tableInput"
                                type="text"
                                placeholder="조정 사유 입력"
                                defaultValue={editFormRef.current.note}
                                onChange={(e) => {
                                    editFormRef.current.note = e.target.value;
                                }}
                            />
                        );
                    }
                    return row.original.note || '-';
                },
            },
            {
                accessorKey: 'createdAt',
                header: '등록일시',
                meta: { width: '170px' },
                cell: ({ row }) => {
                    const isNew = row.original.sthiId === -999999;
                    if (isNew) return '-';
                    return row.original.createdAt ? formatDateTime(row.original.createdAt) : '-';
                },
            },
            {
                id: 'actions',
                header: '관리',
                meta: { width: '150px' },
                cell: ({ row }) => {
                    const isNew = row.original.sthiId === -999999;
                    const isEditing = row.original.sthiId === editingId;
                    const isAdjustable = row.original.ioType === '조정';

                    if (isNew || isEditing) {
                        return (
                            <div className="rowActions">
                                <button
                                    type="button"
                                    className="miniButton primary"
                                    disabled={isUpdating}
                                    onClick={() => (isNew ? handleSaveCreate() : handleSaveEdit(row.original.sthiId))}
                                >
                                    {isUpdating ? '저장 중' : '저장'}
                                </button>
                                <button
                                    type="button"
                                    className="miniButton danger"
                                    disabled={isUpdating}
                                    onClick={isNew ? handleCancelCreate : handleCancelEdit}
                                >
                                    취소
                                </button>
                            </div>
                        );
                    }

                    return (
                        <div className="rowActions">
                            {isAdjustable ? (
                                <>
                                    <button
                                        type="button"
                                        className="miniButton"
                                        onClick={() => handleStartEdit(row.original)}
                                    >
                                        수정
                                    </button>
                                    <button
                                        type="button"
                                        className="miniButton danger"
                                        onClick={() => handleDelete(row.original)}
                                    >
                                        삭제
                                    </button>
                                </>
                            ) : (
                                <span className="text-xs text-gray-400">읽기 전용</span>
                            )}
                        </div>
                    );
                },
            },
        ],
        [editingId, isCreatingNewRow, isUpdating, itemOptions, selectedDirection]
    );

    const displayList = useMemo(() => {
        if (isCreatingNewRow) {
            const dummyNewRow: StockHistoryResponse = {
                sthiId: -999999,
                itemCode: '',
                itemNm: '',
                category: 0,
                ioType: '조정',
                increaseQty: 0,
                decreaseQty: 0,
                processedDate: '',
                note: '',
                createdAt: '',
            };
            return [dummyNewRow, ...historyList];
        }
        return historyList;
    }, [isCreatingNewRow, historyList]);

    return (
        <section className="screenStack">
            <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

            <Panel title="재고이력 관리 목록" action="재고 조정 등록" onAction={handleStartCreate}>
                <div className="relative min-h-[300px]">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Spinner />
                        </div>
                    ) : (
                        <>
                            <CusTable
                                data={displayList}
                                columns={columns}
                                sorting={sorting}
                                onSortingChange={handleSortingChange}
                                noDataMessage="조회된 재고이력 데이터가 없습니다."
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