import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { Panel } from '@components/card/Panel';
import { SearchBand, type SearchField } from '@components/search/SearchBand';
import { CusTable } from '@components/table/CusTable';
import { CusPagination } from '@components/table/CusPagination';
import Spinner from '@/components/common/Spinner';
import { 
  SeedGoodsReceiptReturnApi, 
  type SeedGoodsReceiptReturnItemResponse, 
  type SeedGoodsReceiptReturnUpdateRequest 
} from '@/api/seed/SeedGoodsReceiptReturn';
import { ItemApi, type ItemOptionResponse } from '@/api/master/Item';

const PROCESS_STATUS_MAP: Record<number, string> = {
  0: '신고대기',
  1: '신고완료',
};

const PROCESS_STATUS_COLORS: Record<number, string> = {
  0: '#818cf8',
  1: '#e879f9',
};

export function SeedReportReturnManagePage() {
  const [dataList, setDataList] = useState<SeedGoodsReceiptReturnItemResponse[]>([]);
  const [itemOptions, setItemOptions] = useState<ItemOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);

  // 현재 수정 중인 행의 ID
  const [editingId, setEditingId] = useState<number | null>(null);
  // 수정 중인 행의 임시 입력 데이터 저장 상태
  const [editForm, setEditForm] = useState<Partial<SeedGoodsReceiptReturnUpdateRequest>>({});

  const [searchFilters, setSearchFilters] = useState({
    itemCode: '',
    processStatus: '',
  });

  const itemCodeRef = useRef<HTMLSelectElement>(null);
  const processStatusRef = useRef<HTMLSelectElement>(null);

  // 품목 옵션 조회
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
        label: '품목',
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
        label: '처리상태',
        ref: processStatusRef,
        name: 'processStatus',
        options: [
          { label: '전체', value: '' },
          { label: '신고대기', value: '0' },
          { label: '신고완료', value: '1' },
        ],
      },
    ],
    [itemOptions]
  );

  const sortParams = useMemo(() => {
    return sorting.map((sort) => `${sort.id},${sort.desc ? 'desc' : 'asc'}`);
  }, [sorting]);

  const loadList = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        size: 10,
      };

      if (searchFilters.itemCode) {
        params.itemCode = searchFilters.itemCode;
      }

      if (searchFilters.processStatus !== '') {
        params.processStatus = Number(searchFilters.processStatus);
      }

      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await SeedGoodsReceiptReturnApi.getList(params);
      const pageData = response.data;

      setDataList(pageData?.content ?? []);
      setTotalElements(pageData?.totalElements ?? 0);
      setTotalPages(pageData?.totalPages ?? 0);
    } catch (error) {
      console.error('씨드 신고반납 목록 조회 실패:', error);
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchFilters, sortParams]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleSearch = () => {
    setPage(0);
    setSearchFilters({
      itemCode: itemCodeRef.current?.value || '',
      processStatus: processStatusRef.current?.value || '',
    });
  };

  const handleReset = () => {
    if (itemCodeRef.current) itemCodeRef.current.value = '';
    if (processStatusRef.current) processStatusRef.current.value = '';

    setPage(0);
    setSearchFilters({ itemCode: '', processStatus: '' });
    setSorting([]);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // 행 수정 모드 진입
  const handleStartEdit = (item: SeedGoodsReceiptReturnItemResponse) => {
    setEditingId(item.returnId);
    setEditForm({
      returnQty: item.returnQty,
      processStatus: item.processStatus,
    });
  };

  // 행 수정 취소
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // 행 수정 내용 저장 API 연동
  const handleSaveEdit = async (item: SeedGoodsReceiptReturnItemResponse) => {
    try {
      await SeedGoodsReceiptReturnApi.update(item.returnId, editForm as SeedGoodsReceiptReturnUpdateRequest);
      window.alert('성공적으로 수정되었습니다.');
      setEditingId(null);
      setEditForm({});
      loadList();
    } catch (error) {
      console.error('씨드 신고반납 수정 실패:', error);
      window.alert('수정에 실패했습니다.');
    }
  };

  // 행 삭제 API 연동
  const handleDelete = async (item: SeedGoodsReceiptReturnItemResponse) => {
    const confirmed = window.confirm(`신고 ID [${item.returnId}] 건을 삭제하시겠습니까?`);
    if (!confirmed) return;

    try {
      await SeedGoodsReceiptReturnApi.delete(item.returnId);
      window.alert('성공적으로 삭제되었습니다.');
      loadList();
    } catch (error) {
      console.error('씨드 신고반납 삭제 실패:', error);
      window.alert('삭제에 실패했습니다.');
    }
  };

  const columns: ColumnDef<SeedGoodsReceiptReturnItemResponse>[] = useMemo(
    () => [
      { accessorKey: 'returnId', header: '신고ID', meta: { width: '100px' } },
      {
        accessorKey: 'itemCode',
        header: '품목',
        meta: { width: '250px' },
        cell: ({ row }) => {
          const { itemCode, itemNm } = row.original;
          return (
            <div className="itemCell">
              <span className="itemCell__name">{itemNm ?? '-'}</span>
              <span className="itemCell__code">({itemCode ?? '-'})</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'returnQty',
        header: '수량',
        meta: { width: '100px' },
        cell: ({ row }) => {
          const isEditing = editingId === row.original.returnId;
          if (isEditing) {
            return (
              <input
                type="number"
                style={{ width: '80px' }}
                className="w-24 border px-2 py-0.5 rounded text-sm"
                value={editForm.returnQty ?? ''}
                onChange={(e) => setEditForm({ ...editForm, returnQty: Number(e.target.value) })}
              />
            );
          }
          return row.original.returnQty;
        },
      },
      { accessorKey: 'reportDate', header: '신고일자', meta: { width: '130px' } },
      { accessorKey: 'returnDueDate', header: '처리예정일', meta: { width: '130px' } },
      {
        accessorKey: 'processStatus',
        header: '처리상태',
        meta: { width: '120px' },
        cell: ({ row }) => {
          const isEditing = editingId === row.original.returnId;
          const statusNum = row.original.processStatus;

          if (isEditing) {
            return (
              <select
                className="w-full border px-1 py-0.5 rounded text-sm"
                value={editForm.processStatus ?? 0}
                onChange={(e) => setEditForm({ ...editForm, processStatus: Number(e.target.value) })}
              >
                <option value={0}>신고대기</option>
                <option value={1}>신고완료</option>
              </select>
            );
          }

          const statusText = PROCESS_STATUS_MAP[statusNum] ?? statusNum;
          const color = PROCESS_STATUS_COLORS[statusNum];
          return color ? <span style={{ color, fontWeight: 600 }}>{statusText}</span> : statusText;
        },
      },
      {
        id: 'actions',
        header: '관리',
        meta: { width: '150px' },
        cell: ({ row }) => {
          const isEditing = editingId === row.original.returnId;
          return (
            <div className="rowActions">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="miniButton"
                    onClick={() => handleSaveEdit(row.original)}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    className="miniButton danger"
                    onClick={handleCancelEdit}
                  >
                    취소
                  </button>
                </>
              ) : (
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
              )}
            </div>
          );
        },
      },
    ],
    [editingId, editForm]
  );

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="씨드 신고반납 관리 목록">
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={dataList}
                columns={columns}
                sorting={sorting}
                onSortingChange={setSorting}
                noDataMessage="조회된 씨드 신고반납 데이터가 없습니다."
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