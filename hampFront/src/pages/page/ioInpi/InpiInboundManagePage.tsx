import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { Badge } from '@/components/common/Badge'
import Spinner from '@/components/common/Spinner'
import { formatDateTime } from '@/utils/common'
import { FiberReceiptApi, type FiberReceiptListParams, type FiberReceiptResponse } from '@/api/ioInpi/FiberReceipt'
import { BusinessPartnerApi, type BusinessPartnerOptionResponse } from '@/api/sales/BusinessPartner'
import { ItemApi, type ItemOptionResponse } from '@/api/master/Item'
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
}

type ListResult = {
  request: ListRequest
  rows: FiberReceiptResponse[]
  totalElements: number
  totalPages: number
  failed: boolean
}

type CountResult = {
  request: Filters
  counts: TabCounts | null
}

function toLabelPrintedFilter(value: string | undefined): LabelPrintedFilter {
  return value === 'true' || value === 'false' ? value : ''
}

/** 화면 필터 → GET /fiber-receipts 쿼리 파라미터 (빈 값은 보내지 않음) */
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

const notReady = () => window.alert('준비 중인 기능입니다.')

export function InpiInboundManagePage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)

  // 필터·페이지처럼 정렬도 화면 상태로만 관리한다 (주소창에 남기지 않음)
  const [sorting, setSorting] = useState<SortingState>([])
  const sortParams = useMemo(() => sorting.map((sort) => `${sort.id},${sort.desc ? 'desc' : 'asc'}`), [sorting])

  const [listResult, setListResult] = useState<ListResult | null>(null)
  const [countResult, setCountResult] = useState<CountResult | null>(null)

  // 페이지를 넘겨도 선택이 유지되도록 receiptId 전체 기준으로 관리
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const [bpOptions, setBpOptions] = useState<BusinessPartnerOptionResponse[]>([])
  const [itemOptions, setItemOptions] = useState<ItemOptionResponse[]>([])

  const receiptLotCodeRef = useRef<HTMLInputElement>(null)
  const orderCodeRef = useRef<HTMLInputElement>(null)
  const bpCodeRef = useRef<HTMLSelectElement>(null)
  const rawItemCodeRef = useRef<HTMLSelectElement>(null)
  const labelPrintedRef = useRef<HTMLSelectElement>(null)
  const receivedAtFromRef = useRef<HTMLInputElement>(null)
  const receivedAtToRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let ignore = false
    // 한쪽 옵션 조회가 실패해도 다른 쪽은 표시되도록 따로 반영
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

  // 응답마다 어떤 요청의 결과인지 같이 들고 있다가, 현재 요청과 다르면 로딩 중으로 본다
  const listRequest = useMemo(() => ({ filters, page, sortParams }), [filters, page, sortParams])

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
        setListResult({
          request: listRequest,
          rows: res.data?.content ?? [],
          totalElements: res.data?.totalElements ?? 0,
          totalPages: res.data?.totalPages ?? 0,
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

  // 탭 건수는 라벨 인쇄여부를 뺀 나머지 검색 조건 기준 (탭을 바꿔도 다시 세지 않음)
  const { labelPrinted: activeTab, receiptLotCode, bpCode, orderCode, rawItemCode, receivedAtFrom, receivedAtTo } = filters
  const countRequest = useMemo<Filters>(
    () => ({ receiptLotCode, bpCode, orderCode, rawItemCode, labelPrinted: '', receivedAtFrom, receivedAtTo }),
    [receiptLotCode, bpCode, orderCode, rawItemCode, receivedAtFrom, receivedAtTo],
  )

  useEffect(() => {
    let ignore = false
    const countOf = (labelPrinted: LabelPrintedFilter) =>
      FiberReceiptApi.getList({ ...toListParams(countRequest, labelPrinted), page: 0, size: 1 }).then(
        (res) => res.data?.totalElements ?? 0,
      )

    // 라벨 인쇄여부는 NOT NULL이라 전체 = 미인쇄 + 인쇄완료
    Promise.all([countOf('false'), countOf('true')])
      .then(([notPrinted, printed]) => {
        if (ignore) return
        setCountResult({ request: countRequest, counts: { '': notPrinted + printed, false: notPrinted, true: printed } })
      })
      .catch((error) => {
        // 건수만 실패하면 알림 없이 '-'로 표시하고 탭에 사유를 툴팁으로 남긴다
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

  const handleSortChange = (next: SortingState) => {
    setSorting(next)
    setPage(0)
  }

  const applyFilters = (next: Filters) => {
    setFilters(next)
    setPage(0)
    setSelectedIds([]) // 검색 조건이 바뀌면 선택 초기화
  }

  const handleSearch = () => {
    applyFilters({
      receiptLotCode: receiptLotCodeRef.current?.value.trim() ?? '',
      bpCode: bpCodeRef.current?.value ?? '',
      orderCode: orderCodeRef.current?.value.trim() ?? '',
      rawItemCode: rawItemCodeRef.current?.value ?? '',
      labelPrinted: toLabelPrintedFilter(labelPrintedRef.current?.value),
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

  // 검색 밴드는 적용된 조건을 그대로 보여준다 (탭으로 바꾼 라벨 인쇄여부도 반영)
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
      type: 'select',
      label: '라벨 인쇄여부',
      ref: labelPrintedRef,
      name: 'labelPrinted',
      options: LABEL_PRINTED_OPTIONS,
      value: filters.labelPrinted,
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

  const handleToggleRow = useCallback((receiptId: number) => {
    setSelectedIds((prev) => (prev.includes(receiptId) ? prev.filter((id) => id !== receiptId) : [...prev, receiptId]))
  }, [])

  const handleToggleAllOnPage = useCallback(
    (checked: boolean) => {
      const pageIds = rows.map((row) => row.receiptId)
      setSelectedIds((prev) =>
        checked ? Array.from(new Set([...prev, ...pageIds])) : prev.filter((id) => !pageIds.includes(id)),
      )
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
            onChange={() => handleToggleRow(row.original.receiptId)}
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
        cell: () => (
          <div className="rowActions">
            <button type="button" className="miniButton" onClick={notReady}>
              상세
            </button>
            <button type="button" className="miniButton danger" onClick={notReady}>
              삭제
            </button>
          </div>
        ),
      },
    ],
    [selectedIdSet, isAllSelectedOnPage, isSomeSelectedOnPage, handleToggleRow, handleToggleAllOnPage],
  )

  const panelActions = (
    <div className="inpiPanelActions">
      <button type="button" className="ghostButton" disabled={selectedIds.length === 0} onClick={notReady}>
        선택 라벨 인쇄 ({selectedIds.length}건)
      </button>
      {selectedIds.length > 0 && (
        <button type="button" className="inpiPlainButton" onClick={() => setSelectedIds([])}>
          선택 해제
        </button>
      )}
      <button type="button" className="primaryButton" onClick={notReady}>
        등록
      </button>
    </div>
  )

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="인피 입고 목록" action={panelActions}>
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
            noDataMessage={
              isLoading ? '' : listFailed ? '입고 목록을 불러오지 못했습니다.' : '조건에 맞는 입고 건이 없습니다.'
            }
          />
        </div>

        <div className="inpiListFooter">
          <span className="inpiSum">
            현재 페이지 합계 중량 <b>{formatWeight(pageWeightSum)}</b> kg
          </span>
        </div>
        <CusPagination page={page} totalPages={totalPages} totalCount={totalElements} onPageChange={setPage} />
      </Panel>
    </section>
  )
}
