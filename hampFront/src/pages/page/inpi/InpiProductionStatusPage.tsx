import { useCallback, useEffect, useRef, useState } from 'react'
import { Panel } from '@components/card/Panel'
import { Badge } from '@components/common/Badge'
import Spinner from '@/components/common/Spinner'
import {
  FiberProductionStatusApi,
  type FiberProductionInProgressResponse,
  type FiberProductionManagerResponse,
  type FiberProductionOrderResponse,
  type FiberProductionStatusResponse,
  type FiberProductionSummaryResponse,
} from '@/api/inpi/FiberProductionStatus'
import { FIBER_WO_STATUS_LABEL, FIBER_WO_STATUS_TONE, getErrorMessage } from '@/utils/fiberWorkOrder'
import { todayString } from '@/utils/fiberSalesOrderAllocation'
import '@/pages/page/inpi/Inpi.css'

/**
 * 섬유동 작업현황판 (조회 전용)
 */

// 자동 새로고침 주기 (1분)
const REFRESH_MS = 60_000
// 현재 시각 표시 갱신 주기
const CLOCK_MS = 30_000

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

// ── 표시용 유틸 ───────────────────────────────────────────────

/** 숫자 표시 (천단위 콤마, 소수 1자리까지) */
const fmt = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 })

/** 경과 분 → "n분 / n시간 n분 / n일 n시간" */
const elapsed = (m: number) =>
  m < 60 ? `${m}분` : m < 1440 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${Math.floor(m / 1440)}일 ${Math.floor((m % 1440) / 60)}시간`

/** 'YYYY-MM-DDTHH:mm:ss' → 'HH:mm' */
const hhmm = (iso: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : '-')

/** 납기 태그 (dueDays: 0 = 오늘, 음수 = 지남, null = 납기 없음) */
function dueTag(dueDays: number | null, dueDate: string) {
  const md = dueDate ? ` · ${dueDate.slice(5).replace('-', '/')}` : ''
  if (dueDays == null) return { cls: 'muted', text: '납기 없음' }
  if (dueDays < 0) return { cls: 'late', text: `납기 ${-dueDays}일 지남${md}` }
  if (dueDays === 0) return { cls: 'soon', text: `납기 오늘${md}` }
  if (dueDays <= 2) return { cls: 'soon', text: `D-${dueDays}${md}` }
  return { cls: 'ok', text: `D-${dueDays}${md}` }
}

// ── 상단 요약 숫자 ─────────────────────────────────────────────

function StatsSection({ summary, isToday }: { summary: FiberProductionSummaryResponse; isToday: boolean }) {
  const day = isToday ? '오늘' : '기준일'
  const items = [
    { label: `${day} 생산량`, value: fmt(summary.outputQty), unit: 'kg', sub: '실적 줄 작업일 기준', cls: '' },
    // 작업 중: 바코드 스캔 후 완료 전 (기준일과 무관, 현재 시점)
    { label: '작업 중', value: summary.inProgressCount, unit: '건', sub: '바코드 스캔 후 완료 전', cls: summary.inProgressCount ? 'warn' : '' },
    { label: `${day} 시작 예정`, value: summary.remainingCount, unit: '건', sub: '대기 중인 작업지시', cls: '' },
    // 시작 지연: 예정 시작일이 지났는데 아직 대기 → 빨간색 강조
    { label: '시작 지연', value: summary.delayedCount, unit: '건', sub: '예정 시작일 지났는데 대기', cls: summary.delayedCount ? 'danger' : '' },
  ]
  return (
    <section className="fps-card">
      <div className="fps-stats">
        {items.map((s) => (
          <div key={s.label} className={`fps-stat ${s.cls}`}>
            <span>{s.label}</span>
            <strong>
              {s.value}
              <small>{s.unit}</small>
            </strong>
            <em>{s.sub}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── 수주별 진행률 ──────────────────────────────────────────────

function OrderCard({ order }: { order: FiberProductionOrderResponse }) {
  const pct = order.progressPercent ?? 0
  const over = pct > 100 // 배분보다 더 투입하면 100%를 넘음 → 막대는 100%로 자르고 주황색
  const due = dueTag(order.dueDays, order.dueDate)

  return (
    <article className="fps-order">
      <div className="fps-orderTop">
        <div className="fps-orderName">
          <b>{order.bpNm}</b>
          <code>
            {order.orderCode}
            {order.workId ? ` · ${order.workId}` : ''}
          </code>
        </div>
        <div className="fps-tags">
          {/* 작업지시 상태 (없으면 '작업지시 없음') */}
          {order.workStatus ? (
            <Badge tone={FIBER_WO_STATUS_TONE[order.workStatus] ?? 'muted'}>
              {FIBER_WO_STATUS_LABEL[order.workStatus] ?? order.workStatus}
            </Badge>
          ) : (
            <Badge tone="muted">작업지시 없음</Badge>
          )}
          {/* 납기 D-day 태그 (2일 이내 주황, 지남 빨강) */}
          <span className={`fps-tag ${due.cls}`}>{due.text}</span>
        </div>
      </div>

      {/* 수주 전체 진행률 = 실적 투입 ÷ 배분 원물 */}
      <div className="fps-orderTotal">
        <div className="fps-bar" role="img" aria-label={`${order.orderCode} 진행률 ${pct}%`}>
          <span className={over ? 'is-over' : ''} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className={`fps-pct ${over ? 'is-over' : ''}`}>
          {fmt(pct)}
          <small>%</small>
        </span>
      </div>

      <div className="fps-facts">
        <span>
          배분 원물 <b>{fmt(order.allocatedQty)}kg</b>
        </span>
        <span>
          투입 <b>{fmt(order.completedInputQty)}kg</b>
        </span>
        <span>
          생산 <b>{fmt(order.outputQty)}kg</b>
        </span>
        {over && <span className="fps-warnText">배분보다 더 투입됨</span>}
        {order.workStatus === 'COMPLETED' && <span>작업은 끝남 · 수주 마감 처리 대기</span>}
      </div>

      {/* 제품별 진행률 */}
      <div className="fps-lines">
        {order.lines.map((l) => {
          const lp = l.progressPercent ?? 0
          return (
            <div className="fps-line" key={l.productItemCode}>
              <span className="fps-line__nm">{l.productItemNm}</span>
              <div className="fps-bar is-thin" role="img" aria-label={`${l.productItemNm} ${lp}%`}>
                <span className={lp > 100 ? 'is-over' : ''} style={{ width: `${Math.min(100, lp)}%` }} />
              </div>
              <span className="fps-line__val">
                <b>{fmt(lp)}%</b> · 투입 {fmt(l.completedInputQty)} / {fmt(l.allocatedQty)}kg · 생산 {fmt(l.outputQty)}kg
              </span>
            </div>
          )
        })}
      </div>
    </article>
  )
}

// ── 담당자별 현황 ──────────────────────────────────────────────

function PeopleList({ managers, isToday }: { managers: FiberProductionManagerResponse[]; isToday: boolean }) {
  const day = isToday ? '오늘' : '기준일'
  if (managers.length === 0) return <p className="fps-empty">{day} 할 일이 있는 담당자가 없습니다.</p>

  return (
    <div className="fps-people">
      {managers.map((m) => {
        // 담당자 미지정 작업지시는 managerId = null → '담당자 미지정' 으로 따로 표시
        const assigned = !!m.managerId
        const nm = assigned ? m.managerNm || m.managerId! : '담당자 미지정'
        return (
          <div className="fps-person" key={m.managerId ?? 'unassigned'}>
            <span className={`fps-avatar ${assigned ? '' : 'is-none'}`} aria-hidden="true">
              {assigned ? nm[0] : '?'}
            </span>
            <div className="fps-personMain">
              <div className="fps-personTop">
                <b>{nm}</b>
                <span>
                  {day} 생산 {fmt(m.outputQty)}kg
                </span>
              </div>
              <div className="fps-chips">
                {m.inProgressCount > 0 && <span className="fps-chip run">작업 중 {m.inProgressCount}</span>}
                <span className="fps-chip done">
                  {day} 실적 {m.performanceCount}줄
                </span>
                <span className="fps-chip">남은 작업 {m.remainingCount}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 지금 작업 중 ───────────────────────────────────────────────

function RunningList({ list }: { list: FiberProductionInProgressResponse[] }) {
  if (list.length === 0) return <p className="fps-empty">지금 작업 중인 건이 없습니다.</p>

  return (
    <div className="fps-running">
      {list.map((w) => {
        // 요청 원물 대비 실적 투입 비율 (100% 초과 시 주황색)
        const p = w.requestInputQty ? (w.inputQty / w.requestInputQty) * 100 : 0
        return (
          <div className="fps-runCard" key={w.workId}>
            <div className="fps-runCard__t">
              <b>
                {w.bpNm} · {w.managerNm || '미지정'}
              </b>
              {/* 경과 시간 = 서버 응답 생성 시각 기준 */}
              <span>{elapsed(w.elapsedMinutes)}째</span>
            </div>
            <div className="fps-runCard__s">
              <code>{w.workId}</code> · {w.startAt.slice(5, 16).replace('T', ' ')} 시작 · 실적 {w.performanceCount}줄
            </div>
            <div className="fps-runNums">
              <div className="fps-bar is-thin">
                <span className={p > 100 ? 'is-over' : ''} style={{ width: `${Math.min(100, p)}%` }} />
              </div>
              <span>
                투입 <b>{fmt(w.inputQty)}</b> / {fmt(w.requestInputQty)}kg · 생산 <b>{fmt(w.outputQty)}</b>kg
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 페이지 ────────────────────────────────────────────────────

export function InpiProductionStatusPage() {
  // 기준일 ('' = 오늘, 서버에 date 파라미터를 보내지 않음)
  const [date, setDate] = useState('')
  const [data, setData] = useState<FiberProductionStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // 자동 새로고침 실패 시 기존 화면은 유지하고 상단에 경고만 표시 (모니터가 빈 화면이 되지 않도록)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  // 요청 순서 보장용 (늦게 도착한 이전 응답이 최신 화면을 덮어쓰지 않게 함)
  const requestSeq = useRef(0)

  const isToday = !date || date === todayString()

  // 조회: silent = true 면 스피너 없이 조용히 갱신 (자동 새로고침용)
  const load = useCallback(
    async (silent = false) => {
      const seq = ++requestSeq.current
      if (!silent) setIsLoading(true)
      try {
        const res = await FiberProductionStatusApi.getStatus(date ? { date } : undefined)
        if (seq !== requestSeq.current) return
        setData(res.data)
        setError(null)
      } catch (e) {
        if (seq !== requestSeq.current) return
        console.error('섬유동 작업현황 조회 실패:', e)
        setError(getErrorMessage(e, '작업현황을 불러오는 중 오류가 발생했습니다.'))
      } finally {
        if (seq === requestSeq.current) setIsLoading(false)
      }
    },
    [date],
  )

  // 기준일이 바뀌면 즉시 재조회 + 1분마다 자동 새로고침
  useEffect(() => {
    load(false)
    const timer = window.setInterval(() => load(true), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  // 탭이 다시 보이면(절전/탭 전환 복귀) 바로 갱신
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // 헤더 시계
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_MS)
    return () => window.clearInterval(timer)
  }, [])

  // 전체화면 토글 (공장 모니터용)
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }

  const baseDate = data?.baseDate ?? (date || todayString())
  const weekday = WEEK[new Date(`${baseDate}T00:00:00`).getDay()]
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <section className="screenStack fps-board">
      {/* 헤더: 제목 / 기준일 선택 / 시계 / 마지막 갱신 */}
      <div className="fps-head">
        <div>
          <h1>섬유동 작업현황</h1>
          <p>조회 전용 현황판 · 1분마다 자동 새로고침 · 작업지시 = 수주(거래처) 1건</p>
        </div>
        <div className="fps-headRight">
          <div className="fps-controls">
            <label className="fps-dateLabel" htmlFor="fps-date">
              기준일
            </label>
            <input
              id="fps-date"
              type="date"
              className="fps-dateInput"
              value={date || todayString()}
              onChange={(e) => setDate(e.target.value === todayString() ? '' : e.target.value)}
            />
            <button type="button" className="ghostButton" onClick={() => setDate('')} disabled={!date}>
              오늘
            </button>
            <button type="button" className="ghostButton" onClick={() => load(false)} disabled={isLoading}>
              새로고침
            </button>
            <button type="button" className="ghostButton" onClick={toggleFullscreen}>
              전체화면
            </button>
          </div>
          <div className="fps-clock">
            <strong>{clock}</strong>
            <span className="fps-live">
              <i />
              {baseDate} ({weekday}){data ? ` · 마지막 갱신 ${hhmm(data.generatedAt)}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 자동 새로고침 실패 안내 (기존 데이터는 그대로 유지) */}
      {error && (
        <div className="fps-error" role="alert">
          {error} {data ? '· 마지막으로 불러온 화면을 표시 중입니다.' : ''}
        </div>
      )}

      {isLoading && !data ? (
        <div className="fps-loading">
          <Spinner />
        </div>
      ) : data ? (
        <>
          <StatsSection summary={data.summary} isToday={isToday} />

          <div className="fps-layout">
            {/* 왼쪽: 수주별 진행률 (납기 빠른 순 - 서버가 정렬해서 내려줌) */}
            <Panel title="수주별 진행률">
              <div className="fps-orders">
                {data.orders.length === 0 ? (
                  <p className="fps-empty">진행 중인 수주가 없습니다.</p>
                ) : (
                  data.orders.map((o) => <OrderCard key={o.orderCode} order={o} />)
                )}
              </div>
              <p className="fps-note">
                진행률 = 실적으로 투입한 원물 ÷ 수주에서 제품에 배분한 원물(kg). 가공 손실이 있어 생산량은 투입량보다 적게
                나옵니다. 배분보다 더 투입하면 100%를 넘고 막대는 주황색으로 표시합니다.
              </p>
            </Panel>

            {/* 오른쪽: 담당자별 + 지금 작업 중 */}
            <div className="fps-col">
              <Panel title={isToday ? '담당자별 오늘' : '담당자별 기준일'}>
                <PeopleList managers={data.managers} isToday={isToday} />
              </Panel>
              <Panel title={`지금 작업 중 (${data.inProgress.length}건)`}>
                <RunningList list={data.inProgress} />
              </Panel>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
