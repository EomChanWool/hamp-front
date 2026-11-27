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
import { FiberShipmentApi, type FiberShipmentResponse } from '@/api/ioInpi/FiberShipment'
import { fmtKg, getErrorMessage } from '@/utils/fiberWorkOrder'
import { todayString } from '@/utils/fiberSalesOrderAllocation'
import {
  FIBER_SHIP_STATUS_LABEL,
  FIBER_SHIP_STATUS_OPTIONS,
  FIBER_SHIP_STATUS_TONE,
  round2,
} from '@/utils/fiberShipment'
import '@components/table/Custable.css'
import '@/pages/page/ioInpi/ioInpi.css'
import '@/pages/page/inpi/Inpi.css'
import '@/pages/page/ioInpi/InpiOutbound.css'

const LIST_PATH = '/io/inpi-outbound-manage'
const PAGE_SIZE = 10
/** 출고 확인 대기 패널은 한 번에 이만큼만 (현장 스캔 건은 많지 않음) */
const SCANNED_SIZE = 100

const TABS = [{ label: '전체', value: '' }, ...FIBER_SHIP_STATUS_OPTIONS]

export function InpiOutboundManagePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [ships, setShips] = useState<FiberShipmentResponse[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [tabCounts, setTabCounts] = useState<Record<string, number> | null>(null)
  const [bpOptions, setBpOptions] = useState<BusinessPartnerOptionResponse[]>([])
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([])

  // 출고 확인 대기 (현장에서 스캔된 지시서)
  const [scanned, setScanned] = useState<FiberShipmentResponse[]>([])
  const [isScannedLoading, setIsScannedLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isBusy, setIsBusy] = useState(false)

  // PC 대체 스캔 입력
  const [scanCode, setScanCode] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  const { sorting, sortParams, handleSortingChange } = useTableSorting()
  const today = todayString()

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
  const queryShipId = searchParams.get('shipId') || ''
  const queryOrderCode = searchParams.get('orderCode') || ''
  const queryBpCode = searchParams.get('bpCode') || ''
  const queryManagerId = searchParams.get('managerId') || ''
  const queryStatus = searchParams.get('status') || ''
  const queryFrom = searchParams.get('shipDateFrom') || ''
  const queryTo = searchParams.get('shipDateTo') || ''

  const shipIdRef = useRef<HTMLInputElement>(null)
  const orderCodeRef = useRef<HTMLInputElement>(null)
  const bpCodeRef = useRef<HTMLSelectElement>(null)
  const managerIdRef = useRef<HTMLSelectElement>(null)
  const shipDateFromRef = useRef<HTMLInputElement>(null)
  const shipDateToRef = useRef<HTMLInputElement>(null)

  // 검색 옵션 (거래처 / 담당자)
  useEffect(() => {
    let ignore = false
    Promise.allSettled([BusinessPartnerApi.getOptions(), UserApi.getOptions()]).then(([bpRes, userRes]) => {
      if (ignore) return
      if (bpRes.status === 'fulfilled') setBpOptions(bpRes.value.data ?? [])
      if (userRes.status === 'fulfilled') setUserOptions(userRes.value.data ?? [])
      if (bpRes.status === 'rejected' || userRes.status === 'rejected') {
        console.error('섬유 출고지시서 검색 옵션 조회 실패:', bpRes, userRes)
      }
    })
    return () => {
      ignore = true
    }
  }, [])

  const searchFields: SearchField[] = useMemo(
    () => [
      { type: 'input', label: '출고지시서 번호', ref: shipIdRef, name: 'shipId', placeholder: 'FSH-', value: queryShipId },
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
        label: '출고 예정일',
        startRef: shipDateFromRef,
        endRef: shipDateToRef,
        startValue: queryFrom,
        endValue: queryTo,
      },
    ],
    [bpOptions, userOptions, queryShipId, queryOrderCode, queryBpCode, queryManagerId, queryFrom, queryTo],
  )

  // 상태를 제외한 공통 검색 조건
  const baseParams = useCallback(() => {
    const params: Record<string, any> = {}
    if (queryShipId) params.shipId = queryShipId
    if (queryOrderCode) params.orderCode = queryOrderCode
    if (queryBpCode) params.bpCode = queryBpCode
    if (queryManagerId) params.managerId = queryManagerId
    if (queryFrom) params.shipDateFrom = queryFrom
    if (queryTo) params.shipDateTo = queryTo
    return params
  }, [queryShipId, queryOrderCode, queryBpCode, queryManagerId, queryFrom, queryTo])

  // 목록
  useEffect(() => {
    if (!isReady) return
    let ignore = false
    setIsLoading(true)

    const params: Record<string, any> = { ...baseParams(), page: currentPage, size: PAGE_SIZE }
    if (queryStatus) params.status = queryStatus
    if (sortParams.length > 0) params.sort = sortParams

    FiberShipmentApi.getList(params)
      .then((res) => {
        if (ignore) return
        setShips(res.data?.content ?? [])
        setTotalElements(res.data?.totalElements ?? 0)
        setTotalPages(res.data?.totalPages ?? 0)
      })
      .catch((error) => {
        if (ignore) return
        console.error('섬유 출고지시서 목록 조회 실패:', error)
        window.alert(getErrorMessage(error, '섬유 출고지시서 목록을 불러오는 중 오류가 발생했습니다.'))
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
      FIBER_SHIP_STATUS_OPTIONS.map((opt) =>
        FiberShipmentApi.getList({ ...baseParams(), status: opt.value, page: 0, size: 1 }).then(
          (res) => res.data?.totalElements ?? 0,
        ),
      ),
    )
      .then((nums) => {
        if (ignore) return
        const counts: Record<string, number> = { '': nums.reduce((a, b) => a + b, 0) }
        FIBER_SHIP_STATUS_OPTIONS.forEach((opt, i) => {
          counts[opt.value] = nums[i]
        })
        setTabCounts(counts)
      })
      .catch((error) => {
        if (ignore) return
        console.error('섬유 출고지시서 탭 건수 조회 실패:', error)
        setTabCounts(null)
      })
    return () => {
      ignore = true
    }
  }, [isReady, baseParams, refreshKey])

  // 출고 확인 대기 (검색 조건과 무관하게 스캔됨 전체, 스캔 순)
  useEffect(() => {
    let ignore = false
    setIsScannedLoading(true)
    FiberShipmentApi.getList({ status: 'SCANNED', page: 0, size: SCANNED_SIZE, sort: 'scannedAt,asc' })
      .then((res) => {
        if (ignore) return
        const list = res.data?.content ?? []
        setScanned(list)
        // 사라진 건은 선택에서 뺀다
        setSelected((prev) => new Set([...prev].filter((id) => list.some((s) => s.shipId === id))))
      })
      .catch((error) => {
        if (ignore) return
        console.error('출고 확인 대기 목록 조회 실패:', error)
        setScanned([])
      })
      .finally(() => {
        if (!ignore) setIsScannedLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [refreshKey])

  const refresh = () => setRefreshKey((key) => key + 1)

  const handleSearch = () => {
    const next = new URLSearchParams(searchParams)
    next.set('page', '0')
    const entries: [string, string][] = [
      ['shipId', shipIdRef.current?.value.trim() || ''],
      ['orderCode', orderCodeRef.current?.value.trim() || ''],
      ['bpCode', bpCodeRef.current?.value || ''],
      ['managerId', managerIdRef.current?.value || ''],
      ['shipDateFrom', shipDateFromRef.current?.value || ''],
      ['shipDateTo', shipDateToRef.current?.value || ''],
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

  const goDetail = (shipId: string) => {
    const qs = searchParams.toString()
    navigate(`${LIST_PATH}/${encodeURIComponent(shipId)}${qs ? `?${qs}` : ''}`)
  }

  const goCreate = () => {
    const qs = searchParams.toString()
    navigate(`${LIST_PATH}/create${qs ? `?${qs}` : ''}`)
  }

  // ── 출고 확인 대기 선택 ──
  const allSelected = scanned.length > 0 && selected.size === scanned.length
  const selectedQty = round2(
    scanned.filter((s) => selected.has(s.shipId)).reduce((sum, s) => sum + (s.totalShipQty ?? 0), 0),
  )

  const toggleOne = (shipId: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(shipId)
      else next.delete(shipId)
      return next
    })

  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(scanned.map((s) => s.shipId)) : new Set())

  const handleConfirm = async () => {
    const ids = scanned.filter((s) => selected.has(s.shipId)).map((s) => s.shipId)
    if (ids.length === 0 || isBusy) return
    const ok = window.confirm(
      `${ids.join(', ')}\n(${ids.length}건 · ${fmtKg(selectedQty)} kg)를 출고 처리할까요?\n\n` +
        '제품 재고가 빠지고, 출고일시는 각 지시서를 스캔한 시각, 출고자는 지금 로그인한 사람으로 기록됩니다.',
    )
    if (!ok) return
    setIsBusy(true)
    try {
      const res = await FiberShipmentApi.confirm(ids)
      window.alert(`${res.data?.length ?? ids.length}건 출고 처리했습니다.`)
      setSelected(new Set())
      refresh()
    } catch (error) {
      console.error('섬유 출고 확인 실패:', error)
      window.alert(getErrorMessage(error, '출고 확인 처리에 실패했습니다.'))
    } finally {
      setIsBusy(false)
    }
  }

  const handleRevertScan = async (ship: FiberShipmentResponse) => {
    if (isBusy) return
    const ok = window.confirm(
      `${ship.shipId}를 출고 대기로 되돌릴까요?\n현장에서 잘못 찍은 경우입니다. 재고는 아직 안 빠졌으므로 변동이 없습니다.`,
    )
    if (!ok) return
    setIsBusy(true)
    try {
      await FiberShipmentApi.revertScan(ship.shipId)
      window.alert('출고 대기로 되돌렸습니다.')
      refresh()
    } catch (error) {
      console.error('섬유 출고지시서 스캔 취소 실패:', error)
      window.alert(getErrorMessage(error, '스캔 취소에 실패했습니다.'))
    } finally {
      setIsBusy(false)
    }
  }

  // 출고지시서 바코드 스캔 (현장은 공용 바코드 프로그램이 같은 API를 호출한다. 여기는 PC 대체 입력용)
  const handleScan = async (e: FormEvent) => {
    e.preventDefault()
    const code = scanCode.trim()
    if (!code || isScanning) return
    setIsScanning(true)
    try {
      const res = await FiberShipmentApi.scan(code)
      window.alert(res.data?.message || res.message || '스캔되었습니다. 출고 확인 대기 목록에 올라갔습니다.')
      setScanCode('')
      refresh()
    } catch (error) {
      console.error('섬유 출고지시서 스캔 실패:', error)
      window.alert(getErrorMessage(error, '스캔 처리에 실패했습니다.'))
    } finally {
      setIsScanning(false)
    }
  }

  const columns: ColumnDef<FiberShipmentResponse>[] = useMemo(
    () => [
      {
        accessorKey: 'shipId',
        header: '출고지시서 번호',
        cell: ({ getValue }) => <span className="fwo-code">{getValue<string>() || '-'}</span>,
      },
      {
        accessorKey: 'bpNm',
        header: '거래처 · 수주',
        enableSorting: false,
        cell: ({ row }) => (
          <>
            {row.original.bpNm || '-'}
            <span className="fwo-sub">{row.original.orderCode}</span>
          </>
        ),
      },
      {
        accessorKey: 'lineCount',
        header: '제품 LOT',
        enableSorting: false,
        cell: ({ getValue }) => <span className="fsh-num">{getValue<number>() ?? 0}개</span>,
      },
      {
        accessorKey: 'totalShipQty',
        header: '출고 중량',
        enableSorting: false,
        cell: ({ getValue }) => <span className="fsh-num">{fmtKg(getValue<number>())} kg</span>,
      },
      {
        accessorKey: 'shipDate',
        header: '출고 예정일',
        cell: ({ row }) => {
          const { shipDate, status } = row.original
          const late = status === 'WAITING' && !!shipDate && shipDate < today
          return (
            <>
              {shipDate || '-'}
              {late && <span className="fwo-sub fsh-late">예정일 지남</span>}
            </>
          )
        },
      },
      {
        accessorKey: 'shipDest',
        header: '인도 장소',
        enableSorting: false,
        cell: ({ getValue }) => <span className="fsh-dest">{getValue<string>() || '-'}</span>,
      },
      {
        accessorKey: 'managerNm',
        header: '담당자',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.managerNm
            ? `${row.original.managerNm} (${row.original.managerId})`
            : row.original.managerId || '미지정',
      },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => {
          const status = getValue<string>()
          return (
            <Badge tone={FIBER_SHIP_STATUS_TONE[status] ?? 'muted'}>{FIBER_SHIP_STATUS_LABEL[status] ?? status}</Badge>
          )
        },
      },
      {
        id: 'shipped',
        header: '출고일시 · 확인자',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="fwo-time">
            {row.original.shippedAt
              ? `${formatDateTime(row.original.shippedAt)} · ${row.original.shippedByNm || row.original.shippedBy || '-'}`
              : '-'}
          </span>
        ),
      },
    ],
    [today],
  )

  return (
    <section className="screenStack">
      {/* 출고 확인 대기 */}
      <Panel title={`출고 확인 대기 (${scanned.length}건)`}>
        <p className="fwo-hint">
          현장에서 출고지시서 바코드를 찍은 건입니다. 아직 재고는 그대로입니다. 실제로 나간 건을 체크하고 <b>출고 확인</b>을
          누르면 그때 제품 재고가 빠지고 출고 완료가 됩니다. 출고일시는 스캔한 시각으로, 출고자는 확인을 누른 사람으로
          남습니다.
        </p>
        <div className="fwo-tableWrap">
          <table className="fwo-table fsh-scanTable">
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    className="fsh-check is-blue"
                    aria-label="전체 선택"
                    checked={allSelected}
                    disabled={scanned.length === 0 || isBusy}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th>출고지시서 번호</th>
                <th>거래처 · 수주</th>
                <th className="is-num">제품 LOT</th>
                <th className="is-num">출고 중량</th>
                <th>스캔 시각</th>
                <th>출고 예정일</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isScannedLoading && scanned.length === 0 ? (
                <tr>
                  <td colSpan={8} className="fwo-empty">불러오는 중...</td>
                </tr>
              ) : scanned.length === 0 ? (
                <tr>
                  <td colSpan={8} className="fwo-empty">
                    확인할 건이 없습니다. 현장에서 출고지시서 바코드를 찍으면 여기에 올라옵니다.
                  </td>
                </tr>
              ) : (
                scanned.map((s) => {
                  const on = selected.has(s.shipId)
                  return (
                    <tr key={s.shipId} className={on ? 'fsh-on' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          className="fsh-check is-blue"
                          aria-label={`${s.shipId} 선택`}
                          checked={on}
                          disabled={isBusy}
                          onChange={(e) => toggleOne(s.shipId, e.target.checked)}
                        />
                      </td>
                      <td><span className="fwo-code">{s.shipId}</span></td>
                      <td>
                        {s.bpNm || '-'}
                        <span className="fwo-sub">{s.orderCode}</span>
                      </td>
                      <td className="is-num">{s.lineCount ?? 0}개</td>
                      <td className="is-num">{fmtKg(s.totalShipQty)} kg</td>
                      <td className="fwo-time">{s.scannedAt ? formatDateTime(s.scannedAt) : '-'}</td>
                      <td>{s.shipDate || '-'}</td>
                      <td>
                        <button type="button" className="fsh-linkBtn" onClick={() => goDetail(s.shipId)}>
                          상세
                        </button>
                        <button
                          type="button"
                          className="fsh-linkBtn is-danger"
                          disabled={isBusy}
                          onClick={() => handleRevertScan(s)}
                        >
                          스캔 취소
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="fsh-confirmBar">
          <span>{selected.size > 0 ? `${selected.size}건 선택 · ${fmtKg(selectedQty)} kg` : '출고된 건을 체크하세요.'}</span>
          <button type="button" className="primaryButton" disabled={selected.size === 0 || isBusy} onClick={handleConfirm}>
            {isBusy ? '처리 중...' : selected.size > 0 ? `선택 출고 확인 (${selected.size}건)` : '선택 출고 확인'}
          </button>
        </div>
      </Panel>

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="섬유 출고지시서 목록" action="등록" onAction={goCreate}>
        <div className="inpiListBar">
          <div className="inpiTabs" role="group" aria-label="출고상태 빠른 필터">
            {TABS.map((tab) => (
              <button
                key={tab.value || 'all'}
                type="button"
                className="inpiTab"
                aria-pressed={queryStatus === tab.value}
                onClick={() => handleTabChange(tab.value)}
              >
                {tab.label}
                <b>{tabCounts ? (tabCounts[tab.value] ?? 0).toLocaleString() : '-'}</b>
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
                data={ships}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                onRowClick={(row) => goDetail(row.shipId)}
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

      <Panel title="출고지시서 바코드 스캔 (현장 대체 입력)">
        <p className="fwo-hint">
          섬유동 현장에서는 공용 바코드 프로그램이 같은 API(<code>POST /api/fiber-shipments/scan</code>)를 호출합니다. 차량에
          다 실은 뒤 출고 대기 지시서를 찍으면 스캔됨으로 바뀌고 위 출고 확인 대기 목록에 올라갑니다. 재고는 PC에서 출고
          확인할 때 빠집니다.
        </p>
        <form className="fwo-scan" onSubmit={handleScan}>
          <input
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            placeholder="FSH-20261127-01"
            aria-label="출고지시서 바코드 값"
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
