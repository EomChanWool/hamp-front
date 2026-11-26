import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { Badge } from '@components/common/Badge'
import Spinner from '@/components/common/Spinner'
import { useTableSorting } from '@/hooks/useTableSorting'
import { formatDateTime } from '@/utils/common'
import { BusinessPartnerApi, type BusinessPartnerOptionResponse } from '@/api/sales/BusinessPartner'
import { UserApi, type UserOptionResponse } from '@/api/User'
import { FiberWorkOrderApi, type FiberWorkOrderResponse } from '@/api/FiberWorkOrder'
import {
  FIBER_WO_STATUS_LABEL,
  FIBER_WO_STATUS_OPTIONS,
  FIBER_WO_STATUS_TONE,
  calcPct,
  fmtKg,
  getErrorMessage,
} from '@/utils/fiberWorkOrder'
import '@components/table/Custable.css'
import '@/pages/page/ioInpi/ioInpi.css'
import '@/pages/page/inpi/Inpi.css'

const LIST_PATH = '/inpi/work-orders'
const PAGE_SIZE = 10

const TABS = [{ label: '전체', value: '' }, ...FIBER_WO_STATUS_OPTIONS]

export function InpiWorkOrdersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [orders, setOrders] = useState<FiberWorkOrderResponse[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [tabCounts, setTabCounts] = useState<Record<string, number> | null>(null)
  const [bpOptions, setBpOptions] = useState<BusinessPartnerOptionResponse[]>([])
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([])

  const [scanCode, setScanCode] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  const { sorting, sortParams, handleSortingChange } = useTableSorting()

  // 브라우저 새로고침(F5) 때만 검색 조건을 비운다 (기존 목록 화면과 동일)
  useEffect(() => {
    const handleBeforeUnload = () => sessionStorage.setItem('is_browser_reload', 'true')
    window.addEventListener('beforeunload', handleBeforeUnload)

    if (sessionStorage.getItem('is_browser_reload') === 'true') {
      sessionStorage.removeItem('is_browser_reload')
      if (searchParams.toString()) setSearchParams({}, { replace: true })
    }
    setIsReady(true)

    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // URL 검색조건
  const currentPage = Number(searchParams.get('page') || '0')
  const queryWorkId = searchParams.get('workId') || ''
  const queryOrderCode = searchParams.get('orderCode') || ''
  const queryBpCode = searchParams.get('bpCode') || ''
  const queryManagerId = searchParams.get('managerId') || ''
  const queryStatus = searchParams.get('status') || ''
  const queryFrom = searchParams.get('workDateFrom') || ''
  const queryTo = searchParams.get('workDateTo') || ''

  const workIdRef = useRef<HTMLInputElement>(null)
  const orderCodeRef = useRef<HTMLInputElement>(null)
  const bpCodeRef = useRef<HTMLSelectElement>(null)
  const managerIdRef = useRef<HTMLSelectElement>(null)
  const workDateFromRef = useRef<HTMLInputElement>(null)
  const workDateToRef = useRef<HTMLInputElement>(null)

  // 검색 옵션 (거래처 / 담당자)
  useEffect(() => {
    let ignore = false
    Promise.allSettled([BusinessPartnerApi.getOptions(), UserApi.getOptions()]).then(([bpRes, userRes]) => {
      if (ignore) return
      if (bpRes.status === 'fulfilled') setBpOptions(bpRes.value.data ?? [])
      if (userRes.status === 'fulfilled') setUserOptions(userRes.value.data ?? [])
      if (bpRes.status === 'rejected' || userRes.status === 'rejected') {
        console.error('섬유 작업지시 검색 옵션 조회 실패:', bpRes, userRes)
      }
    })
    return () => {
      ignore = true
    }
  }, [])

  const searchFields: SearchField[] = useMemo(
    () => [
      { type: 'input', label: '작업지시번호', ref: workIdRef, name: 'workId', placeholder: 'FWO-', value: queryWorkId },
      { type: 'input', label: '수주번호', ref: orderCodeRef, name: 'orderCode', placeholder: 'FSO-', value: queryOrderCode },
      {
        type: 'select',
        label: '거래처',
        ref: bpCodeRef,
        value: queryBpCode,
        options: [
          { label: '전체', value: '' },
          ...bpOptions.map((bp) => ({ label: `${bp.bpNm} (${bp.bpCode ?? '-'})`, value: bp.bpCode })),
        ],
      },
      {
        type: 'select',
        label: '담당자',
        ref: managerIdRef,
        value: queryManagerId,
        options: [
          { label: '전체', value: '' },
          ...userOptions.map((user) => ({ label: `${user.userNm} (${user.userId})`, value: user.userId })),
        ],
      },
      {
        type: 'date',
        label: '예정 시작일',
        startRef: workDateFromRef,
        endRef: workDateToRef,
        startValue: queryFrom,
        endValue: queryTo,
      },
    ],
    [bpOptions, userOptions, queryWorkId, queryOrderCode, queryBpCode, queryManagerId, queryFrom, queryTo],
  )

  // 상태를 제외한 공통 검색 조건
  const baseParams = useCallback(() => {
    const params: Record<string, any> = {}
    if (queryWorkId) params.workId = queryWorkId
    if (queryOrderCode) params.orderCode = queryOrderCode
    if (queryBpCode) params.bpCode = queryBpCode
    if (queryManagerId) params.managerId = queryManagerId
    if (queryFrom) params.workDateFrom = queryFrom
    if (queryTo) params.workDateTo = queryTo
    return params
  }, [queryWorkId, queryOrderCode, queryBpCode, queryManagerId, queryFrom, queryTo])

  // 목록
  useEffect(() => {
    if (!isReady) return
    let ignore = false
    setIsLoading(true)

    const params: Record<string, any> = { ...baseParams(), page: currentPage, size: PAGE_SIZE }
    if (queryStatus) params.status = queryStatus
    if (sortParams.length > 0) params.sort = sortParams

    FiberWorkOrderApi.getList(params)
      .then((res) => {
        if (ignore) return
        setOrders(res.data?.content ?? [])
        setTotalElements(res.data?.totalElements ?? 0)
        setTotalPages(res.data?.totalPages ?? 0)
      })
      .catch((error) => {
        if (ignore) return
        console.error('섬유 작업지시 목록 조회 실패:', error)
        window.alert(getErrorMessage(error, '섬유 작업지시 목록을 불러오는 중 오류가 발생했습니다.'))
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [isReady, baseParams, currentPage, queryStatus, sortParams, refreshKey])

  // 탭 건수 (상태 필터를 뺀 검색 조건 기준, 상태별로 size=1 조회해서 totalElements 사용)
  useEffect(() => {
    if (!isReady) return
    let ignore = false
    Promise.all(
      FIBER_WO_STATUS_OPTIONS.map((opt) =>
        FiberWorkOrderApi.getList({ ...baseParams(), status: opt.value, page: 0, size: 1 }).then(
          (res) => res.data?.totalElements ?? 0,
        ),
      ),
    )
      .then((nums) => {
        if (ignore) return
        const counts: Record<string, number> = { '': nums.reduce((a, b) => a + b, 0) }
        FIBER_WO_STATUS_OPTIONS.forEach((opt, i) => {
          counts[opt.value] = nums[i]
        })
        setTabCounts(counts)
      })
      .catch((error) => {
        if (ignore) return
        console.error('섬유 작업지시 탭 건수 조회 실패:', error)
        setTabCounts(null)
      })
    return () => {
      ignore = true
    }
  }, [isReady, baseParams, refreshKey])

  const handleSearch = () => {
    const next = new URLSearchParams(searchParams)
    next.set('page', '0')
    const entries: [string, string][] = [
      ['workId', workIdRef.current?.value.trim() || ''],
      ['orderCode', orderCodeRef.current?.value.trim() || ''],
      ['bpCode', bpCodeRef.current?.value || ''],
      ['managerId', managerIdRef.current?.value || ''],
      ['workDateFrom', workDateFromRef.current?.value || ''],
      ['workDateTo', workDateToRef.current?.value || ''],
    ]
    entries.forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    setSearchParams(next)
  }

  const handleReset = () => setSearchParams({ page: '0' }, { replace: true })

  const handleTabChange = (status: string) => {
    if (status === queryStatus) return
    const next = new URLSearchParams(searchParams)
    next.set('page', '0')
    if (status) next.set('status', status)
    else next.delete('status')
    setSearchParams(next)
  }

  const handlePageChange = (page: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  const goDetail = (workId: string) => {
    const qs = searchParams.toString()
    navigate(`${LIST_PATH}/${encodeURIComponent(workId)}${qs ? `?${qs}` : ''}`)
  }

  const goCreate = () => {
    const qs = searchParams.toString()
    navigate(`${LIST_PATH}/create${qs ? `?${qs}` : ''}`)
  }

  // 작업지시서 바코드 스캔 = 작업 시작 (현장은 공용 바코드 프로그램이 같은 API를 호출한다. 여기는 PC 대체 입력용)
  const handleScan = async (e: FormEvent) => {
    e.preventDefault()
    const code = scanCode.trim()
    if (!code || isScanning) return
    setIsScanning(true)
    try {
      const res = await FiberWorkOrderApi.scan(code)
      window.alert(res.data?.message || res.message || '작업이 시작되었습니다.')
      setScanCode('')
      setRefreshKey((key) => key + 1)
    } catch (error) {
      console.error('섬유 작업지시서 스캔 실패:', error)
      window.alert(getErrorMessage(error, '스캔 처리에 실패했습니다.'))
    } finally {
      setIsScanning(false)
    }
  }

  const columns: ColumnDef<FiberWorkOrderResponse>[] = useMemo(
    () => [
      {
        accessorKey: 'workId',
        header: '작업지시번호',
        cell: ({ getValue }) => <span className="fwo-code">{getValue<string>() || '-'}</span>,
      },
      {
        accessorKey: 'bpNm',
        header: '거래처 · 수주',
        enableSorting: false,
        cell: ({ row }) => (
          <>
            {row.original.bpNm || '-'}
            <span className="fwo-sub">
              {row.original.orderCode} · 납기 {row.original.dueDate || '-'}
            </span>
          </>
        ),
      },
      {
        accessorKey: 'rawItemNm',
        header: '투입원료',
        enableSorting: false,
        cell: ({ row }) => (
          <>
            {row.original.rawItemNm || row.original.rawItemCode || '-'}
            <span className="fwo-sub">수주 {fmtKg(row.original.requestInputQty)} kg</span>
          </>
        ),
      },
      {
        id: 'progress',
        header: '진행 (실적 투입 ÷ 수주 원물)',
        enableSorting: false,
        cell: ({ row }) => {
          const { inputQty, requestInputQty, performanceCount } = row.original
          const pct = calcPct(inputQty, requestInputQty)
          return (
            <div className="fwo-prog">
              <div className="fwo-prog__bar">
                <span className={pct > 100 ? 'is-over' : ''} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <small>
                {fmtKg(inputQty)} / {fmtKg(requestInputQty)} kg · {pct}% · 실적 {performanceCount ?? 0}줄
              </small>
            </div>
          )
        },
      },
      {
        accessorKey: 'workDate',
        header: '예정 시작일',
        cell: ({ getValue }) => getValue<string>() || '-',
      },
      {
        accessorKey: 'managerNm',
        header: '담당자',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.managerNm
            ? `${row.original.managerNm} (${row.original.managerId})`
            : row.original.managerId || '-',
      },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => {
          const status = getValue<string>()
          return <Badge tone={FIBER_WO_STATUS_TONE[status] ?? 'muted'}>{FIBER_WO_STATUS_LABEL[status] ?? status}</Badge>
        },
      },
      {
        id: 'period',
        header: '시작 → 완료',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="fwo-time">
            {row.original.startAt ? formatDateTime(row.original.startAt) : '-'} →{' '}
            {row.original.endAt ? formatDateTime(row.original.endAt) : '-'}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="섬유 작업지시 목록" action="등록" onAction={goCreate}>
        <div className="inpiListBar">
          <div className="inpiTabs" role="group" aria-label="작업상태 빠른 필터">
            {TABS.map((tab) => (
              <button
                key={tab.value || 'all'}
                type="button"
                className="inpiTab"
                aria-pressed={queryStatus === tab.value}
                onClick={() => handleTabChange(tab.value)}
              >
                {tab.label}
                <b>{tabCounts ? tabCounts[tab.value].toLocaleString() : '-'}</b>
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={orders}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                onRowClick={(row) => goDetail(row.workId)}
                noDataMessage="조회된 데이터가 없습니다."
              />
              <CusPagination
                page={currentPage}
                totalPages={totalPages}
                totalCount={totalElements}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </Panel>

      <Panel title="작업지시서 바코드 스캔 (작업 시작)">
        <p className="fwo-hint">
          섬유동 현장에서는 공용 바코드 프로그램이 같은 API(<code>POST /api/fiber-work-orders/scan</code>)를 호출합니다. 대기
          중인 작업지시서를 찍으면 작업 중으로 바뀌고, 작업 중에 다시 찍으면 안내만 표시됩니다. 실제 사용한 원물 LOT은 실적
          화면에서 선택합니다.
        </p>
        <form className="fwo-scan" onSubmit={handleScan}>
          <input
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            placeholder="FWO-20261126-01"
            aria-label="작업지시서 바코드 값"
            autoComplete="off"
            disabled={isScanning}
          />
          <button type="submit" className="ghostButton" disabled={isScanning || !scanCode.trim()}>
            {isScanning ? '처리 중...' : '스캔'}
          </button>
        </form>
      </Panel>
    </section>
  )
}
