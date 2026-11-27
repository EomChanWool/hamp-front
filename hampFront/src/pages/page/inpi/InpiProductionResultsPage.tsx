import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { ArrowDownTrayIcon, ClockIcon, CubeIcon } from '@heroicons/react/24/outline'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '@components/card/Panel'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { Badge } from '@/components/common/Badge'
import Spinner from '@/components/common/Spinner'
import { ItemApi, type ItemOptionResponse } from '@/api/master/Item'
import {
  FiberWorkOrderApi,
  type FiberWorkOrderDetailResponse,
  type FiberWorkOrderResponse,
} from '@/api/FiberWorkOrder'
import {
  FiberWorkPerformanceApi,
  type FiberWorkPerformanceListParams,
  type FiberWorkPerformanceResponse,
} from '@/api/inpi/FiberWorkPerformance'
import { FiberPerformanceModal } from '@/pages/page/inpi/FiberPerformanceModal'
import { FiberWorkOrderCompleteModal } from '@/pages/page/inpi/FiberWorkOrderCompleteModal'
import { formatKg, formatNum } from '@/pages/page/inpi/inpiPerfUtils'
import { FIBER_WO_STATUS_LABEL, FIBER_WO_STATUS_TONE, getErrorMessage } from '@/utils/fiberWorkOrder'
import { formatDateTime } from '@/utils/common'
import { FIBER_PRODUCT_ITEM_CATEGORY } from '@/utils/fiberSalesOrderAllocation'
import '@components/table/Custable.css'
import '@/pages/page/inpi/InpiProductionResults.css'

const PAGE_SIZE = 10
const DEFAULT_SORT = 'createdAt,desc'
const RECENT_DAYS = 7
const RECENT_FETCH_SIZE = 1000
const PRODUCT_BAR_COLORS = ['var(--primary)', '#6b8de3', '#e7a94b', '#b07ad9']

type Filters = {
  workDateFrom: string
  workDateTo: string
  workId: string
  orderCode: string
  productItemCode: string
  productLotCode: string
}

const EMPTY_FILTERS: Filters = {
  workDateFrom: '',
  workDateTo: '',
  workId: '',
  orderCode: '',
  productItemCode: '',
  productLotCode: '',
}

type ListRequest = {
  filters: Filters
  page: number
  sortParams: string[]
  refreshKey: number
}

type ListResult = {
  request: ListRequest
  rows: FiberWorkPerformanceResponse[]
  totalElements: number
  totalPages: number
  failed: boolean
}

function buildRecentDays(count: number): string[] {
  const days: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const pad = (n: number) => String(n).padStart(2, '0')
    days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
  }
  return days
}

function formatElapsed(startAt: string | null): string {
  if (!startAt) return ''
  const diffMs = Date.now() - new Date(startAt).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return ''
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}분째`
  if (mins < 1440) return `${Math.floor(mins / 60)}시간 ${mins % 60}분째`
  return `${Math.floor(mins / 1440)}일 ${Math.floor((mins % 1440) / 60)}시간째`
}

function toListParams(filters: Filters): FiberWorkPerformanceListParams {
  const params: FiberWorkPerformanceListParams = {}
  if (filters.workDateFrom) params.workDateFrom = filters.workDateFrom
  if (filters.workDateTo) params.workDateTo = filters.workDateTo
  if (filters.workId) params.workId = filters.workId
  if (filters.orderCode) params.orderCode = filters.orderCode
  if (filters.productItemCode) params.productItemCode = filters.productItemCode
  if (filters.productLotCode) params.productLotCode = filters.productLotCode
  return params
}

export function InpiProductionResultsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [sorting, setSorting] = useState<SortingState>([])
  const sortParams = useMemo(() => sorting.map((s) => `${s.id},${s.desc ? 'desc' : 'asc'}`), [sorting])
  const [refreshKey, setRefreshKey] = useState(0)

  const [productOptions, setProductOptions] = useState<ItemOptionResponse[]>([])
  const [runningResult, setRunningResult] = useState<{
    refreshKey: number
    items: FiberWorkOrderDetailResponse[]
    failed: boolean
  } | null>(null)
  const [recentResult, setRecentResult] = useState<{
    refreshKey: number
    days: string[]
    items: FiberWorkPerformanceResponse[]
    failed: boolean
  } | null>(null)
  const [listResult, setListResult] = useState<ListResult | null>(null)

  const [creatingWorkDetail, setCreatingWorkDetail] = useState<FiberWorkOrderDetailResponse | null>(null)
  const [viewingPerf, setViewingPerf] = useState<FiberWorkPerformanceResponse | null>(null)
  const [completingWorkOrder, setCompletingWorkOrder] = useState<FiberWorkOrderResponse | null>(null)

  const runningPanelRef = useRef<HTMLDivElement>(null)
  const detailRequestRef = useRef(0)
  const mountedRef = useRef(true)

  const workDateFromRef = useRef<HTMLInputElement>(null)
  const workDateToRef = useRef<HTMLInputElement>(null)
  const workIdRef = useRef<HTMLInputElement>(null)
  const orderCodeRef = useRef<HTMLInputElement>(null)
  const productItemCodeRef = useRef<HTMLSelectElement>(null)
  const productLotCodeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // 제품 검색 옵션 조회 (인피 수주와 동일한 완제품 카테고리 기준)
  useEffect(() => {
    let ignore = false
    ItemApi.getOptions({ productType: 1, category: FIBER_PRODUCT_ITEM_CATEGORY })
      .then((res) => {
        if (!ignore) setProductOptions(res.data ?? [])
      })
      .catch((error) => {
        if (ignore) return
        console.error('인피 제품 옵션 조회 실패:', error)
      })
    return () => {
      ignore = true
    }
  }, [])

  // 작업 중인 작업지시 목록 + 제품별 배분 진행률 조회
  useEffect(() => {
    let ignore = false
    FiberWorkOrderApi.getList({ status: 'IN_PROGRESS', page: 0, size: 100, sort: 'startAt,asc' })
      .then(async (res) => {
        if (ignore) return
        const orders = res.data?.content ?? []
        if (orders.length === 0) {
          setRunningResult({ refreshKey, items: [], failed: false })
          return
        }
        const detailResults = await Promise.allSettled(orders.map((wo) => FiberWorkOrderApi.getDetail(wo.workId)))
        if (ignore) return
        const resolved: FiberWorkOrderDetailResponse[] = []
        detailResults.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value.data) {
            resolved.push(result.value.data)
          } else {
            // 상세 조회에 실패한 작업지시라도 기본 정보 카드는 유지 (모달 진입 시 재조회)
            resolved.push({ workOrder: orders[idx], products: [] })
          }
        })
        setRunningResult({ refreshKey, items: resolved, failed: false })
      })
      .catch((error) => {
        if (ignore) return
        console.error('작업 중인 섬유 작업지시 조회 실패:', error)
        setRunningResult({ refreshKey, items: [], failed: true })
      })

    return () => {
      ignore = true
    }
  }, [refreshKey])

  const isLoadingRunning = runningResult?.refreshKey !== refreshKey
  const runningFailed = !isLoadingRunning && runningResult.failed
  const runningDetails = useMemo(() => runningResult?.items ?? [], [runningResult])

  // 최근 7일 실적 조회 (오늘 KPI + 최근 7일 투입/생산 차트용)
  useEffect(() => {
    let ignore = false
    const days = buildRecentDays(RECENT_DAYS)
    FiberWorkPerformanceApi.getList({
      workDateFrom: days[0],
      workDateTo: days[days.length - 1],
      page: 0,
      size: RECENT_FETCH_SIZE,
      sort: 'workDate,asc',
    })
      .then((res) => {
        if (!ignore) setRecentResult({ refreshKey, days, items: res.data?.content ?? [], failed: false })
      })
      .catch((error) => {
        if (ignore) return
        console.error('최근 7일 섬유 실적 조회 실패:', error)
        setRecentResult({ refreshKey, days, items: [], failed: true })
      })
    return () => {
      ignore = true
    }
  }, [refreshKey])

  const recentFailed = recentResult?.refreshKey === refreshKey && recentResult.failed
  const recentDays = useMemo(() => recentResult?.days ?? buildRecentDays(RECENT_DAYS), [recentResult])
  const recentPerfs = useMemo(() => recentResult?.items ?? [], [recentResult])

  // 실적 줄 목록 조회
  const listRequest = useMemo<ListRequest>(
    () => ({ filters, page, sortParams, refreshKey }),
    [filters, page, sortParams, refreshKey],
  )

  useEffect(() => {
    let ignore = false
    FiberWorkPerformanceApi.getList({
      ...toListParams(listRequest.filters),
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
        console.error('섬유 생산실적 목록 조회 실패:', error)
        setListResult({ request: listRequest, rows: [], totalElements: 0, totalPages: 0, failed: true })
        window.alert(getErrorMessage(error, '생산실적 목록을 불러오지 못했습니다.'))
      })
    return () => {
      ignore = true
    }
  }, [listRequest])

  const isLoadingList = listResult?.request !== listRequest
  const listFailed = !isLoadingList && listResult.failed
  const rows = useMemo(() => listResult?.rows ?? [], [listResult])
  const totalElements = listResult?.totalElements ?? 0
  const totalPages = listResult?.totalPages ?? 0

  // 오늘 KPI 집계 (최근 7일 조회 시점의 마지막 날 = 기준 오늘)
  const today = recentDays[recentDays.length - 1]
  const todaySummary = useMemo(() => {
    const todayRows = recentPerfs.filter((p) => p.workDate === today)
    return {
      count: todayRows.length,
      outputQty: todayRows.reduce((sum, p) => sum + Number(p.outputQty ?? 0), 0),
      inputQty: todayRows.reduce((sum, p) => sum + Number(p.inputQty ?? 0), 0),
    }
  }, [recentPerfs, today])

  // 최근 7일 일별 차트 데이터
  const chartData = useMemo(
    () =>
      recentDays.map((day) => {
        const dayRows = recentPerfs.filter((p) => p.workDate === day)
        const inputSum = Math.round(dayRows.reduce((sum, p) => sum + Number(p.inputQty ?? 0), 0) * 100) / 100
        const outputSum = Math.round(dayRows.reduce((sum, p) => sum + Number(p.outputQty ?? 0), 0) * 100) / 100
        return {
          date: day,
          label: `${day.slice(5).replace('-', '/')}${day === today ? ' 오늘' : ''}`,
          실제투입: inputSum,
          실제생산: outputSum,
        }
      }),
    [recentDays, recentPerfs, today],
  )

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const openPerformanceDetail = useCallback((perfId: number) => {
    const requestId = ++detailRequestRef.current
    FiberWorkPerformanceApi.getDetail(perfId)
      .then((res) => {
        if (!mountedRef.current || requestId !== detailRequestRef.current) return
        setViewingPerf(res.data)
      })
      .catch((error) => {
        if (!mountedRef.current || requestId !== detailRequestRef.current) return
        console.error('섬유 생산실적 단건 조회 실패:', error)
        window.alert(getErrorMessage(error, '실적 상세 정보를 불러오지 못했습니다.'))
      })
  }, [])

  const handleSearch = () => {
    setFilters({
      workDateFrom: workDateFromRef.current?.value ?? '',
      workDateTo: workDateToRef.current?.value ?? '',
      workId: workIdRef.current?.value.trim() ?? '',
      orderCode: orderCodeRef.current?.value.trim() ?? '',
      productItemCode: productItemCodeRef.current?.value ?? '',
      productLotCode: productLotCodeRef.current?.value.trim() ?? '',
    })
    setPage(0)
  }

  const handleReset = () => {
    setFilters(EMPTY_FILTERS)
    setSorting([])
    setPage(0)
  }

  const handleSortChange = (next: SortingState) => {
    setSorting(next)
    setPage(0)
  }

  const searchFields: SearchField[] = [
    {
      type: 'input',
      label: '작업지시번호',
      ref: workIdRef,
      name: 'workId',
      placeholder: 'FWO-',
      value: filters.workId,
    },
    {
      type: 'input',
      label: '수주번호',
      ref: orderCodeRef,
      name: 'orderCode',
      placeholder: 'FSO-',
      value: filters.orderCode,
    },
    {
      type: 'select',
      label: '제품',
      ref: productItemCodeRef,
      name: 'productItemCode',
      options: [
        { value: '', label: '전체' },
        ...productOptions.map((item) => ({ value: item.itemCode, label: `${item.itemNm} (${item.itemCode})` })),
      ],
      value: filters.productItemCode,
    },
    {
      type: 'input',
      label: '제품 LOT',
      ref: productLotCodeRef,
      name: 'productLotCode',
      placeholder: 'FP-',
      value: filters.productLotCode,
    },
    {
      type: 'date',
      label: '작업일',
      startRef: workDateFromRef,
      endRef: workDateToRef,
      name: 'workDate',
      startValue: filters.workDateFrom,
      endValue: filters.workDateTo,
    },
  ]

  const columns: ColumnDef<FiberWorkPerformanceResponse>[] = useMemo(
    () => [
      {
        accessorKey: 'productLotCode',
        header: '제품 LOT · 작업일',
        cell: ({ row }) => (
          <>
            <span className="inpiPerfCode">{row.original.productLotCode}</span>
            <span className="inpiPerfSub">{row.original.workDate}</span>
          </>
        ),
      },
      {
        accessorKey: 'workId',
        header: '거래처 · 작업지시',
        cell: ({ row }) => (
          <>
            {row.original.bpNm || '-'}
            <span className="inpiPerfSub inpiPerfCode">{row.original.workId}</span>
          </>
        ),
      },
      {
        accessorKey: 'productItemNm',
        header: '제품',
        enableSorting: false,
        cell: ({ row }) => row.original.productItemNm || row.original.productItemCode,
      },
      {
        id: 'inputs',
        header: '원물 투입 (LOT별)',
        enableSorting: false,
        cell: ({ row }) => (
          <>
            <div className="inpiPerfChipWrap">
              {row.original.inputs.map((inp) => (
                <span key={inp.receiptId} className="inpiPerfLotChip">
                  {inp.receiptLotCode} · {formatNum(inp.inputQty, 1)}
                </span>
              ))}
            </div>
            <span className="inpiPerfSub">합계 {formatKg(row.original.inputQty)}</span>
          </>
        ),
      },
      {
        accessorKey: 'outputQty',
        header: () => <span className="inpiPerfNum">생산</span>,
        cell: ({ row }) => <span className="inpiPerfNum inpiPerfBold">{formatKg(row.original.outputQty)}</span>,
      },
      {
        accessorKey: 'residueQty',
        header: () => <span className="inpiPerfNum">잔재</span>,
        cell: ({ row }) => (
          <span className="inpiPerfNum">
            {row.original.residueQty == null ? (
              <span className="inpiPerfMuted">미계량</span>
            ) : (
              formatKg(row.original.residueQty)
            )}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: '작업자 · 등록일시',
        cell: ({ row }) => (
          <>
            {row.original.registeredByNm || row.original.registeredBy || '-'}
            <span className="inpiPerfSub">
              {row.original.createdAt ? formatDateTime(row.original.createdAt).slice(5) : '-'}
            </span>
          </>
        ),
      },
      {
        accessorKey: 'workStatus',
        header: '작업지시',
        enableSorting: false,
        cell: ({ row }) => {
          const label = FIBER_WO_STATUS_LABEL[row.original.workStatus] ?? (row.original.workStatus || '-')
          const tone = FIBER_WO_STATUS_TONE[row.original.workStatus] ?? 'muted'
          return <Badge tone={tone}>{label}</Badge>
        },
      },
    ],
    [],
  )

  return (
    <section className="screenStack">
      {/* 오늘 실적 요약 KPI */}
      <section className="inpiPerfMetricGrid" aria-label="오늘 실적 요약">
        <article className="inpiPerfMetricCard">
          <div className="inpiPerfMetricTop">
            <span className="inpiPerfMetricIcon is-good">
              <CubeIcon />
            </span>
            <span className="inpiPerfMetricLabel">오늘 생산량</span>
          </div>
          <div className="inpiPerfMetricValue">
            {recentFailed ? '-' : formatNum(todaySummary.outputQty, 1)}
            {!recentFailed && <small>kg</small>}
          </div>
          <div className="inpiPerfMetricSub">
            {recentFailed ? '오늘 실적을 불러오지 못했습니다.' : `실적 ${todaySummary.count}줄 · 제품 재고 증가분`}
          </div>
        </article>

        <article className="inpiPerfMetricCard">
          <div className="inpiPerfMetricTop">
            <span className="inpiPerfMetricIcon is-info">
              <ArrowDownTrayIcon />
            </span>
            <span className="inpiPerfMetricLabel">오늘 원물 투입</span>
          </div>
          <div className="inpiPerfMetricValue">
            {recentFailed ? '-' : formatNum(todaySummary.inputQty, 1)}
            {!recentFailed && <small>kg</small>}
          </div>
          <div className="inpiPerfMetricSub">
            {recentFailed ? '오늘 실적을 불러오지 못했습니다.' : '원물 재고 차감분'}
          </div>
        </article>

        <button
          type="button"
          className="inpiPerfMetricCard is-clickable"
          onClick={() => runningPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <div className="inpiPerfMetricTop">
            <span className="inpiPerfMetricIcon is-warn">
              <ClockIcon />
            </span>
            <span className="inpiPerfMetricLabel">작업 중인 작업지시</span>
          </div>
          <div className="inpiPerfMetricValue">
            {runningFailed ? '-' : runningDetails.length}
            {!runningFailed && <small>건</small>}
          </div>
          <div className="inpiPerfMetricSub">
            {runningFailed ? '작업 중인 작업지시를 불러오지 못했습니다.' : '눌러서 실적 줄 추가 · 작업 완료'}
          </div>
        </button>
      </section>

      {/* 작업 중인 작업지시 카드 */}
      <div ref={runningPanelRef}>
        <Panel
          title={runningFailed ? '작업 중인 작업지시' : `작업 중인 작업지시 (${runningDetails.length}건)`}
          action={
            <span className="inpiPerfPanelHint">
              현장에서 작업지시서 바코드를 찍은 거래처 작업입니다. 베일·캔이 나올 때마다 실적 줄을 추가하세요.
            </span>
          }
        >
          {isLoadingRunning && runningDetails.length === 0 ? (
            <div className="inpiPerfSectionLoading">
              <Spinner />
            </div>
          ) : runningFailed ? (
            <div className="inpiPerfErrorBox" role="alert">
              작업 중인 작업지시를 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요.
            </div>
          ) : runningDetails.length === 0 ? (
            <p className="inpiPerfEmptyText">
              작업 중인 작업지시가 없습니다. 현장에서 작업지시서 바코드를 찍으면 여기에 나타납니다.
            </p>
          ) : (
            <div className="inpiPerfWoCards">
              {runningDetails.map((detail) => {
                const { workOrder: wo, products } = detail
                const elapsed = formatElapsed(wo.startAt)
                return (
                  <article key={wo.workId} className="inpiPerfWoCard">
                    <div className="inpiPerfWoHead">
                      <div>
                        <strong>{wo.bpNm || wo.bpCode}</strong>
                        <span className="inpiPerfWoSub">
                          <span className="inpiPerfCode">{wo.workId}</span> · {wo.orderCode}
                          {wo.rawItemNm ? ` · ${wo.rawItemNm}` : ''}
                        </span>
                      </div>
                      {wo.startAt && (
                        <span className="inpiPerfElapsed">
                          {formatDateTime(wo.startAt).slice(5)} 시작{elapsed ? ` · ${elapsed}` : ''}
                        </span>
                      )}
                    </div>

                    {products.length > 0 && (
                      <div className="inpiPerfProdRows">
                        {products.map((prod, idx) => {
                          const pct = prod.allocatedQty > 0 ? (prod.inputQty / prod.allocatedQty) * 100 : 0
                          const color = pct > 100 ? '#d97706' : PRODUCT_BAR_COLORS[idx % PRODUCT_BAR_COLORS.length]
                          return (
                            <div key={prod.productItemCode} className="inpiPerfProdRow">
                              <span className="inpiPerfProdRow__name">{prod.productItemNm || prod.productItemCode}</span>
                              <div className="inpiPerfProdRow__bar">
                                <span style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                              </div>
                              <span className="inpiPerfProdRow__val">
                                <b>{formatNum(prod.inputQty, 1)}</b> / {formatNum(prod.allocatedQty, 1)} kg
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="inpiPerfWoFoot">
                      <span className="inpiPerfWoFoot__meta">
                        실적 {wo.performanceCount ?? 0}줄 · 생산 {formatNum(wo.outputQty, 1)} kg · 담당{' '}
                        {wo.managerNm || '미지정'}
                      </span>
                      <button
                        type="button"
                        className="inpiPerfPlainBtn"
                        onClick={() => {
                          detailRequestRef.current += 1
                          setCompletingWorkOrder(wo)
                        }}
                      >
                        작업 완료
                      </button>
                      <button
                        type="button"
                        className="primaryButton"
                        onClick={() => {
                          detailRequestRef.current += 1
                          setCreatingWorkDetail(detail)
                        }}
                      >
                        실적 줄 추가
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* 최근 7일 투입 · 생산 차트 */}
      <Panel title="최근 7일 투입 · 생산 (실적 작업일 기준)">
        {recentFailed ? (
          <div className="inpiPerfErrorBox" role="alert">
            최근 7일 실적 데이터를 불러오지 못했습니다.
          </div>
        ) : (
          <div className="inpiPerfChartWrap">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }} barGap={4}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                unit="kg"
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'var(--text-body)',
                }}
                formatter={(value, name) => [`${formatNum(Number(value), 2)} kg`, String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 8 }} />
              <Bar dataKey="실제투입" name="실제 투입" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar dataKey="실제생산" name="실제 생산" fill="#57d3a1" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* 검색 조건 */}
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      {/* 실적 줄 목록 */}
      <Panel
        title={`실적 줄 목록 (${totalElements.toLocaleString()}줄)`}
        action={
          <button type="button" className="inpiPerfPlainBtn" onClick={triggerRefresh}>
            새로고침
          </button>
        }
      >
        <div className="inpiPerfListBody">
          {isLoadingList && (
            <div className="inpiPerfLoading">
              <Spinner />
            </div>
          )}
          <CusTable
            data={rows}
            columns={columns}
            sorting={sorting}
            onSortingChange={handleSortChange}
            onRowClick={(row) => openPerformanceDetail(row.perfId)}
            noDataMessage={
              isLoadingList
                ? ''
                : listFailed
                  ? '생산실적 목록을 불러오지 못했습니다.'
                  : '조건에 맞는 실적이 없습니다.'
            }
          />
        </div>
        <CusPagination page={page} totalPages={totalPages} totalCount={totalElements} onPageChange={setPage} />
      </Panel>

      {/* 실적 줄 추가 모달 */}
      {creatingWorkDetail && (
        <FiberPerformanceModal
          initialMode="create"
          initialWorkOrderDetail={creatingWorkDetail}
          onClose={() => setCreatingWorkDetail(null)}
          onSaved={() => {
            setCreatingWorkDetail(null)
            setPage(0)
            triggerRefresh()
          }}
        />
      )}

      {/* 실적 줄 상세 / 수정 모달 */}
      {viewingPerf && (
        <FiberPerformanceModal
          key={viewingPerf.perfId}
          initialMode="view"
          performance={viewingPerf}
          onClose={() => setViewingPerf(null)}
          onSaved={() => {
            setViewingPerf(null)
            triggerRefresh()
          }}
        />
      )}

      {/* 작업 완료 모달 */}
      {completingWorkOrder && (
        <FiberWorkOrderCompleteModal
          key={completingWorkOrder.workId}
          workOrder={completingWorkOrder}
          onClose={() => setCompletingWorkOrder(null)}
          onCompleted={() => {
            setCompletingWorkOrder(null)
            triggerRefresh()
          }}
        />
      )}
    </section>
  )
}
