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
import { ReportModal } from '@/components/common/ReportModal';
import '@/pages/page/ioSeed/ioSeed.css';

// 백엔드 reportStatus 값: '미신고' / '부분신고' / '신고완료'
const REPORT_STATUS_META: Record<string, { label: string; badgeClass: string; barClass: string }> = {
  미신고: { label: '미신고', badgeClass: 'statusBadge statusBadge--unreported', barClass: 'progressFill progressFill--unreported' },
  부분신고: { label: '부분신고 진행중', badgeClass: 'statusBadge statusBadge--partial', barClass: 'progressFill progressFill--partial' },
  신고완료: { label: '신고완료', badgeClass: 'statusBadge statusBadge--completed', barClass: 'progressFill progressFill--completed' },
};

const DEFAULT_STATUS_META = REPORT_STATUS_META['미신고'];

function getActionLabel(reportStatus: string): string {
  if (reportStatus === '신고완료') return '이력보기';
  if (reportStatus === '부분신고') return '이어서 신고';
  return '신고처리';
}

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

  // 신고처리 모달 대상 (null이면 닫힘)
  const [reportModalReceipt, setReportModalReceipt] = useState<SeedGoodsReceiptResponse | null>(null);

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

  // 사용자가 양품수량을 직접 수정했는지 여부 - true면 자동 재계산을 멈춘다
  const [isGoodQtyManual, setIsGoodQtyManual] = useState(false);

  // 양품수량 입력 DOM 직접 제어를 위한 Ref
  const goodQtyInputRef = useRef<HTMLInputElement>(null);

  // 입고수량/불량수량이 바뀔 때 호출. 사용자가 양품수량을 직접 수정한 상태(수동모드)라면 건드리지 않는다.
  const recalcGoodQty = () => {
    if (isGoodQtyManual) return;
    const receiptQty = Number(editFormRef.current.receiptQty) || 0;
    const defectQty = Number(editFormRef.current.defectQty) || 0;
    const nextGoodQty = Math.max(receiptQty - defectQty, 0);
    editFormRef.current.goodQty = nextGoodQty;

    // 💡 렌더링을 유발하지 않고 input 값을 직접 갱신하여 커서 풀림 방지
    if (goodQtyInputRef.current) {
      goodQtyInputRef.current.value = String(nextGoodQty);
    }
  };

  // 양품수량을 사용자가 직접 입력했을 때
  const handleManualGoodQtyChange = (value: number) => {
    editFormRef.current.goodQty = value;
    setIsGoodQtyManual(true);
  };

  // 다시 자동 계산 모드로 전환 (입고수량 - 불량수량으로 재계산)
  const handleResetGoodQtyToAuto = () => {
    setIsGoodQtyManual(false);
    const receiptQty = Number(editFormRef.current.receiptQty) || 0;
    const defectQty = Number(editFormRef.current.defectQty) || 0;
    const nextGoodQty = Math.max(receiptQty - defectQty, 0);
    editFormRef.current.goodQty = nextGoodQty;

    if (goodQtyInputRef.current) {
      goodQtyInputRef.current.value = String(nextGoodQty);
    }
  };

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
  const searchFields: SearchField[] = useMemo(
    () => [
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
    ],
    [itemOptions]
  );

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
    setIsGoodQtyManual(false);
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
    if (defectQty > receiptQty) {
      window.alert('불량수량은 입고수량을 초과할 수 없습니다.');
      return false;
    }
    if (goodQty + defectQty > receiptQty) {
      window.alert('양품수량과 불량수량의 합이 입고수량을 초과할 수 없습니다.');
      return false;
    }
    if (goodQty <= 0) {
      window.alert('양품수량이 0입니다. 입고수량과 불량수량을 확인해주세요.');
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
    const initialAutoGoodQty = Math.max((row.receiptQty ?? 0) - (row.defectQty ?? 0), 0);
    // 기존 저장된 양품수량이 (입고수량-불량수량)과 다르면 이미 수동 조정된 값이므로 수동모드로 시작
    setIsGoodQtyManual((row.goodQty ?? 0) !== initialAutoGoodQty);
    setEditingReceiptId(row.receiptId);
  };

  const handleCancelEdit = () => {
    setEditingReceiptId(null);
    editFormRef.current = { itemCode: '', receiptQty: 0, defectQty: 0, goodQty: 0, receivedAt: '' };
    setIsGoodQtyManual(false);
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

    const confirmed = window.confirm(`[${row.itemNm}] 입고 항목을 삭제하시겠습니까?`);
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

  const handleOpenReportModal = (row: SeedGoodsReceiptResponse) => {
    if (editingReceiptId !== null || isCreatingNewRow) return;
    setReportModalReceipt(row);
  };

  const handleCloseReportModal = () => {
    setReportModalReceipt(null);
  };

  // 신고 이력이 변경되면(등록/수정/삭제) 목록의 진행상태를 다시 불러온다.
  const handleReportChanged = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const columns: ColumnDef<SeedGoodsReceiptResponse>[] = useMemo(
    () => [
      {
        accessorKey: 'itemCode',
        header: '품목',
        meta: { width: '200px' },
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
                <option value="" disabled>
                  품목 선택
                </option>
                {!existsInOptions && currentVal && (
                  <option value={currentVal} style={{ color: '#9ca3af' }}>
                    {currentVal} · {row.original.itemNm || '기존 품목'}
                  </option>
                )}
                {itemOptions.map((opt) => (
                  <option key={opt.itemCode} value={opt.itemCode}>
                    {opt.itemCode} · {opt.itemNm ?? '-'}
                  </option>
                ))}
              </select>
            );
          }

          return (
            <div className="itemCell">
              <span className="itemCell__name">{row.original.itemNm || '-'}</span>
              <span className="itemCell__code">{row.original.itemCode}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'receiptQty',
        header: '입고수량',
        meta: { width: '100px' },
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
                  recalcGoodQty();
                }}
              />
            );
          }
          return (row.original.receiptQty ?? 0).toLocaleString();
        },
      },
      {
        accessorKey: 'defectQty',
        header: '불량수량',
        meta: { width: '100px' },
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
                  recalcGoodQty();
                }}
              />
            );
          }
          return (row.original.defectQty ?? 0).toLocaleString();
        },
      },
      {
        accessorKey: 'goodQty',
        header: '양품수량',
        meta: { width: '150px' },
        cell: ({ row }) => {
          const isNewRow = row.original.receiptId === -999999;
          const isEditing = row.original.receiptId === editingReceiptId;

          if (isNewRow || isEditing) {
            return (
              <div className="goodQtyCell">
                <input
                  ref={goodQtyInputRef}
                  className="tableInput"
                  type="number"
                  min="0"
                  defaultValue={editFormRef.current.goodQty || 0}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                    handleManualGoodQtyChange(val);
                  }}
                />
                {isGoodQtyManual && (
                  <button
                    type="button"
                    className="goodQtyAutoBtn"
                    onClick={handleResetGoodQtyToAuto}
                    title="입고수량 - 불량수량으로 다시 자동 계산합니다."
                  >
                    자동계산
                  </button>
                )}
              </div>
            );
          }
          return (row.original.goodQty ?? 0).toLocaleString();
        },
      },
      {
        accessorKey: 'receivedAt',
        header: '입고시간',
        meta: { width: '195px' },
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
        accessorKey: 'reportStatus',
        header: '진행상태',
        meta: { width: '250px' },
        cell: ({ row }) => {
          const isNewRow = row.original.receiptId === -999999;
          if (isNewRow) return null;

          const goodQty = row.original.goodQty ?? 0;
          const remainingQty = row.original.remainingQty ?? goodQty;
          const returnedQty = Math.max(goodQty - remainingQty, 0);
          const meta = REPORT_STATUS_META[row.original.reportStatus] ?? DEFAULT_STATUS_META;
          const percent = goodQty > 0 ? Math.min((returnedQty / goodQty) * 100, 100) : 0;

          return (
            <div className="reportStatusCell">
              <span className={meta.badgeClass}>
                <span className="statusBadge__dot" />
                {meta.label}
              </span>
              <div className="seedProgressBar">
                <div className={`seedProgressFill ${meta.barClass}`} style={{ width: `${percent}%` }} />
              </div>
              <span className="reportStatusCell__count">
                {returnedQty.toLocaleString()} / {goodQty.toLocaleString()} 신고
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '관리',
        meta: { width: '180px' },
        cell: ({ row }) => {
          const isNewRow = row.original.receiptId === -999999;
          const isEditing = row.original.receiptId === editingReceiptId;
          const isDeleting = isDeletingId === row.original.receiptId;

          if (isNewRow || isEditing) {
            return (
              <div className="rowActions">
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

          const actionLabel = getActionLabel(row.original.reportStatus);
          const disableRow = editingReceiptId !== null || isCreatingNewRow || isDeleting;

          return (
            <div className="rowActions">
              <button
                type="button"
                className="miniButton primary"
                disabled={disableRow}
                onClick={() => handleOpenReportModal(row.original)}
              >
                {actionLabel}
              </button>
              <button
                type="button"
                className="miniButton"
                disabled={disableRow}
                onClick={() => handleStartEdit(row.original)}
              >
                수정
              </button>
              <button
                type="button"
                className="miniButton danger"
                disabled={disableRow}
                onClick={() => handleDeleteReceipt(row.original)}
              >
                {isDeleting ? '삭제 중' : '삭제'}
              </button>
            </div>
          );
        },
      },
    ],
    [editingReceiptId, isCreatingNewRow, isUpdating, isDeletingId, itemOptions, isGoodQtyManual]
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
        returnedQty: 0,
        remainingQty: 0,
        reportStatus: '',
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

      {reportModalReceipt && (
        <ReportModal receipt={reportModalReceipt} onClose={handleCloseReportModal} onChanged={handleReportChanged} />
      )}
    </section>
  );
}