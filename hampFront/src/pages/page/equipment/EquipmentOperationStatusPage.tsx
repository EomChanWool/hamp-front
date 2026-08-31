import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import './Equipment.css'

type TabId = 'food' | 'fiber'

/* ══════════════════════════════════════════
   실시간 설비 운영상태 - 타입 정의
══════════════════════════════════════════ */

// 설비(공정 단계) 하나의 운영상태
type EquipmentRunState = 'running' | 'idle' | 'maintenance' | 'stopped'

interface EquipmentStatus {
  state: EquipmentRunState
  /** 가동률(%). running 상태일 때만 의미있는 값으로 취급 */
  utilization: number
  /** 최근 상태가 갱신된 시각 (ISO 문자열) */
  updatedAt: string
}

// 화면에 배치된 각 공정 박스에 부여하는 고유 설비 ID (프론트 내부 키)
type EquipmentId = string

const STATE_LABEL: Record<EquipmentRunState, string> = {
  running: '가동중',
  idle: '대기',
  maintenance: '점검중',
  stopped: '정지',
}

/* ══════════════════════════════════════════
   아래 EquipmentId(예: 'food-peel')는 화면 배치 순서에 맞춰 붙인 임시 키입니다.
   실제 연동 시에는 설비관리 마스터의 진짜 equipmentId(PK)를 여기에 채워서
   API 요청/응답을 이 값과 매핑하세요.
   예) EQUIPMENT_MASTER_ID_MAP['food-peel'] = 1024
══════════════════════════════════════════ */
const EQUIPMENT_MASTER_ID_MAP: Partial<Record<EquipmentId, number>> = {
 
}

/* ══════════════════════════════════════════
   실시간 데이터 연동 (Mock)
   ------------------------------------------------
    실제 백엔드 연동 시 mockFetchEquipmentStatusAsync 함수만 교체하면 됩니다.
      예) REST 폴링: GET /api/equipment/status?ids=...
          WebSocket/SSE 구독: 설비 상태 변경 이벤트 push
      나머지 훅(useRealtimeEquipmentStatus) 로직은 그대로 재사용 가능합니다.
══════════════════════════════════════════ */

// 상태가 매 주기마다 완전히 랜덤으로 튀지 않도록,
// 현재 상태를 기준으로 다음 상태를 확률적으로 전이시키는 간단한 마르코프 체인
const TRANSITION_TABLE: Record<EquipmentRunState, [EquipmentRunState, number][]> = {
  running: [
    ['running', 0.85],
    ['idle', 0.06],
    ['maintenance', 0.05],
    ['stopped', 0.04],
  ],
  idle: [
    ['running', 0.4],
    ['idle', 0.5],
    ['maintenance', 0.06],
    ['stopped', 0.04],
  ],
  maintenance: [
    ['maintenance', 0.6],
    ['running', 0.32],
    ['stopped', 0.08],
  ],
  stopped: [
    ['stopped', 0.5],
    ['maintenance', 0.3],
    ['running', 0.2],
  ],
}

function nextRunState(current: EquipmentRunState): EquipmentRunState {
  const roll = Math.random()
  let acc = 0
  for (const [state, probability] of TRANSITION_TABLE[current]) {
    acc += probability
    if (roll <= acc) return state
  }
  return current
}

// 가동률도 매번 널뛰지 않고, 이전 값에서 조금씩 드리프트하도록 처리
function nextUtilization(prevUtilization: number, state: EquipmentRunState): number {
  if (state !== 'running') return 0
  if (prevUtilization <= 0) {
    // 방금 막 가동을 시작한 경우의 초기 가동률
    return Math.round(60 + Math.random() * 20)
  }
  const drift = (Math.random() - 0.5) * 16 // ±8%p 내외로 완만하게 변화
  return Math.min(100, Math.max(45, Math.round(prevUtilization + drift)))
}

function mockFetchEquipmentStatus(
  ids: EquipmentId[],
  prev: Record<EquipmentId, EquipmentStatus>,
): Record<EquipmentId, EquipmentStatus> {
  const now = new Date().toISOString()
  const next: Record<EquipmentId, EquipmentStatus> = {}
  for (const id of ids) {
    const prevState = prev[id]?.state ?? 'idle'
    const prevUtilization = prev[id]?.utilization ?? 0
    const state = nextRunState(prevState)
    next[id] = {
      state,
      utilization: nextUtilization(prevUtilization, state),
      updatedAt: now,
    }
  }
  return next
}

// 실제 네트워크 통신처럼 지연/실패가 있을 수 있음을 흉내낸 async 래퍼.
// 실제 연동 시 이 함수 내부를 fetch() 호출로 그대로 바꿔치기하면 된다.
async function mockFetchEquipmentStatusAsync(
  ids: EquipmentId[],
  prev: Record<EquipmentId, EquipmentStatus>,
): Promise<Record<EquipmentId, EquipmentStatus>> {
  await new Promise(resolve => setTimeout(resolve, 150)) // 네트워크 지연 흉내

  // 8% 확률로 통신 실패를 흉내내어, 실패 시 배너 노출 / 이전 데이터 유지 로직을 검증
  if (Math.random() < 0.08) {
    throw new Error('설비 상태 조회 실패 (네트워크 오류)')
  }
  return mockFetchEquipmentStatus(ids, prev)
}

/**
 * 실시간 설비 운영상태 훅
 * - intervalMs 주기로 상태를 폴링(polling)하여 statusMap을 갱신한다.
 * - isLive를 false로 두면 자동 갱신을 멈추고, refreshNow()로 수동 갱신만 가능하다.
 * - 조회 실패 시 statusMap은 마지막으로 성공한 값을 그대로 유지하고,
 *   consecutiveFailures 카운트만 증가시켜 상위 컴포넌트가 실패 배너를 띄울 수 있게 한다.
 */
function useRealtimeEquipmentStatus(ids: EquipmentId[], intervalMs = 4000) {
  const [statusMap, setStatusMap] = useState<Record<EquipmentId, EquipmentStatus>>({})
  const statusMapRef = useRef(statusMap)
  useEffect(() => {
    statusMapRef.current = statusMap
  }, [statusMap])

  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [isLive, setIsLive] = useState(true)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshNow = useCallback(async () => {
    try {
      // TODO: 실제 연동 시 이 부분을 API 호출로 교체 (예: await EquipmentApi.getStatus(ids))
      const next = await mockFetchEquipmentStatusAsync(ids, statusMapRef.current)
      setStatusMap(next)
      setLastUpdatedAt(new Date())
      setConsecutiveFailures(0)
    } catch (err) {
      // 실패해도 화면의 기존 데이터는 그대로 유지하고, 실패 횟수만 누적해 배너로 안내
      setConsecutiveFailures(c => c + 1)
      console.error('[EquipmentStatus] 상태 조회 실패:', err)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

  // 최초 1회 즉시 조회
  useEffect(() => {
    refreshNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

  // 실시간(폴링) 갱신
  useEffect(() => {
    if (!isLive) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(refreshNow, intervalMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isLive, intervalMs, refreshNow])

  return {
    statusMap,
    lastUpdatedAt,
    isLive,
    setIsLive,
    refreshNow,
    consecutiveFailures,
    isError: consecutiveFailures > 0,
  }
}

/** "몇 초 전" 형태로 상대 시간 표시 */
function formatElapsed(date: Date | null, now: Date) {
  if (!date) return '-'
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))
  if (diffSec < 1) return '방금 전'
  if (diffSec < 60) return `${diffSec}초 전`
  return `${Math.floor(diffSec / 60)}분 전`
}

/* ══════════════════════════════════════════
   화면 전체에서 쓰이는 설비 ID 정의
   (식품 가공공정 + 단섬유 가공공정에 배치된 모든 공정 박스)
══════════════════════════════════════════ */
const FOOD_EQUIPMENT_IDS = [
  'food-peel', // 겉피 탈피
  'food-wash', // 세척
  'food-dry', // 건조
  'food-press', // 착유
  'food-filter', // 필터링
  'food-tank', // 탱크저장
  'food-fill', // 충진/포장
  'food-extract-heat', // 열수 추출
  'food-concentrate', // 농축
  'food-grind', // 분쇄
  'food-extract-sc', // 초임계 추출
  'food-pack-oil', // 계량/포장 (오일 계열)
  'food-select', // 선별
  'food-powder-tank', // 분말저장
  'food-pack-powder', // 계량/포장 (분말 계열)
]

const FIBER_EQUIPMENT_IDS = [
  'fiber-scutch', // 스커칭
  'fiber-refine', // 정련/표백
  'fiber-dry', // 건조
  'fiber-dehydrate', // 탈수
  'fiber-compress', // 압축
  'fiber-open-fiber', // 개섬
  'fiber-open-cotton', // 개면
  'fiber-card', // 카딩
  'fiber-pack', // 압축포장
]

const ALL_EQUIPMENT_IDS = [...FOOD_EQUIPMENT_IDS, ...FIBER_EQUIPMENT_IDS]

export function EquipmentOperationStatusPage() {
  const [tab, setTab] = useState<TabId>('food')

  // 화면에 존재하는 모든 설비를 한 번에 폴링 → 탭을 전환해도 다시 조회하지 않아도 됨
  const {
    statusMap,
    lastUpdatedAt,
    isLive,
    setIsLive,
    refreshNow,
    consecutiveFailures,
    isError,
  } = useRealtimeEquipmentStatus(
    ALL_EQUIPMENT_IDS,
    4000, // 4초마다 자동 갱신 (실연동 시 설비관리 정책에 맞게 조정)
  )

  // 상단 요약(가동중/대기/점검중/정지 카운트, 평균 가동률)에 쓸 통계 계산
  // 계산은 statusMap이 바뀔 때만 다시 하면 되고,
  // "N초 전" 표시용 시계와는 완전히 분리되어 있어 매초 재계산되지 않는다.
  const summary = useMemo(() => {
    const values = Object.values(statusMap)
    const counts: Record<EquipmentRunState, number> = { running: 0, idle: 0, maintenance: 0, stopped: 0 }
    let runningUtilSum = 0
    for (const s of values) {
      counts[s.state] += 1
      if (s.state === 'running') runningUtilSum += s.utilization
    }
    const avgUtilization = counts.running > 0 ? Math.round(runningUtilSum / counts.running) : 0
    return { counts, avgUtilization, total: values.length }
  }, [statusMap])

  return (
    <section className="screenStack">
      <RealtimeStatusBar
        summary={summary}
        isLive={isLive}
        onToggleLive={() => setIsLive(v => !v)}
        onRefresh={refreshNow}
        lastUpdatedAt={lastUpdatedAt}
        isError={isError}
        consecutiveFailures={consecutiveFailures}
      />

      <div className="hpf">
        <div className="hpf__tabbar">
          <button className={`hpf__tab${tab === 'food' ? ' hpf__tab--on' : ''}`} onClick={() => setTab('food')}>식품 가공공정</button>
          <button className={`hpf__tab${tab === 'fiber' ? ' hpf__tab--on' : ''}`} onClick={() => setTab('fiber')}>단섬유 가공공정</button>
        </div>
        <div className="hpf__panel">
          {tab === 'food' ? <FoodFlow statusMap={statusMap} /> : <FiberFlow statusMap={statusMap} />}
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════
  "N초 전" 라벨 전용 컴포넌트
   ------------------------------------------------
   1초마다 자기 자신만 리렌더링되도록 분리했다.
   이렇게 하지 않으면 상위(EquipmentOperationStatusPage)에 시계 state를 두게 되고,
   그 아래의 FoodFlow/FiberFlow 전체가 매초 다시 렌더링되는 비효율이 생긴다.
══════════════════════════════════════════ */
function ElapsedLabel({ lastUpdatedAt }: { lastUpdatedAt: Date | null }) {
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick(v => v + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="rts__updated">업데이트: {formatElapsed(lastUpdatedAt, new Date())}</span>
}

/* ══════════════════════════════════════════
   상단 실시간 운영현황 요약 바
══════════════════════════════════════════ */
function RealtimeStatusBar({
  summary,
  isLive,
  onToggleLive,
  onRefresh,
  lastUpdatedAt,
  isError,
  consecutiveFailures,
}: {
  summary: { counts: Record<EquipmentRunState, number>; avgUtilization: number; total: number }
  isLive: boolean
  onToggleLive: () => void
  onRefresh: () => void
  lastUpdatedAt: Date | null
  isError: boolean
  consecutiveFailures: number
}) {
  // 정지된 설비가 하나라도 있으면 상단 바 전체를 경고 톤으로 강조
  const hasCritical = summary.counts.stopped > 0

  return (
    <div className={`rts${hasCritical ? ' rts--alert' : ''}`}>
      <div className="rts__main">
        <div className="rts__left">
          <span className={`rts__liveDot${isLive ? ' rts__liveDot--on' : ''}`} />
          <span className="rts__title">{hasCritical ? '⚠ 실시간 운영현황' : '실시간 운영현황'}</span>
          <ElapsedLabel lastUpdatedAt={lastUpdatedAt} />
        </div>

        <div className="rts__stats">
          <StatChip state="running" count={summary.counts.running} />
          <StatChip state="idle" count={summary.counts.idle} />
          <StatChip state="maintenance" count={summary.counts.maintenance} />
          <StatChip state="stopped" count={summary.counts.stopped} />
          <div className="rts__avg">
            평균 가동률 <strong>{summary.avgUtilization}%</strong>
          </div>
        </div>

        <div className="rts__actions">
          <button
            className={`rts__toggle${isLive ? ' rts__toggle--on' : ''}`}
            onClick={onToggleLive}
            title={isLive ? '자동 갱신을 일시정지합니다' : '자동 갱신을 다시 시작합니다'}
          >
            {isLive ? '실시간 연동 중' : '연동 일시정지'}
          </button>
          <button className="rts__refresh" onClick={onRefresh} title="지금 바로 새로고침">
            ↻ 새로고침
          </button>
        </div>
      </div>

      {/* 조회 실패가 이어지는 동안 사용자에게 명시적으로 안내 */}
      {isError && (
        <div className="rts__errorBanner">
          ⚠ 실시간 연동에 실패했습니다 (연속 {consecutiveFailures}회) — 마지막으로 정상 수신된 데이터를 표시 중입니다.
        </div>
      )}
    </div>
  )
}

function StatChip({ state, count }: { state: EquipmentRunState; count: number }) {
  return (
    <div className={`rts__chip rts__chip--${state}`}>
      <span className="rts__chipDot" />
      {STATE_LABEL[state]} {count}
    </div>
  )
}

/* ══════════════════════════════════════════
   범례
══════════════════════════════════════════ */
function Legend({ items }: { items: { bg: string; border?: string; dash?: boolean; label: string }[] }) {
  return (
    <div className="hpf__legend">
      {items.map((it, i) => (
        <div key={i} className="hpf__leg">
          <span className="hpf__legDot" style={{ background: it.bg, border: it.border ? `1px ${it.dash ? 'dashed' : 'solid'} ${it.border}` : undefined }} />
          {it.label}
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════
   공정 박스 (Box) - 실시간 설비 상태 표시 지원
   ------------------------------------------------
   - equipmentId가 주어지면 statusMap에서 실시간 상태를 찾아
     우측 상단 뱃지 + 가동률 바 + (이상 상태 시) 박스 테두리 강조로 보여준다.
   - 점검중/정지 상태는 테두리 색과 은은한 배경 톤으로 더 눈에 띄게 표시한다.
   - 클릭/Enter/Space로 상세 팝오버를 열고, 바깥 클릭이나 Esc로 닫을 수 있다.
══════════════════════════════════════════ */
const Box = ({
  label,
  sub,
  equipmentId,
  status,
}: {
  label: string
  sub?: string
  equipmentId?: EquipmentId
  status?: EquipmentStatus
}) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const clickable = Boolean(equipmentId && status)

  // 4초마다 데이터가 갱신되거나 다른 장비와 엉키는 것을 방지하기 위해 ID가 바뀌면 팝오버 닫기
  useEffect(() => {
    setOpen(false)
  }, [equipmentId])

  // 팝오버가 열려 있는 동안 바깥을 클릭하거나 Esc를 누르면 닫히도록 처리
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const toggleOpen = () => clickable && setOpen(v => !v)
  const handleKeyActivate = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleOpen()
    }
  }

  const stateClass = status ? `flow__box--${status.state}` : ''

  return (
    <div
      ref={rootRef}
      className={`flow__node flow__box flow__box--lg ${stateClass}${clickable ? ' flow__box--clickable' : ''}${open ? ' flow__box--open' : ''}`}
      onClick={toggleOpen}
      onKeyDown={clickable ? handleKeyActivate : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-expanded={clickable ? open : undefined}
      aria-label={clickable ? `${label} - ${STATE_LABEL[status!.state]}, 상세정보 보기` : undefined}
    >
      {status && (
        <span className={`flow__statusBadge flow__statusBadge--${status.state}`}>
          <span className="flow__statusDot" />
          {STATE_LABEL[status.state]}
        </span>
      )}

      <span className="flow__label">{label}</span>
      {sub && <span className="flow__sub">{sub}</span>}

      {status && status.state === 'running' && (
        <div className="flow__utilBar" title={`가동률 ${status.utilization}%`}>
          <div className="flow__utilFill" style={{ width: `${status.utilization}%` }} />
        </div>
      )}

      {open && status && (
        <div className="flow__popover" onClick={e => e.stopPropagation()} role="dialog" aria-label={`${label} 상세정보`}>
          <div className="flow__popoverRow">
            <span>상태</span>
            <strong className={`flow__popoverState flow__popoverState--${status.state}`}>{STATE_LABEL[status.state]}</strong>
          </div>
          {status.state === 'running' && (
            <div className="flow__popoverRow">
              <span>가동률</span>
              <strong>{status.utilization}%</strong>
            </div>
          )}
          <div className="flow__popoverRow">
            <span>설비 ID</span>
            <strong>{EQUIPMENT_MASTER_ID_MAP[equipmentId!] ?? equipmentId}</strong>
          </div>
          <div className="flow__popoverRow">
            <span>갱신 시각</span>
            <strong>{new Date(status.updatedAt).toLocaleTimeString('ko-KR')}</strong>
          </div>
        </div>
      )}
    </div>
  )
}

const Pill = ({ label }: { label: string }) => (
  <div className="flow__node flow__pill flow__pill--lg">{label}</div>
)
const Amber = ({ label }: { label: string }) => (
  <div className="flow__node flow__amber flow__amber--lg">{label}</div>
)
const Arr = () => <span className="flow__arr">→</span>
const ArrD = () => <div className="flow__arrD">↓</div>
const ArrDash = () => <span className="flow__arr flow__arr--dash">⇢</span>

/* ══════════════════════════════
   식품 가공공정
══════════════════════════════ */
function FoodFlow({ statusMap }: { statusMap: Record<EquipmentId, EquipmentStatus> }) {
  return (
    <div className="flow flow--lg">
      <Legend items={[
        { bg: '#1D9E75', label: '투입 원물 / 최종 제품' },
        { bg: 'var(--bg-surface, #f9fafb)', border: '#9ca3af', label: '공정 단계 (클릭 시 실시간 상세정보)' },
        { bg: '#FAEEDA', border: '#EF9F27', dash: true, label: '부산물 처리' },
      ]} />

      {/* ── 1행: 전처리 ── */}
      <div className="flow__row">
        <Pill label="헴프 씨" />
        <Arr />
        <Box label="겉피 탈피" equipmentId="food-peel" status={statusMap['food-peel']} />
        <Arr />
        <Box label="세척" sub="(탈피/세척)" equipmentId="food-wash" status={statusMap['food-wash']} />
        <Arr />
        <Box label="건조" equipmentId="food-dry" status={statusMap['food-dry']} />
        <Arr />
        <div className="flow__node flow__pill flow__pill--lg" style={{ flex: 1, maxWidth: 220 }}>전처리 완료된 씨드</div>
        <div style={{ marginLeft: 12 }}>
          <Amber label="슬러지/껍질 신고반납" />
        </div>
      </div>

      {/* ── 2행: 착유/분쇄/선별 분기 ── */}
      <div className="flow__midSection">
        {/* 착유 계열 */}
        <div className="flow__col">
          <ArrD />
          <Box label="착유" equipmentId="food-press" status={statusMap['food-press']} />
          <div className="flow__col__branch">
            <div className="flow__col">
              <ArrD />
              <Box label="필터링" equipmentId="food-filter" status={statusMap['food-filter']} />
              <ArrD />
              <Box label="탱크저장" equipmentId="food-tank" status={statusMap['food-tank']} />
              <ArrD />
              <Box label="충진 / 포장" equipmentId="food-fill" status={statusMap['food-fill']} />
            </div>
            <div className="flow__col" style={{ marginLeft: 10 }}>
              <ArrD />
              <Box label="열수 추출" equipmentId="food-extract-heat" status={statusMap['food-extract-heat']} />
              <ArrD />
              <Box label="농축" equipmentId="food-concentrate" status={statusMap['food-concentrate']} />
              <div style={{ height: 54 }} />
            </div>
          </div>
        </div>

        <div className="flow__midSep" />

        {/* 분쇄 계열 */}
        <div className="flow__col">
          <ArrD />
          <Box label="분쇄" equipmentId="food-grind" status={statusMap['food-grind']} />
          <ArrD />
          <Box label="초임계 추출" equipmentId="food-extract-sc" status={statusMap['food-extract-sc']} />
          <ArrD />
          <Box label="계량 / 포장" equipmentId="food-pack-oil" status={statusMap['food-pack-oil']} />
        </div>

        <div className="flow__midSep" />

        {/* 선별 계열 */}
        <div className="flow__col">
          <ArrD />
          <Box label="선별" equipmentId="food-select" status={statusMap['food-select']} />
          <ArrD />
          <Box label="분말저장" equipmentId="food-powder-tank" status={statusMap['food-powder-tank']} />
          <ArrD />
          <Box label="계량 / 포장" equipmentId="food-pack-powder" status={statusMap['food-pack-powder']} />
        </div>
      </div>

      {/* ── 3행: 최종 제품 ── */}
      <div style={{ marginTop: 10 }}>
        <div className="flow__products">
          {['헴프오일', '헴프박 농축액', '초임계 추출물', '단백질 파우더', '헴프씨드'].map(p => (
            <Pill key={p} label={p} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════
   단섬유 가공공정
══════════════════════════════ */
function FiberFlow({ statusMap }: { statusMap: Record<EquipmentId, EquipmentStatus> }) {
  return (
    <div className="flow flow--lg">
      <Legend items={[
        { bg: '#1D9E75', label: '투입 원물 / 최종 제품' },
        { bg: 'var(--bg-surface, #f9fafb)', border: '#9ca3af', label: '공정 단계 (클릭 시 실시간 상세정보)' },
        { bg: 'transparent', border: '#9ca3af', dash: true, label: '연결 공정 경로' },
      ]} />

      <div className="flow__fiberWrap">
        {/* 왼쪽 원물 */}
        <div className="flow__fiberLeft">
          <Pill label="줄기 (인피)" />
        </div>

        <Arr />

        {/* 오른쪽 공정 */}
        <div className="flow__fiberRight">
          {/* 상단 경로: 스커칭 → 정련/표백 → 건조 → 탈수 */}
          <div className="flow__row" style={{ marginBottom: 10 }}>
            <Box label="스커칭" equipmentId="fiber-scutch" status={statusMap['fiber-scutch']} />
            <ArrDash />
            <Box label="정련 / 표백" equipmentId="fiber-refine" status={statusMap['fiber-refine']} />
            <Arr />
            <Box label="건조" equipmentId="fiber-dry" status={statusMap['fiber-dry']} />
            <Arr />
            <Box label="탈수" equipmentId="fiber-dehydrate" status={statusMap['fiber-dehydrate']} />
          </div>

          {/* 하단 경로: 압축 → 인피 분기 → 개섬 → 개면 → 카딩 → 압축포장 → 헴프솜 */}
          <div className="flow__row">
            <Box label="압축" equipmentId="fiber-compress" status={statusMap['fiber-compress']} />
            <ArrDash />
            <div className="flow__node flow__box flow__box--lg" style={{ fontSize: 13, padding: '10px 14px' }}>인피</div>
            <ArrDash />
            <Box label="개섬" equipmentId="fiber-open-fiber" status={statusMap['fiber-open-fiber']} />
            <Arr />
            <Box label="개면" equipmentId="fiber-open-cotton" status={statusMap['fiber-open-cotton']} />
            <Arr />
            <Box label="카딩" equipmentId="fiber-card" status={statusMap['fiber-card']} />
            <Arr />
            <Box label="압축포장" equipmentId="fiber-pack" status={statusMap['fiber-pack']} />
            <Arr />
            <Pill label="헴프솜" />
          </div>
        </div>
      </div>
    </div>
  )
}
