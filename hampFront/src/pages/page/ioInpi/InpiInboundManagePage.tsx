import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { QrLabelPrintModal, type QrLabelItem } from '@/components/modal/QrLabelPrintModal'
import { Badge } from '@/components/common/Badge'
import Spinner from '@/components/common/Spinner'
import { formatDateTime } from '@/utils/common'
import { FiberReceiptApi, type FiberReceiptListParams, type FiberReceiptResponse } from '@/api/ioInpi/FiberReceipt'
import { BusinessPartnerApi, type BusinessPartnerOptionResponse } from '@/api/sales/BusinessPartner'
import { ItemApi, type ItemOptionResponse } from '@/api/master/Item'
import { FiberReceiptFormModal } from '@/pages/page/ioInpi/FiberReceiptFormModal'
import '@components/table/Custable.css'
import '@/pages/page/ioInpi/ioInpi.css'

const PAGE_SIZE = 10
/** 헤더 정렬을 고르지 않았을 때의 기본 정렬 */
const DEFAULT_SORT = 'createdAt,desc'

/** 라벨 인쇄여부 필터 값 ('' = 전체) */
type LabelPrintedFilter = '' | 'true' | 'false'

type Filters = {
  receiptLotCode: string
  bpCode: string
  orderCode: string
  rawItemCode: string
  labelPrinted: LabelPrintedFilter
  receivedAtFrom: string
  receivedAtTo: string
}

const EMPTY_FILTERS: Filters = {
  receiptLotCode: '',
  bpCode: '',
  orderCode: '',
  rawItemCode: '',
  labelPrinted: '',
  receivedAtFrom: '',
  receivedAtTo: '',
}

const LABEL_PRINTED_OPTIONS: { value: LabelPrintedFilter; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'false', label: '미인쇄' },
  { value: 'true', label: '인쇄완료' },
]

type TabCounts = Record<LabelPrintedFilter, number>

type ListRequest = {
  filters: Filters
  page: number
  sortParams: string[]
  refreshKey: number
}

type ListResult = {
  request: ListRequest
  rows: FiberReceiptResponse[]
  totalElements: number
  totalPages: number
  failed: boolean
}

type CountRequest = Filters & { refreshKey: number }

type CountResult = {
  request: CountRequest
  counts: TabCounts | null
}

/** 화면 필터 → GET /fiber-receipts 쿼리 파라미터 (빈 값 제외) */
function toListParams(filters: Filters, labelPrinted: LabelPrintedFilter): FiberReceiptListParams {
  const params: FiberReceiptListParams = {}
  if (filters.receiptLotCode) params.receiptLotCode = filters.receiptLotCode
  if (filters.bpCode) params.bpCode = filters.bpCode
  if (filters.orderCode) params.orderCode = filters.orderCode
  if (filters.rawItemCode) params.rawItemCode = filters.rawItemCode
  if (labelPrinted) params.labelPrinted = labelPrinted === 'true'
  if (filters.receivedAtFrom) params.receivedAtFrom = filters.receivedAtFrom
  if (filters.receivedAtTo) params.receivedAtTo = filters.receivedAtTo
  return params
}

function formatWeight(value: number) {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

function getErrorMessage(error: unknown, fallback: string) {
  const message = axios.isAxiosError(error) ? error.response?.data?.message : null
  return typeof message === 'string' && message ? message : fallback
}

export function InpiInboundManagePage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)

  const [sorting, setSorting] = useState<SortingState>([])
  const sortParams = useMemo(() => sorting.map((sort) => `${sort.id},${sort.desc ? 'desc' : 'asc'}`), [sorting])

  // refreshKey: 등록·수정·삭제 후 재조회 트리거
  const [refreshKey, setRefreshKey] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<FiberReceiptResponse | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const detailRequestRef = useRef(0)
  const deletingRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const [listResult, setListResult] = useState<ListResult | null>(null)
  const [countResult, setCountResult] = useState<CountResult | null>(null)

  const [selectedReceipts, setSelectedReceipts] = useState<FiberReceiptResponse[]>([])
  const selectedIds = useMemo(() => selectedReceipts.map((receipt) => receipt.receiptId), [selectedReceipts])
  const [isLabelOpen, setIsLabelOpen] = useState(false)
  const [isMarkingPrinted, setIsMarkingPrinted] = useState(false)

  const [bpOptions, setBpOptions] = useState<BusinessPartnerOptionResponse[]>([])
  const [itemOptions, setItemOptions] = useState<ItemOptionResponse[]>([])

  const receiptLotCodeRef = useRef<HTMLInputElement>(null)
  const orderCodeRef = useRef<HTMLInputElement>(null)
  const bpCodeRef = useRef<HTMLSelectElement>(null)
  const rawItemCodeRef = useRef<HTMLSelectElement>(null)
  const receivedAtFromRef = useRef<HTMLInputElement>(null)
  const receivedAtToRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let ignore = false
    Promise.allSettled([BusinessPartnerApi.getOptions(), ItemApi.getOptions({ productType: 1, category: [0] })]).then(
      ([bpRes, itemRes]) => {
        if (ignore) return
        if (bpRes.status === 'fulfilled') setBpOptions(bpRes.value.data ?? [])
        if (itemRes.status === 'fulfilled') setItemOptions(itemRes.value.data ?? [])
        const failed = [bpRes, itemRes].find((res): res is PromiseRejectedResult => res.status === 'rejected')
        if (failed) {
          console.error('인피 입고 검색 옵션 조회 실패:', failed.reason)
          window.alert(getErrorMessage(failed.reason, '검색 옵션을 불러오지 못했습니다.'))
        }
      },
    )
    return () => {
      ignore = true
    }
  }, [])

  const listRequest = useMemo<ListRequest>(
    () => ({ filters, page, sortParams, refreshKey }),
    [filters, page, sortParams, refreshKey],
  )

  useEffect(() => {
    let ignore = false
    FiberReceiptApi.getList({
      ...toListParams(listRequest.filters, listRequest.filters.labelPrinted),
      page: listRequest.page,
      size: PAGE_SIZE,
      sort: listRequest.sortParams.length > 0 ? listRequest.sortParams : DEFAULT_SORT,
    })
      .then((res) => {
        if (ignore) return
        const content = res.data?.content ?? []
        const totalPages = res.data?.totalPages ?? 0
        const lastValidPage = Math.max(0, totalPages - 1)
        // 인쇄완료·수정·삭제 등으로 현재 페이지가 비면 마지막 유효 페이지(0건이면 0페이지)로 자동 이동한다
        if (content.length === 0 && listRequest.page > lastValidPage) {
          setPage(lastValidPage)
          return
        }
        // 선택해 둔 입고는 재조회된 최신 값으로 바꿔 라벨에 옛 값이 찍히지 않게 한다
        const latest = new Map(content.map((row) => [row.receiptId, row]))
        setSelectedReceipts((prev) =>
          prev.some((receipt) => latest.has(receipt.receiptId))
            ? prev.map((receipt) => latest.get(receipt.receiptId) ?? receipt)
            : prev,
        )
        setListResult({
          request: listRequest,
          rows: content,
          totalElements: res.data?.totalElements ?? 0,
          totalPages,
          failed: false,
        })
      })
      .catch((error) => {
        if (ignore) return
        console.error('인피 입고 목록 조회 실패:', error)
        setListResult({ request: listRequest, rows: [], totalElements: 0, totalPages: 0, failed: true })
        window.alert(getErrorMessage(error, '인피 입고 목록을 불러오지 못했습니다.'))
      })
    return () => {
      ignore = true
    }
  }, [listRequest])

  // 탭 건수는 라벨 인쇄여부를 뺀 검색 조건 기준
  const { labelPrinted: activeTab, receiptLotCode, bpCode, orderCode, rawItemCode, receivedAtFrom, receivedAtTo } = filters
  const countRequest = useMemo<CountRequest>(
    () => ({ receiptLotCode, bpCode, orderCode, rawItemCode, labelPrinted: '', receivedAtFrom, receivedAtTo, refreshKey }),
    [receiptLotCode, bpCode, orderCode, rawItemCode, receivedAtFrom, receivedAtTo, refreshKey],
  )

  useEffect(() => {
    let ignore = false
    const countOf = (labelPrinted: LabelPrintedFilter) =>
      FiberReceiptApi.getList({ ...toListParams(countRequest, labelPrinted), page: 0, size: 1 }).then(
        (res) => res.data?.totalElements ?? 0,
      )

    // LABEL_PRINTED_YN NOT NULL → 전체 = 미인쇄 + 인쇄완료
    Promise.all([countOf('false'), countOf('true')])
      .then(([notPrinted, printed]) => {
        if (ignore) return
        setCountResult({ request: countRequest, counts: { '': notPrinted + printed, false: notPrinted, true: printed } })
      })
      .catch((error) => {
        if (ignore) return
        console.error('인피 입고 탭 건수 조회 실패:', error)
        setCountResult({ request: countRequest, counts: null })
      })
    return () => {
      ignore = true
    }
  }, [countRequest])

  const isLoading = listResult?.request !== listRequest
  const listFailed = !isLoading && listResult.failed
  const rows = useMemo(() => listResult?.rows ?? [], [listResult])
  const totalElements = listResult?.totalElements ?? 0
  const totalPages = listResult?.totalPages ?? 0
  const countLoaded = countResult?.request === countRequest
  const tabCounts = countLoaded ? countResult.counts : null
  const countFailed = countLoaded && countResult.counts === null

  const handleCreated = () => {
    setIsCreateOpen(false)
    setPage(0)
    setRefreshKey((key) => key + 1)
  }

  const handleOpenCreate = () => {
    detailRequestRef.current += 1
    setIsCreateOpen(true)
  }

  const handleEdited = (saved?: FiberReceiptResponse) => {
    // 수정 후 정렬·필터로 현재 페이지를 벗어나더라도 선택 라벨에 최신 값이 찍히도록 즉시 반영
    if (saved) {
      setSelectedReceipts((prev) =>
        prev.some((receipt) => receipt.receiptId === saved.receiptId)
          ? prev.map((receipt) => (receipt.receiptId === saved.receiptId ? saved : receipt))
          : prev,
      )
    }
    setEditingReceipt(null)
    setRefreshKey((key) => key + 1)
  }

  const openDetail = useCallback((receiptId: number) => {
    if (deletingRef.current) return
    const requestId = ++detailRequestRef.current
    FiberReceiptApi.getDetail(receiptId)
      .then((res) => {
        if (!mountedRef.current || requestId !== detailRequestRef.current) return
        setEditingReceipt(res.data)
      })
      .catch((error) => {
        if (!mountedRef.current || requestId !== detailRequestRef.current) return
        console.error('인피 입고 단건 조회 실패:', error)
        window.alert(getErrorMessage(error, '입고 정보를 불러오지 못했습니다.'))
      })
  }, [])

  /** 확인 후 삭제. 삭제했으면 true */
  const deleteReceipt = useCallback(
    async (target: FiberReceiptResponse) => {
      if (deletingRef.current) return false
      const unit = target.unit ?? 'kg'
      const message =
        `${target.receiptLotCode} 입고 건을 삭제할까요?\n원료 재고에서 ${formatWeight(Number(target.receiptQty ?? 0))} ${unit}이 차감됩니다.` +
        (target.labelPrinted ? '\n이미 라벨이 인쇄된 입고입니다. 붙어 있는 라벨을 회수해 주세요.' : '')
      if (!window.confirm(message)) return false

      detailRequestRef.current += 1
      deletingRef.current = true
      setDeletingId(target.receiptId)
      try {
        const res = await FiberReceiptApi.delete(target.receiptId)
        window.alert(res.message || '삭제되었습니다.')
        setSelectedReceipts((prev) => prev.filter((receipt) => receipt.receiptId !== target.receiptId))
        if (rows.length === 1 && page > 0) setPage(page - 1)
        setRefreshKey((key) => key + 1)
        return true
      } catch (error) {
        console.error('인피 입고 삭제 실패:', error)
        window.alert(getErrorMessage(error, '삭제에 실패했습니다.'))
        return false
      } finally {
        deletingRef.current = false
        setDeletingId(null)
      }
    },
    [rows.length, page],
  )

  const handleModalDelete = async (target: FiberReceiptResponse) => {
    const deleted = await deleteReceipt(target)
    if (deleted) setEditingReceipt(null)
    return deleted
  }

  const handleSortChange = (next: SortingState) => {
    setSorting(next)
    setPage(0)
  }

  const applyFilters = (next: Filters) => {
    setFilters(next)
    setPage(0)
    setSelectedReceipts([]) // 검색 조건이 바뀌면 선택 초기화
  }

  const handleSearch = () => {
    applyFilters({
      receiptLotCode: receiptLotCodeRef.current?.value.trim() ?? '',
      bpCode: bpCodeRef.current?.value ?? '',
      orderCode: orderCodeRef.current?.value.trim() ?? '',
      rawItemCode: rawItemCodeRef.current?.value ?? '',
      labelPrinted: filters.labelPrinted,
      receivedAtFrom: receivedAtFromRef.current?.value ?? '',
      receivedAtTo: receivedAtToRef.current?.value ?? '',
    })
  }

  const handleReset = () => {
    applyFilters(EMPTY_FILTERS)
    setSorting([])
  }

  const handleTabChange = (labelPrinted: LabelPrintedFilter) => {
    if (labelPrinted === filters.labelPrinted) return
    applyFilters({ ...filters, labelPrinted })
  }

  const searchFields: SearchField[] = [
    { type: 'input', label: '입고 LOT', ref: receiptLotCodeRef, name: 'receiptLotCode', placeholder: 'FR-20261125', value: filters.receiptLotCode },
    { type: 'input', label: '수주코드', ref: orderCodeRef, name: 'orderCode', placeholder: 'SO-', value: filters.orderCode },
    {
      type: 'select',
      label: '거래처',
      ref: bpCodeRef,
      name: 'bpCode',
      options: [{ value: '', label: '전체' }, ...bpOptions.map((bp) => ({ value: bp.bpCode, label: bp.bpNm }))],
      value: filters.bpCode,
    },
    {
      type: 'select',
      label: '원료 품목',
      ref: rawItemCodeRef,
      name: 'rawItemCode',
      options: [
        { value: '', label: '전체' },
        ...itemOptions.map((item) => ({ value: item.itemCode, label: `${item.itemNm} (${item.itemCode})` })),
      ],
      value: filters.rawItemCode,
    },
    {
      type: 'date',
      label: '입고일자',
      startRef: receivedAtFromRef,
      endRef: receivedAtToRef,
      name: 'receivedAt',
      startValue: filters.receivedAtFrom,
      endValue: filters.receivedAtTo,
    },
  ]

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const isAllSelectedOnPage = rows.length > 0 && rows.every((row) => selectedIdSet.has(row.receiptId))
  const isSomeSelectedOnPage = !isAllSelectedOnPage && rows.some((row) => selectedIdSet.has(row.receiptId))

  const handleToggleRow = useCallback((target: FiberReceiptResponse) => {
    setSelectedReceipts((prev) =>
      prev.some((receipt) => receipt.receiptId === target.receiptId)
        ? prev.filter((receipt) => receipt.receiptId !== target.receiptId)
        : [...prev, target],
    )
  }, [])

  const handleToggleAllOnPage = useCallback(
    (checked: boolean) => {
      const pageIds = new Set(rows.map((row) => row.receiptId))
      setSelectedReceipts((prev) => {
        const rest = prev.filter((receipt) => !pageIds.has(receipt.receiptId))
        return checked ? [...rest, ...rows] : rest
      })
    },
    [rows],
  )

  const pageWeightSum = rows.reduce((sum, row) => sum + Number(row.receiptQty ?? 0), 0)

  const columns: ColumnDef<FiberReceiptResponse>[] = useMemo(
    () => [
      {
        id: 'select',
        meta: { width: '44px' },
        enableSorting: false,
        header: () => (
          <input
            type="checkbox"
            className="checkbox"
            aria-label="현재 페이지 전체 선택"
            checked={isAllSelectedOnPage}
            ref={(el) => {
              if (el) el.indeterminate = isSomeSelectedOnPage
            }}
            onChange={(e) => handleToggleAllOnPage(e.target.checked)}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="checkbox"
            aria-label={`${row.original.receiptLotCode} 선택`}
            checked={selectedIdSet.has(row.original.receiptId)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => handleToggleRow(row.original)}
          />
        ),
      },
      {
        accessorKey: 'receiptLotCode',
        header: '입고 LOT',
        cell: ({ row }) => <span className="inpiLotCode">{row.original.receiptLotCode}</span>,
      },
      {
        accessorKey: 'bpNm',
        header: '거래처',
        cell: ({ row }) => (
          <>
            {row.original.bpNm ?? row.original.bpCode}
            <span className="inpiSub">{row.original.bpCode}</span>
          </>
        ),
      },
      {
        accessorKey: 'orderCode',
        header: '수주코드',
        cell: ({ row }) => row.original.orderCode || <Badge tone="info">수주 미연결</Badge>,
      },
      {
        accessorKey: 'rawItemNm',
        header: '원료 품목',
        cell: ({ row }) => (
          <>
            {row.original.rawItemNm ?? row.original.rawItemCode}
            <span className="inpiSub">{row.original.rawItemCode}</span>
          </>
        ),
      },
      {
        accessorKey: 'receiptQty',
        header: () => <span className="inpiNum">입고 중량</span>,
        cell: ({ row }) => (
          <span className="inpiNum">
            {formatWeight(Number(row.original.receiptQty ?? 0))} {row.original.unit ?? 'kg'}
          </span>
        ),
      },
      {
        accessorKey: 'storId',
        header: '보관 창고',
        cell: ({ row }) => row.original.storId || '-',
      },
      {
        accessorKey: 'receivedAt',
        header: '입고일시',
        cell: ({ row }) => (row.original.receivedAt ? formatDateTime(row.original.receivedAt) : '-'),
      },
      {
        accessorKey: 'receivedBy',
        header: '처리자',
        cell: ({ row }) => row.original.receivedBy || '-',
      },
      {
        accessorKey: 'labelPrinted',
        header: '라벨',
        cell: ({ row }) =>
          row.original.labelPrinted ? <Badge tone="good">인쇄완료</Badge> : <Badge tone="muted">미인쇄</Badge>,
      },
      {
        id: 'actions',
        header: '관리',
        enableSorting: false,
        meta: { width: '150px' },
        cell: ({ row }) => (
          <div className="rowActions">
            <button
              type="button"
              className="miniButton"
              onClick={(e) => {
                e.stopPropagation()
                openDetail(row.original.receiptId)
              }}
            >
              상세
            </button>
            <button
              type="button"
              className="miniButton danger"
              disabled={deletingId === row.original.receiptId}
              onClick={(e) => {
                e.stopPropagation()
                void deleteReceipt(row.original)
              }}
            >
              삭제
            </button>
          </div>
        ),
      },
    ],
    [
      selectedIdSet,
      isAllSelectedOnPage,
      isSomeSelectedOnPage,
      handleToggleRow,
      handleToggleAllOnPage,
      openDetail,
      deleteReceipt,
      deletingId,
    ],
  )

  // 입고 1건당 라벨 1장, QR 값은 입고 LOT
  const labelItems: QrLabelItem[] = useMemo(
    () =>
      selectedReceipts.map((receipt) => ({
        id: String(receipt.receiptId),
        qrValue: receipt.receiptLotCode,
        title: [receipt.receiptLotCode, receipt.bpNm ?? receipt.bpCode, receipt.orderCode].filter(Boolean).join(' · '),
        name: receipt.rawItemNm ?? receipt.rawItemCode,
        code: receipt.rawItemCode,
        qty: Number(receipt.receiptQty ?? 0),
        qtyLabel: '입고중량',
        unit: receipt.unit ?? 'kg',
      })),
    [selectedReceipts],
  )

  // 인쇄창에서 취소해도 afterprint가 오므로 정상 출력 여부를 한 번 더 확인한다
  const handlePrinted = async () => {
    const targetIds = selectedIds
    if (targetIds.length === 0) return
    if (!window.confirm(`라벨이 정상 출력됐나요?
[확인]을 누르면 선택한 ${targetIds.length}건이 인쇄완료로 바뀝니다.`)) return

    setIsMarkingPrinted(true)
    try {
      await FiberReceiptApi.markPrinted(targetIds)
      if (!mountedRef.current) return
      window.alert('라벨 인쇄 완료로 표시했습니다.')
      setIsLabelOpen(false)
      setSelectedReceipts([])
      setRefreshKey((key) => key + 1)
    } catch (error) {
      if (!mountedRef.current) return
      console.error('인피 입고 라벨 인쇄 완료 표시 실패:', error)
      window.alert(getErrorMessage(error, '라벨 인쇄 완료 표시에 실패했습니다.'))
    } finally {
      if (mountedRef.current) setIsMarkingPrinted(false)
    }
  }

  const panelActions = (
    <div className="inpiPanelActions">
      <button
        type="button"
        className="ghostButton"
        disabled={selectedIds.length === 0}
        onClick={() => {
          detailRequestRef.current += 1
          setIsLabelOpen(true)
        }}
      >
        선택 라벨 인쇄 ({selectedIds.length}건)
      </button>
      {selectedIds.length > 0 && (
        <button type="button" className="inpiPlainButton" onClick={() => setSelectedReceipts([])}>
          선택 해제
        </button>
      )}
      <button type="button" className="primaryButton" onClick={handleOpenCreate}>
        등록
      </button>
    </div>
  )

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="인피 입고 목록" action={panelActions}>
        <div className="inpiListBar">
          <div className="inpiTabs" role="group" aria-label="라벨 인쇄여부 빠른 필터">
            {LABEL_PRINTED_OPTIONS.map((option) => (
              <button
                key={option.value || 'all'}
                type="button"
                className="inpiTab"
                aria-pressed={activeTab === option.value}
                title={countFailed ? '건수를 불러오지 못했습니다.' : undefined}
                onClick={() => handleTabChange(option.value)}
              >
                {option.label}
                <b>{tabCounts ? tabCounts[option.value].toLocaleString() : '-'}</b>
              </button>
            ))}
          </div>
          <span className="inpiSum">
            현재 페이지 합계 중량 <b>{formatWeight(pageWeightSum)}</b> kg
          </span>
        </div>

        <div className="inpiListBody">
          {isLoading && (
            <div className="inpiLoading">
              <Spinner />
            </div>
          )}
          <CusTable
            data={rows}
            columns={columns}
            sorting={sorting}
            onSortingChange={handleSortChange}
            onRowClick={(row) => openDetail(row.receiptId)}
            noDataMessage={
              isLoading ? '' : listFailed ? '입고 목록을 불러오지 못했습니다.' : '조건에 맞는 입고 건이 없습니다.'
            }
          />
        </div>

        <CusPagination page={page} totalPages={totalPages} totalCount={totalElements} onPageChange={setPage} />
      </Panel>

      <QrLabelPrintModal
        isOpen={isLabelOpen}
        onClose={() => setIsLabelOpen(false)}
        items={labelItems}
        modalTitle={`라벨 인쇄 미리보기 (${labelItems.length}건)`}
        onPrinted={handlePrinted}
        isBusy={isMarkingPrinted}
      />

      {isCreateOpen && (
        <FiberReceiptFormModal
          bpOptions={bpOptions}
          itemOptions={itemOptions}
          onClose={() => setIsCreateOpen(false)}
          onSaved={handleCreated}
        />
      )}

      {editingReceipt && (
        <FiberReceiptFormModal
          key={editingReceipt.receiptId}
          bpOptions={bpOptions}
          itemOptions={itemOptions}
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSaved={handleEdited}
          onDelete={handleModalDelete}
        />
      )}
    </section>
  )
}
