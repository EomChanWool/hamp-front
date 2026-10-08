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
import '@pages/page/seed/Seed.css';
import { Badge } from '@/components/common/Badge';
import { formatDateTime } from '@/utils/common';

const PENDING_PREVIEW_COUNT = 3;

const DOWNLOAD_FILE_PREFIX = '씨드신고반납';
const DOWNLOAD_FILE_EXT = 'docx';

export function SeedReportReturnManagePage() {
  const [dataList, setDataList] = useState<SeedGoodsReceiptReturnItemResponse[]>([]);
  const [itemOptions, setItemOptions] = useState<ItemOptionResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // "+N건 더보기 / 접기" 동작
  const [pendingList, setPendingList] = useState<SeedGoodsReceiptReturnItemResponse[]>([]);
  const [pendingTotalElements, setPendingTotalElements] = useState(0);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const pendingTotalRef = useRef(0);

  const completedList = useMemo(
    () => dataList.filter((item) => item.processStatus === 1),
    [dataList]
  );


  const [isLoading, setIsLoading] = useState(false);

  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);

  // 현재 수정 중인 행의 ID
  const [editingId, setEditingId] = useState<number | null>(null);

  // 날짜 수정용 폼 상태
  const [editForm, setEditForm] = useState<Partial<SeedGoodsReceiptReturnUpdateRequest>>({});

  // --- useRef 기반 수량 임시 저장소 (returnId를 키로 관리하여 포커스 튀김 방지) ---
  const editQuantitiesRef = useRef<Record<number, number | ''>>({});
  const editHullQuantitiesRef = useRef<Record<number, number | ''>>({});

  //  - 페이지를 넘겨도 선택이 유지되도록 페이지 단위가 아닌 전체 기준으로 관리
  const [selectedReturnIds, setSelectedReturnIds] = useState<number[]>([]);

  // 다운로드 진행 중 여부 (중복 클릭 방지)
  const [isDownloading, setIsDownloading] = useState(false);

  const [searchFilters, setSearchFilters] = useState({
    itemCode: '',
    processStatus: '',
    processStatusKeyword: '',
  });

  const itemCodeRef = useRef<HTMLSelectElement>(null);
  const itemCodeInputRef = useRef<HTMLInputElement>(null);
  const processStatusRef = useRef<HTMLSelectElement>(null);
  const processStatusInputRef = useRef<HTMLInputElement>(null);

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
        type: "input",
        label: "품목코드",
        ref: itemCodeInputRef,
        name: "itemCode",
      },
      {
        type: "input",
        label: "처리상태",
        ref: processStatusInputRef,
        name: "processStatus",
      },
      {
        type: 'select',
        label: '품목',
        ref: itemCodeRef,
        name: 'itemCode',
        options: [
          { label: '전체', value: '' },
          ...itemOptions.map((opt) => ({
            label: `${opt.itemNm} (${opt.itemCode ?? '-'})`,
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

  //  요약칩 '품목' 라벨
  //  - 검색조건에 품목이 선택돼 있으면 "품목 · 품목명 (코드)" 로 표시
  //  - 선택 안 했으면 "품목 · 전체"
  //  - 품목 옵션에서 못 찾는 경우(직접 입력한 코드 등)는 코드만 표시
  const itemChipLabel = useMemo(() => {
    if (!searchFilters.itemCode) return '품목 · 전체';

    const found = itemOptions.find((opt) => opt.itemCode === searchFilters.itemCode);
    return found
      ? `품목 · ${found.itemNm} (${found.itemCode})`
      : `품목 · ${searchFilters.itemCode}`;
  }, [searchFilters.itemCode, itemOptions]);

  const sortParams = useMemo(() => {
    return sorting.map((sort) => `${sort.id},${sort.desc ? 'desc' : 'asc'}`);
  }, [sorting]);

  const loadCompletedList = useCallback(async () => {
    setIsLoading(true);

    try {
      if (searchFilters.processStatusKeyword === '__INVALID__') {
        setDataList([]);
        setTotalElements(0);
        setTotalPages(0);
        return;
      }

      const params: Record<string, any> = {
        page,
        size: 10,
        processStatus: 1,
      };

      if (searchFilters.itemCode) {
        params.itemCode = searchFilters.itemCode;
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
      console.error('씨드 신고완료 목록 조회 실패:', error);
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchFilters.itemCode, searchFilters.processStatusKeyword, sortParams]);

  //  신고대기 조회
  //  - 접힘: 앞 3건만 조회
  //  - 펼침: 전체 건수만큼 한 번에 조회 (page 는 항상 0)
  const loadPendingList = useCallback(async () => {
    try {
      if (searchFilters.processStatusKeyword === '__INVALID__') {
        setPendingList([]);
        setPendingTotalElements(0);
        pendingTotalRef.current = 0;
        return;
      }
      const params: Record<string, any> = {
        page: 0,
        size: pendingExpanded
          ? Math.max(pendingTotalRef.current, PENDING_PREVIEW_COUNT)
          : PENDING_PREVIEW_COUNT,
        processStatus: 0,
      };

      if (searchFilters.itemCode) {
        params.itemCode = searchFilters.itemCode;
      }

      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await SeedGoodsReceiptReturnApi.getList(params);
      const pageData = response.data;

      const total = pageData?.totalElements ?? 0;

      setPendingList(pageData?.content ?? []);
      pendingTotalRef.current = total;
      setPendingTotalElements(total);
    } catch (error) {
      console.error('씨드 신고대기 목록 조회 실패:', error);
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }, [pendingExpanded, searchFilters.itemCode, searchFilters.processStatusKeyword, sortParams]);

  const visiblePendingList = useMemo(
    () => (pendingExpanded ? pendingList : pendingList.slice(0, PENDING_PREVIEW_COUNT)),
    [pendingExpanded, pendingList]
  );

  // 접힘 상태에서 "+N건 더보기" 에 표시할 숨은 건수
  const pendingHiddenCount = Math.max(pendingTotalElements - PENDING_PREVIEW_COUNT, 0);

  useEffect(() => {
    loadCompletedList();
  }, [loadCompletedList]);

  useEffect(() => {
    loadPendingList();
  }, [loadPendingList]);

  // ── 체크박스 선택 관련 ─────────────────────────────────────────────

  // 선택 여부를 빠르게 확인하기 위한 Set
  const selectedIdSet = useMemo(() => new Set(selectedReturnIds), [selectedReturnIds]);

  // 현재 페이지 기준 "전체 선택" / "일부 선택" 상태 (헤더 체크박스용)
  const isAllSelectedOnPage =
    completedList.length > 0 &&
    completedList.every((item) => selectedIdSet.has(item.returnId));

  const isSomeSelectedOnPage =
    !isAllSelectedOnPage &&
    completedList.some((item) => selectedIdSet.has(item.returnId));

  // 행 체크박스 토글
  const handleToggleRow = useCallback((returnId: number) => {
    setSelectedReturnIds((prev) =>
      prev.includes(returnId)
        ? prev.filter((id) => id !== returnId)
        : [...prev, returnId]
    );
  }, []);

  // 헤더 체크박스: 현재 페이지의 신고완료 건 전체 선택 / 해제
  const handleToggleAllOnPage = useCallback(
    (checked: boolean) => {
      const pageIds = completedList.map((item) => item.returnId);

      setSelectedReturnIds((prev) =>
        checked
          ? Array.from(new Set([...prev, ...pageIds]))
          : prev.filter((id) => !pageIds.includes(id))
      );
    },
    [completedList]
  );

  // ── 파일 다운로드 ──────────────────────────────────────────────────
  //  - 체크한 returnId 들을 서버로 보내고, 응답(blob)을 파일로 저장
  const handleDownload = async () => {
    if (selectedReturnIds.length === 0) {
      window.alert('다운로드할 신고완료 건을 선택해주세요.');
      return;
    }

    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const blob = await SeedGoodsReceiptReturnApi.document({
        returnIds: selectedReturnIds,
      });

      // 파일명: 씨드신고반납_yyyyMMdd.xlsx
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const fileName = `${DOWNLOAD_FILE_PREFIX}_${yyyy}${mm}${dd}.${DOWNLOAD_FILE_EXT}`;

      // blob -> 임시 URL -> a 태그 클릭으로 저장
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('씨드 신고반납 문서 다운로드 실패:', error);
      window.alert('파일 다운로드에 실패했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSearch = () => {
    setPage(0);
    setPendingExpanded(false);
    setSelectedReturnIds([]); // 검색 조건이 바뀌면 선택 초기화

    const itemCode =
      itemCodeInputRef.current?.value.trim() ||
      itemCodeRef.current?.value.trim() ||
      '';

    const processStatusInput =
      processStatusInputRef.current?.value.trim() || '';

    const normalizedStatus = processStatusInput.replace(/\s/g, '');

    let processStatus = '';
    let processStatusKeyword = '';

    if (!normalizedStatus) {
      // 상단 input이 비어 있으면 기존 상세 select 사용
      processStatus = processStatusRef.current?.value.trim() || '';
    } else if (normalizedStatus === '신고') {
      // 신고 = 신고대기 + 신고완료
      processStatusKeyword = '신고';
    } else if (
      normalizedStatus === '대기' ||
      normalizedStatus === '신고대기' ||
      normalizedStatus === '0'
    ) {
      processStatus = '0';
    } else if (
      normalizedStatus === '완료' ||
      normalizedStatus === '신고완료' ||
      normalizedStatus === '1'
    ) {
      processStatus = '1';
    } else {
      // 알 수 없는 검색어
      processStatusKeyword = '__INVALID__';
    }

    setSearchFilters({
      itemCode,
      processStatus,
      processStatusKeyword,
    });
  };

  const handleReset = () => {
    if (itemCodeInputRef.current) itemCodeInputRef.current.value = '';
    if (processStatusInputRef.current) processStatusInputRef.current.value = '';

    if (itemCodeRef.current) itemCodeRef.current.value = '';
    if (processStatusRef.current) processStatusRef.current.value = '';

    setPage(0);
    setPendingExpanded(false); // 초기화 시 신고대기는 접힘 상태로
    setSelectedReturnIds([]); // 초기화 시 선택도 초기화

    setSearchFilters({
      itemCode: '',
      processStatus: '',
      processStatusKeyword: '',
    });

    setSorting([]);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // 행 수정 모드 진입
  const handleStartEdit = (item: SeedGoodsReceiptReturnItemResponse) => {
    setEditingId(item.returnId);

    editQuantitiesRef.current[item.returnId] = item.returnQty;
    editHullQuantitiesRef.current[item.returnId] = item.hullQty;

    setEditForm({
      returnDueDate: item.returnDueDate ?? '',
      reportDate: item.reportDate ?? '',
    });
  };

  // 행 수정 취소
  const handleCancelEdit = (returnId: number) => {
    delete editQuantitiesRef.current[returnId];
    delete editHullQuantitiesRef.current[returnId];

    setEditingId(null);
    setEditForm({});
  };

  // 행 수정 내용 저장 API 연동
  const handleSaveEdit = async (item: SeedGoodsReceiptReturnItemResponse) => {
    try {
      const finalReturnQty = editQuantitiesRef.current[item.returnId];
      const finalHullQty = editHullQuantitiesRef.current[item.returnId];

      if (finalReturnQty === '' || Number(finalReturnQty) <= 0) {
        window.alert('신고 수량을 입력해주세요.');
        return;
      }

      if (finalHullQty === '') {
        window.alert('껍질 수량을 입력해주세요.');
        return;
      }

      const returnQty = Number(finalReturnQty);
      const hullQty = Number(finalHullQty);

      if (Number.isNaN(hullQty)) {
        window.alert('껍질 수량은 숫자로 입력해주세요.');
        return;
      }

      if (hullQty < 0) {
        window.alert('껍질 수량은 0 이상으로 입력해주세요.');
        return;
      }

      if (hullQty > returnQty) {
        window.alert('껍질 수량은 신고 수량을 초과할 수 없습니다.');
        return;
      }

      const payload: SeedGoodsReceiptReturnUpdateRequest = {
        returnQty,
        hullQty,
        processStatus: item.processStatus,
        returnDueDate: editForm.returnDueDate ?? item.returnDueDate,
        reportDate: editForm.reportDate ?? item.reportDate,
      };

      await SeedGoodsReceiptReturnApi.update(item.returnId, payload);

      window.alert('성공적으로 수정되었습니다.');

      delete editQuantitiesRef.current[item.returnId];
      delete editHullQuantitiesRef.current[item.returnId];

      setEditingId(null);
      setEditForm({});

      await loadCompletedList();
      await loadPendingList();
    } catch (error) {
      console.error('씨드 신고반납 수정 실패:', error);
      window.alert('수정에 실패했습니다.');
    }
  };

  const handleApprove = async (item: SeedGoodsReceiptReturnItemResponse) => {
    const confirmed = window.confirm(`신고 ID [${item.returnId}] 건을 승인(신고완료) 처리하시겠습니까?`);
    if (!confirmed) return;

    try {
      await SeedGoodsReceiptReturnApi.update(item.returnId, {
        returnQty: item.returnQty,
        hullQty: item.hullQty,
        processStatus: 1,
        returnDueDate: item.returnDueDate,
        reportDate: item.reportDate,
      });
      window.alert('승인 처리되었습니다.');
      await loadCompletedList();
      await loadPendingList();
    } catch (error) {
      console.error('씨드 신고반납 승인 실패:', error);
      window.alert('승인 처리에 실패했습니다.');
    }
  };

  // 행 삭제 API 연동
  const handleDelete = async (item: SeedGoodsReceiptReturnItemResponse) => {
    const confirmed = window.confirm(`신고 ID [${item.returnId}] 건을 삭제하시겠습니까?`);
    if (!confirmed) return;

    try {
      await SeedGoodsReceiptReturnApi.delete(item.returnId);

      delete editQuantitiesRef.current[item.returnId];
      delete editHullQuantitiesRef.current[item.returnId];

      // 삭제한 건이 체크돼 있었다면 선택 목록에서도 제거
      setSelectedReturnIds((prev) => prev.filter((id) => id !== item.returnId));

      window.alert('성공적으로 삭제되었습니다.');
      await loadCompletedList();
      await loadPendingList();
    } catch (error) {
      console.error('씨드 신고반납 삭제 실패:', error);
      window.alert('삭제에 실패했습니다.');
    }
  };

  const completedColumns: ColumnDef<SeedGoodsReceiptReturnItemResponse>[] = useMemo(
    () => [
      // 맨 앞 체크박스 컬럼
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            className="seedCheckbox"
            aria-label="현재 페이지 전체 선택"
            checked={isAllSelectedOnPage}
            // 일부만 선택된 상태는 '-' 표시(indeterminate)
            ref={(el) => {
              if (el) el.indeterminate = isSomeSelectedOnPage;
            }}
            onChange={(e) => handleToggleAllOnPage(e.target.checked)}
          />
        ),
        cell: ({ row }) => {
          const { returnId } = row.original;

          return (
            <input
              type="checkbox"
              className="seedCheckbox"
              aria-label={`신고 ID ${returnId} 선택`}
              checked={selectedIdSet.has(returnId)}
              onChange={() => handleToggleRow(returnId)}
            />
          );
        },
        enableSorting: false, // 체크박스 컬럼은 정렬 대상 아님
      },
      {
        accessorKey: 'receiptBarcode',
        header: '입고 라벨',
        cell: ({ row }) => {
          const { receiptBarcode } = row.original;

          return (
            <div className="itemCell">
              <span className="itemCell__barcode">
                {receiptBarcode ?? '-'}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'returnQty',
        header: '신고수량',
        cell: ({ row }) => {
          const item = row.original;
          const isEditing = editingId === item.returnId;

          if (!isEditing) {
            return item.returnQty;
          }

          return (
            <input
              type="number"
              min={1}
              className="seedTableEditInput"
              defaultValue={
                editQuantitiesRef.current[item.returnId] ?? item.returnQty
              }
              onChange={(e) => {
                editQuantitiesRef.current[item.returnId] =
                  e.target.value === ''
                    ? ''
                    : Number(e.target.value);
              }}
            />
          );
        },
      },
      {
        accessorKey: 'hullQty',
        header: '껍질수량',
        cell: ({ row }) => {
          const item = row.original;
          const isEditing = editingId === item.returnId;

          if (!isEditing) {
            return item.hullQty;
          }

          return (
            <input
              type="number"
              min={0}
              max={
                editQuantitiesRef.current[item.returnId] ??
                item.returnQty
              }
              className="seedTableEditInput"
              defaultValue={
                editHullQuantitiesRef.current[item.returnId] ?? item.hullQty
              }
              onChange={(e) => {
                editHullQuantitiesRef.current[item.returnId] =
                  e.target.value === ''
                    ? ''
                    : Number(e.target.value);
              }}
            />
          );
        },
      },
      {
        accessorKey: 'reportDate',
        header: '신고일자',
        cell: ({ row }) => row.original.reportDate ?? '-',
      },
      {
        accessorKey: 'returnDueDate',
        header: '반납예정일',
        cell: ({ row }) => {
          const item = row.original;
          const isEditing = editingId === item.returnId;

          if (!isEditing) {
            return item.returnDueDate ?? '-';
          }

          return (
            <input
              type="date"
              className="seedTableEditInput"
              value={editForm.returnDueDate ?? ''}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  returnDueDate: e.target.value,
                }))
              }
            />
          );
        },
      },
      {
        accessorKey: 'processStatus',
        header: '상태',
        cell: () => (
          <Badge tone="good">
            <span className="seedDoneBadge">
              <span className="seedDoneDot" />
              신고완료
            </span>
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '관리',
        cell: ({ row }) => {
          const item = row.original;
          const isEditing = editingId === item.returnId;

          if (isEditing) {
            return (
              <div className="rowActions">
                <button
                  type="button"
                  className="miniButton"
                  onClick={() => handleSaveEdit(item)}
                >
                  저장
                </button>

                <button
                  type="button"
                  className="miniButton"
                  onClick={() => handleCancelEdit(item.returnId)}
                >
                  취소
                </button>
              </div>
            );
          }

          return (
            <div className="rowActions">
              <button
                type="button"
                className="miniButton"
                onClick={() => handleStartEdit(item)}
              >
                수정
              </button>

              <button
                type="button"
                className="miniButton danger"
                onClick={() => handleDelete(item)}
              >
                삭제
              </button>
            </div>
          );
        },
      },
    ],
    // 체크박스 관련 값들을 의존성에 추가 (선택이 바뀌면 컬럼을 다시 만들어 체크 표시 갱신)
    [
      editingId,
      editForm.returnDueDate,
      selectedIdSet,
      isAllSelectedOnPage,
      isSomeSelectedOnPage,
      handleToggleRow,
      handleToggleAllOnPage,
    ]
  );


  return (
    <section className="screenStack">
      <SearchBand
        fields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <Panel title="씨드 신고반납 관리 목록">
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="seedLoading">
              <Spinner />
            </div>
          ) : (
            <>
              {/* 요약칩 */}
              <div className="seedSummaryChips">
                <div className="seedSummaryChip seedSummaryChip--item">
                  <span className="seedSummaryChip__label">
                    {itemChipLabel}
                  </span>
                </div>

                <div className="seedSummaryChip">
                  <span className="seedSummaryChip__count is-pending">
                    {pendingTotalElements}
                  </span>
                  <span className="seedSummaryChip__label">
                    신고대기
                  </span>
                </div>

                <div className="seedSummaryChip">
                  <span className="seedSummaryChip__count is-done">
                    {totalElements}
                  </span>
                  <span className="seedSummaryChip__label">
                    신고완료
                  </span>
                </div>
              </div>

              <div className="seedReportSections">

                {/* 신고대기 */}
                <section className="seedReportSection">
                  <div className="seedSectionHeader">
                    <span className="seedSectionHeader__dot seedSectionHeader__dot--pending" />

                    <h2 className="seedSectionHeader__title">
                      신고대기 · 승인 필요
                    </h2>

                    <span className="seedSectionHeader__count">
                      {pendingTotalElements}
                    </span>
                  </div>

                  {pendingList.length === 0 ? (
                    <div className="seedEmptyState">
                      승인 대기 중인 신고가 없습니다.
                    </div>
                  ) : (
                    <>
                      <div className="seedPendingGrid">
                        {visiblePendingList.map((item) => {
                          const isEditing = editingId === item.returnId;

                          return (
                            <div
                              key={item.returnId}
                              className="seedPendingCard"
                            >
                              <div className="seedPendingCard__accent" />

                              <div className="seedPendingCard__body">

                                {/* 입고 라벨 / 입고일시 */}
                                <div className="seedPendingCard__receipt">
                                  <div className="seedPendingCard__barcode">
                                    {item.receiptBarcode ?? '-'}
                                  </div>

                                  <div className="seedPendingCard__receivedAt">
                                    입고 {item.receivedAt ? formatDateTime(item.receivedAt) : '-'}
                                  </div>
                                </div>

                                {isEditing ? (
                                  <>
                                    {/* 수정 모드 */}
                                    <div className="seedPendingEditGrid">

                                      <div className="seedPendingField">
                                        <div className="seedPendingField__label">
                                          신고수량
                                        </div>

                                        <input
                                          type="number"
                                          min={1}
                                          className="seedPendingInput"
                                          defaultValue={
                                            editQuantitiesRef.current[item.returnId] ??
                                            item.returnQty
                                          }
                                          onChange={(e) => {
                                            editQuantitiesRef.current[item.returnId] =
                                              e.target.value === ''
                                                ? ''
                                                : Number(e.target.value);
                                          }}
                                        />
                                      </div>

                                      <div className="seedPendingField">
                                        <div className="seedPendingField__label">
                                          껍질수량
                                        </div>

                                        <input
                                          type="number"
                                          min={0}
                                          max={
                                            editQuantitiesRef.current[item.returnId] ??
                                            item.returnQty
                                          }
                                          className="seedPendingInput"
                                          defaultValue={
                                            editHullQuantitiesRef.current[item.returnId] ??
                                            item.hullQty
                                          }
                                          onChange={(e) => {
                                            const value = e.target.value;

                                            editHullQuantitiesRef.current[item.returnId] =
                                              value === '' ? '' : Number(value);
                                          }}
                                        />
                                      </div>

                                      <div className="seedPendingField">
                                        <div className="seedPendingField__label">
                                          신고일자
                                        </div>

                                        <div className="seedPendingField__value">
                                          {item.reportDate ?? '-'}
                                        </div>
                                      </div>

                                      <div className="seedPendingField">
                                        <div className="seedPendingField__label">
                                          반납예정일
                                        </div>

                                        <input
                                          type="date"
                                          className="seedPendingInput"
                                          value={editForm.returnDueDate ?? ''}
                                          onChange={(e) =>
                                            setEditForm({
                                              ...editForm,
                                              returnDueDate: e.target.value,
                                            })
                                          }
                                        />
                                      </div>

                                    </div>

                                    <div className="seedPendingEditActions">
                                      <button
                                        type="button"
                                        className="seedPendingButton seedPendingButton--save"
                                        onClick={() => handleSaveEdit(item)}
                                      >
                                        저장
                                      </button>

                                      <button
                                        type="button"
                                        className="seedPendingButton seedPendingButton--cancel"
                                        onClick={() =>
                                          handleCancelEdit(item.returnId)
                                        }
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {/* 기본 표시 */}
                                    <div className="seedPendingStats">

                                      <div className="seedPendingStat">
                                        <div className="seedPendingStat__value">
                                          {item.returnQty}
                                        </div>
                                        <div className="seedPendingStat__label">
                                          신고수량
                                        </div>
                                      </div>

                                      <div className="seedPendingStat">
                                        <div className="seedPendingStat__value">
                                          {item.hullQty}
                                        </div>
                                        <div className="seedPendingStat__label">
                                          껍질수량
                                        </div>
                                      </div>

                                      <div className="seedPendingStat">
                                        <div className="seedPendingStat__value seedPendingStat__value--date">
                                          {item.reportDate
                                            ? item.reportDate.slice(5)
                                            : '-'}
                                        </div>
                                        <div className="seedPendingStat__label">
                                          신고일자
                                        </div>
                                      </div>

                                      <div className="seedPendingStat seedPendingStat--last">
                                        <div className="seedPendingStat__value seedPendingStat__value--date">
                                          {item.returnDueDate
                                            ? item.returnDueDate.slice(5)
                                            : '-'}
                                        </div>
                                        <div className="seedPendingStat__label">
                                          반납예정
                                        </div>
                                      </div>

                                    </div>

                                    <div className="seedPendingActions">
                                      <button
                                        type="button"
                                        className="seedPendingButton seedPendingButton--approve"
                                        onClick={() => handleApprove(item)}
                                      >
                                        ✓ 승인 처리
                                      </button>

                                      <button
                                        type="button"
                                        className="seedPendingButton seedPendingButton--edit"
                                        onClick={() => handleStartEdit(item)}
                                      >
                                        수정
                                      </button>

                                      <button
                                        type="button"
                                        className="seedPendingButton seedPendingButton--delete"
                                        onClick={() => handleDelete(item)}
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {pendingTotalElements > PENDING_PREVIEW_COUNT && (
                        <div className="seedPendingToggleWrap">
                          <button
                            type="button"
                            className="seedPendingToggle"
                            aria-expanded={pendingExpanded}
                            onClick={() =>
                              setPendingExpanded((prev) => !prev)
                            }
                          >
                            {pendingExpanded
                              ? '접기 ▴'
                              : `+${pendingHiddenCount}건 더보기 ▾`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </section>

                {/* 신고완료 */}
                <section className="seedReportSection">
                  <div className="seedSectionHeader">
                    <span className="seedSectionHeader__dot seedSectionHeader__dot--done" />

                    <h2 className="seedSectionHeader__title">
                      신고완료
                    </h2>

                    <span className="seedSectionHeader__count">
                      {totalElements}
                    </span>

                    {/* 제목 줄 오른쪽 끝: 선택한 건 파일 다운로드 버튼
                        (margin-left: auto 로 오른쪽 끝 정렬 -> Seed.css 의 .seedSectionHeader__actions) */}
                    <div className="seedSectionHeader__actions">
                      <button
                        type="button"
                        className="seedDownloadButton"
                        onClick={handleDownload}
                        disabled={selectedReturnIds.length === 0 || isDownloading}
                      >
                        {isDownloading
                          ? '다운로드 중...'
                          : selectedReturnIds.length > 0
                            ? `파일 다운로드 (${selectedReturnIds.length})`
                            : '파일 다운로드'}
                      </button>
                    </div>
                  </div>

                  <div className="seedCompletedTable">
                    <CusTable
                      data={completedList}
                      columns={completedColumns}
                      sorting={sorting}
                      onSortingChange={setSorting}
                      noDataMessage="신고완료된 데이터가 없습니다."
                    />
                  </div>

                  <CusPagination
                    page={page}
                    totalPages={totalPages}
                    totalCount={totalElements}
                    onPageChange={handlePageChange}
                  />
                </section>

              </div>
            </>
          )}
        </div>
      </Panel>
    </section>
  );
}
