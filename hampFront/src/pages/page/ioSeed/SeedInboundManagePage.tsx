import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { Panel } from '@components/card/Panel';
import { SearchBand, type SearchField } from '@components/search/SearchBand';
import { CusTable } from '@components/table/CusTable';
import { CusPagination } from '@components/table/CusPagination';
// import { DashboardCharts } from '@components/chart/InOutChart';
import Spinner from '@/components/common/Spinner';
import { formatDateTime } from '@/utils/common';
import axios from 'axios';
import {
  SeedGoodsReceiptApi,
  type SeedGoodsReceiptResponse,
  type SeedGoodsReceiptCreateRequest,
  type SeedGoodsReceiptUpdateRequest,
} from '@/api/ioSeed/SeedGoodsReceipt';
import { ItemApi, type ItemOptionResponse } from '@/api/master/Item';

export function SeedInboundManagePage() {
  const [receipts, setReceipts] = useState<SeedGoodsReceiptResponse[]>([]);
  const [itemOptions, setItemOptions] = useState<ItemOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(0);
  const [searchFilters, setSearchFilters] = useState({
    itemCode: '',
  });

  const [sorting, setSorting] = useState<SortingState>([]);

  const sortParams = useMemo(() => {
    return sorting.map((sort) => `${sort.id},${sort.desc ? 'desc' : 'asc'}`);
  }, [sorting]);

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
    setPage(0);
    setEditingReceiptId(null);
    setIsCreatingNewRow(false);
  };

  const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null);
  const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);

  const editFormRef = useRef<{
    itemCode?: string;
    receiptQty?: number;
    defectQty?: number;
    goodQty?: number;
    receivedAt?: string;
  }>({
    itemCode: '',
    receiptQty: 0,
    defectQty: 0,
    goodQty: 0,
    receivedAt: '',
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  // 검색바 Ref 타입 수정 (HTMLSelectElement)
  const itemCodeRef = useRef<HTMLSelectElement>(null);

  // 1. 씨드 품목 옵션 조회 (productType: 0)
  const fetchItemOptions = useCallback(async () => {
    try {
      const res = await ItemApi.getOptions({ productType: 0 });
      setItemOptions(res.data ?? []);
    } catch (error) {
      console.error('씨드 품목 옵션 조회 실패:', error);
    }
  }, []);

  useEffect(() => {
    fetchItemOptions();
  }, [fetchItemOptions]);

  // 검색 필드 정의 (select 타입 적용 및 옵션 매핑)
  const searchFields: SearchField[] = useMemo(() => [
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
  ], [itemOptions]);

  // 2. 입고 목록 조회
  const loadReceipts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        size: 10,
      };
      if (searchFilters.itemCode) params.itemCode = searchFilters.itemCode;
      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await SeedGoodsReceiptApi.getList(params);
      const pageData = response.data;

      setReceipts(pageData?.content ?? []);
      setTotalElements(pageData?.totalElements ?? 0);
      setTotalPages(pageData?.totalPages ?? 0);
    } catch (error) {
      console.error('씨드 입고 목록 조회 실패:', error);
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchFilters, sortParams, refreshKey]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  const handleSearch = () => {
    setPage(0);
    setSearchFilters({
      itemCode: itemCodeRef.current?.value.trim() || '',
    });
    setEditingReceiptId(null);
    setIsCreatingNewRow(false);
  };

  const handleReset = () => {
    if (itemCodeRef.current) itemCodeRef.current.value = '';
    setPage(0);
    setSearchFilters({ itemCode: '' });
    setSorting([]);
    setEditingReceiptId(null);
    setIsCreatingNewRow(false);
  };

  const handlePageChange = (newPage: number) => {
    setEditingReceiptId(null);
    setIsCreatingNewRow(false);
    setPage(newPage);
  };

  const handleStartCreate = () => {
    if (isCreatingNewRow) return;
    setEditingReceiptId(null);
    editFormRef.current = {
      itemCode: '',
      receiptQty: 0,
      defectQty: 0,
      goodQty: 0,
      receivedAt: '',
    };
    setIsCreatingNewRow(true);
  };

  const handleCancelCreate = () => {
    setIsCreatingNewRow(false);
  };

  // 공통 유효성 검사 함수 (입고수량 vs 양품 + 불량)
  const validateQuantities = () => {
    const receiptQty = Number(editFormRef.current.receiptQty) || 0;
    const defectQty = Number(editFormRef.current.defectQty) || 0;
    const goodQty = Number(editFormRef.current.goodQty) || 0;

    if (receiptQty <= 0) {
      window.alert('입고수량은 0보다 커야 합니다.');
      return false;
    }
    if (goodQty + defectQty > receiptQty) {
      window.alert('양품수량과 불량수량의 합이 총 입고수량을 초과할 수 없습니다.');
      return false;
    }
    return true;
  };

  const handleSaveCreate = async () => {
    if (isUpdating) return;

    const itemCode = editFormRef.current.itemCode?.trim();
    if (!itemCode) {
      window.alert('품목을 선택해주세요.');
      return;
    }

    if (!editFormRef.current.receivedAt) {
      window.alert('입고일자를 입력해주세요.');
      return;
    }

    if (!validateQuantities()) return;

    setIsUpdating(true);
    try {
      const payload: SeedGoodsReceiptCreateRequest = {
        itemCode,
        receiptQty: Number(editFormRef.current.receiptQty) || 0,
        defectQty: Number(editFormRef.current.defectQty) || 0,
        goodQty: Number(editFormRef.current.goodQty) || 0,
        receivedAt: editFormRef.current.receivedAt,
      };

      const response = await SeedGoodsReceiptApi.create(payload);
      window.alert(response.message || '등록되었습니다.');
      setIsCreatingNewRow(false);

      if (itemCodeRef.current) itemCodeRef.current.value = '';
      setPage(0);
      setSearchFilters({ itemCode: '' });
      setSorting([]);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error('등록 실패:', err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || '등록에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartEdit = (row: SeedGoodsReceiptResponse) => {
    setIsCreatingNewRow(false);
    editFormRef.current = {
      itemCode: row.itemCode ?? '',
      receiptQty: row.receiptQty ?? 0,
      defectQty: row.defectQty ?? 0,
      goodQty: row.goodQty ?? 0,
      receivedAt: row.receivedAt ?? '',
    };
    setEditingReceiptId(row.receiptId);
  };

  const handleCancelEdit = () => {
    setEditingReceiptId(null);
    editFormRef.current = { itemCode: '', receiptQty: 0, defectQty: 0, goodQty: 0, receivedAt: '' };
  };

  const handleSaveEdit = async (receiptId: number) => {
    if (isUpdating) return;

    const itemCode = editFormRef.current.itemCode?.trim();
    if (!itemCode) {
      window.alert('품목을 선택해주세요.');
      return;
    }

    if (!validateQuantities()) return;

    setIsUpdating(true);
    try {
      const updatePayload: SeedGoodsReceiptUpdateRequest = {
        itemCode: editFormRef.current.itemCode?.trim() ?? '',
        receiptQty: Number(editFormRef.current.receiptQty) || 0,
        defectQty: Number(editFormRef.current.defectQty) || 0,
        goodQty: Number(editFormRef.current.goodQty) || 0,
        receivedAt: editFormRef.current.receivedAt ?? '',
      };

      const response = await SeedGoodsReceiptApi.update(receiptId, updatePayload);
      window.alert(response.message || '수정되었습니다.');
      setEditingReceiptId(null);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error('수정 실패:', err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      window.alert(errorMessage || '수정에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteReceipt = async (row: SeedGoodsReceiptResponse) => {
    if (isDeletingId) return;

    const confirmed = window.confirm(`[${row.receiptId}] 입고 항목을 삭제하시겠습니까?`);
    if (!confirmed) return;

    setIsDeletingId(row.receiptId);
    try {
      await SeedGoodsReceiptApi.delete(row.receiptId);
      window.alert('삭제되었습니다.');
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('삭제 실패:', error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      window.alert(message || '삭제에 실패했습니다.');
    } finally {
      setIsDeletingId(null);
    }
  };

  const columns: ColumnDef<SeedGoodsReceiptResponse>[] = useMemo(
    () => [
      {
        accessorKey: 'receiptId',
        header: '입고번호',
        cell: ({ row }) => (row.original.receiptId === -999999 ? '(신규)' : row.original.receiptId),
      },
      {
        accessorKey: 'itemCode',
        header: '품목코드',
        cell: ({ row }) => {
          const isNewRow = row.original.receiptId === -999999;
          const isEditing = row.original.receiptId === editingReceiptId;

          if (isNewRow || isEditing) {
            const currentVal = editFormRef.current.itemCode ?? '';
            const existsInOptions = itemOptions.some((opt) => opt.itemCode === currentVal);

            return (
              <select
                className="tableInput"
                defaultValue={currentVal}
                onChange={(e) => {
                  editFormRef.current.itemCode = e.target.value;
                }}
              >
                <option value="" disabled>품목 선택</option>
                {!existsInOptions && currentVal && (
                  <option value={currentVal} style={{ color: '#9ca3af' }}>
                    {currentVal} (기존 품목)
                  </option>
                )}
                {itemOptions.map((opt) => (
                  <option key={opt.itemCode} value={opt.itemCode}>
                    {opt.itemCode} ({opt.itemNm ?? '-'})
                  </option>
                ))}
              </select>
            );
          }
          return row.original.itemCode;
        },
      },
      {
        accessorKey: 'itemNm',
        header: '품목명',
        cell: ({ row }) => row.original.itemNm || '-',
      },
      {
        accessorKey: 'receiptQty',
        header: '입고수량',
        cell: ({ row }) => {
          const isNewRow = row.original.receiptId === -999999;
          const isEditing = row.original.receiptId === editingReceiptId;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                type="number"
                min="0"
                placeholder="수량 입력"
                defaultValue={editFormRef.current.receiptQty || ''}
                onChange={(e) => {
                  editFormRef.current.receiptQty = e.target.value === '' ? 0 : Number(e.target.value);
                }}
              />
            );
          }
          return row.original.receiptQty;
        },
      },
      {
        accessorKey: 'defectQty',
        header: '불량수량',
        cell: ({ row }) => {
          const isNewRow = row.original.receiptId === -999999;
          const isEditing = row.original.receiptId === editingReceiptId;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                type="number"
                min="0"
                placeholder="수량 입력"
                defaultValue={editFormRef.current.defectQty || ''}
                onChange={(e) => {
                  editFormRef.current.defectQty = e.target.value === '' ? 0 : Number(e.target.value);
                }}
              />
            );
          }
          return row.original.defectQty;
        },
      },
      {
        accessorKey: 'goodQty',
        header: '양품수량',
        cell: ({ row }) => {
          const isNewRow = row.original.receiptId === -999999;
          const isEditing = row.original.receiptId === editingReceiptId;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                type="number"
                min="0"
                placeholder="수량 입력"
                defaultValue={editFormRef.current.goodQty || ''}
                onChange={(e) => {
                  editFormRef.current.goodQty = e.target.value === '' ? 0 : Number(e.target.value);
                }}
              />
            );
          }
          return row.original.goodQty;
        },
      },
      {
        accessorKey: 'receivedAt',
        header: '입고일자',
        cell: ({ row }) => {
          const isNewRow = row.original.receiptId === -999999;
          const isEditing = row.original.receiptId === editingReceiptId;

          if (isNewRow || isEditing) {
            return (
              <input
                className="tableInput"
                type="datetime-local"
                defaultValue={editFormRef.current.receivedAt ? editFormRef.current.receivedAt.slice(0, 16) : ''}
                onChange={(e) => {
                  editFormRef.current.receivedAt = e.target.value;
                }}
              />
            );
          }
          return row.original.receivedAt ? formatDateTime(row.original.receivedAt) : '-';
        },
      },
      {
        accessorKey: 'createdAt',
        header: '등록일자',
        cell: ({ row, getValue }) => {
          if (row.original.receiptId === -999999) return '-';
          return formatDateTime(getValue<string>());
        },
      },
      {
        id: 'actions',
        header: '관리',
        meta: { width: '150px' },
        cell: ({ row }) => {
          const isNewRow = row.original.receiptId === -999999;
          const isEditing = row.original.receiptId === editingReceiptId;
          const isDeleting = isDeletingId === row.original.receiptId;

          if (isNewRow || isEditing) {
            return (
              <div className="rowActions" style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="miniButton primary"
                  disabled={isUpdating}
                  onClick={() => (isNewRow ? handleSaveCreate() : handleSaveEdit(row.original.receiptId))}
                >
                  {isUpdating ? '저장 중' : '저장'}
                </button>
                <button
                  type="button"
                  className="miniButton danger"
                  disabled={isUpdating}
                  onClick={isNewRow ? handleCancelCreate : handleCancelEdit}
                >
                  취소
                </button>
              </div>
            );
          }

          return (
            <div className="rowActions" style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="miniButton"
                disabled={editingReceiptId !== null || isCreatingNewRow || isDeleting}
                onClick={() => handleStartEdit(row.original)}
              >
                수정
              </button>
              <button
                type="button"
                className="miniButton danger"
                disabled={editingReceiptId !== null || isCreatingNewRow || isDeleting}
                onClick={() => handleDeleteReceipt(row.original)}
              >
                {isDeleting ? '삭제 중' : '삭제'}
              </button>
            </div>
          );
        },
      },
    ],
    [editingReceiptId, isCreatingNewRow, isUpdating, isDeletingId, itemOptions]
  );

  const displayReceipts = useMemo(() => {
    if (isCreatingNewRow) {
      const dummyNewRow: SeedGoodsReceiptResponse = {
        receiptId: -999999,
        itemCode: '',
        itemNm: '',
        receiptQty: 0,
        defectQty: 0,
        goodQty: 0,
        receivedAt: '',
        createdAt: '',
        updatedAt: '',
      };
      return [dummyNewRow, ...receipts];
    }
    return receipts;
  }, [isCreatingNewRow, receipts]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />
      {/* <DashboardCharts pageType="seedInbound" /> */}

      <Panel title="씨드 입고관리 목록" action="등록" onAction={handleStartCreate}>
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={displayReceipts}
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