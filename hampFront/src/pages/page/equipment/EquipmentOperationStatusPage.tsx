import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import "./Equipment.css";

type TabId = "food" | "fiber";

/* ══════════════════════════════════════════
   타입 / 상수
══════════════════════════════════════════ */
type EquipmentRunState = "running" | "idle" | "maintenance" | "stopped";
type StatusFilter = "all" | EquipmentRunState;

interface EquipmentStatus {
  state: EquipmentRunState;
  /** 가동률(%). running 상태일 때만 의미있는 값 */
  utilization: number;
  /** 최근 상태 갱신 시각 (ISO) */
  updatedAt: string;
}

type EquipmentId = string;

const STATE_LABEL: Record<EquipmentRunState, string> = {
  running: "가동중",
  idle: "대기",
  maintenance: "점검중",
  stopped: "정지",
};

const FILTER_ORDER: EquipmentRunState[] = ["running", "idle", "maintenance", "stopped"];

/* 실제 연동 시 설비관리 마스터 PK를 채워서 사용
   예) EQUIPMENT_MASTER_ID_MAP['food-peel'] = 1024 */
const EQUIPMENT_MASTER_ID_MAP: Partial<Record<EquipmentId, number>> = {};

/* ══════════════════════════════════════════
   Mock 데이터 (실연동 시 mockFetchEquipmentStatusAsync 만 교체)
══════════════════════════════════════════ */
const TRANSITION_TABLE: Record<EquipmentRunState, [EquipmentRunState, number][]> = {
  running: [
    ["running", 0.85],
    ["idle", 0.06],
    ["maintenance", 0.05],
    ["stopped", 0.04],
  ],
  idle: [
    ["running", 0.4],
    ["idle", 0.5],
    ["maintenance", 0.06],
    ["stopped", 0.04],
  ],
  maintenance: [
    ["maintenance", 0.6],
    ["running", 0.32],
    ["stopped", 0.08],
  ],
  stopped: [
    ["stopped", 0.5],
    ["maintenance", 0.3],
    ["running", 0.2],
  ],
};

function nextRunState(current: EquipmentRunState): EquipmentRunState {
  const roll = Math.random();
  let acc = 0;
  for (const [state, probability] of TRANSITION_TABLE[current]) {
    acc += probability;
    if (roll <= acc) return state;
  }
  return current;
}

function nextUtilization(prev: number, state: EquipmentRunState): number {
  if (state !== "running") return 0;
  if (prev <= 0) return Math.round(60 + Math.random() * 20);
  const drift = (Math.random() - 0.5) * 16;
  return Math.min(100, Math.max(45, Math.round(prev + drift)));
}

function mockFetchEquipmentStatus(
  ids: EquipmentId[],
  prev: Record<EquipmentId, EquipmentStatus>,
): Record<EquipmentId, EquipmentStatus> {
  const now = new Date().toISOString();
  const next: Record<EquipmentId, EquipmentStatus> = {};
  for (const id of ids) {
    const prevState = prev[id]?.state ?? "idle";
    const state = nextRunState(prevState);
    next[id] = { state, utilization: nextUtilization(prev[id]?.utilization ?? 0, state), updatedAt: now };
  }
  return next;
}

async function mockFetchEquipmentStatusAsync(
  ids: EquipmentId[],
  prev: Record<EquipmentId, EquipmentStatus>,
): Promise<Record<EquipmentId, EquipmentStatus>> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (Math.random() < 0.08) throw new Error("설비 상태 조회 실패 (네트워크 오류)");
  return mockFetchEquipmentStatus(ids, prev);
}

/**
 * 실시간 설비 운영상태 훅
 * - ids는 모듈 상수라 참조가 안정적이므로 deps에 그대로 사용 (join(',') 우회 불필요)
 * - inFlightRef: 응답이 interval보다 늦을 때 요청이 겹쳐 상태가 역전되는 것을 방지
 */
function useRealtimeEquipmentStatus(ids: EquipmentId[], intervalMs = 4000) {
  const [statusMap, setStatusMap] = useState<Record<EquipmentId, EquipmentStatus>>({});
  const statusMapRef = useRef(statusMap);
  useEffect(() => {
    statusMapRef.current = statusMap;
  }, [statusMap]);

  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const inFlightRef = useRef(false);

  const refreshNow = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      // TODO: 실연동 시 API 호출로 교체 (예: await EquipmentApi.getStatus(ids))
      const next = await mockFetchEquipmentStatusAsync(ids, statusMapRef.current);
      setStatusMap(next);
      setLastUpdatedAt(new Date());
      setConsecutiveFailures(0);
    } catch (err) {
      setConsecutiveFailures((c) => c + 1);
      console.error("[EquipmentStatus] 상태 조회 실패:", err);
    } finally {
      inFlightRef.current = false;
    }
  }, [ids]);

  useEffect(() => {
    refreshNow();
  }, [refreshNow]);

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(refreshNow, intervalMs);
    return () => clearInterval(timer);
  }, [isLive, intervalMs, refreshNow]);

  return {
    statusMap,
    lastUpdatedAt,
    isLive,
    setIsLive,
    refreshNow,
    consecutiveFailures,
    isError: consecutiveFailures > 0,
  };
}

function formatElapsed(date: Date | null, now: Date) {
  if (!date) return "-";
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 1) return "방금 전";
  if (diffSec < 60) return `${diffSec}초 전`;
  return `${Math.floor(diffSec / 60)}분 전`;
}

/* ══════════════════════════════════════════
   설비 ID
══════════════════════════════════════════ */
const FOOD_EQUIPMENT_IDS = [
  "food-peel",
  "food-wash",
  "food-dry",
  "food-press",
  "food-filter",
  "food-tank",
  "food-fill",
  "food-extract-heat",
  "food-concentrate",
  "food-grind",
  "food-extract-sc",
  "food-pack-oil",
  "food-select",
  "food-powder-tank",
  "food-pack-powder",
];
const FIBER_EQUIPMENT_IDS = [
  "fiber-scutch",
  "fiber-refine",
  "fiber-dry",
  "fiber-dehydrate",
  "fiber-compress",
  "fiber-open-fiber",
  "fiber-open-cotton",
  "fiber-card",
  "fiber-pack",
];
const ALL_EQUIPMENT_IDS = [...FOOD_EQUIPMENT_IDS, ...FIBER_EQUIPMENT_IDS];

/* ══════════════════════════════════════════
   페이지
══════════════════════════════════════════ */
export function EquipmentOperationStatusPage() {
  const [tab, setTab] = useState<TabId>("food");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const { statusMap, lastUpdatedAt, isLive, setIsLive, refreshNow, consecutiveFailures, isError } =
    useRealtimeEquipmentStatus(ALL_EQUIPMENT_IDS, 4000);

  const summary = useMemo(() => {
    const counts: Record<EquipmentRunState, number> = { running: 0, idle: 0, maintenance: 0, stopped: 0 };
    let runningUtilSum = 0;
    let total = 0;
    for (const id of ALL_EQUIPMENT_IDS) {
      const s = statusMap[id];
      if (!s) continue;
      total += 1;
      counts[s.state] += 1;
      if (s.state === "running") runningUtilSum += s.utilization;
    }
    const avgUtilization = counts.running > 0 ? Math.round(runningUtilSum / counts.running) : 0;
    return { counts, avgUtilization, total };
  }, [statusMap]);

  return (
    <section className="screenStack eq">
      <EquipmentHeader
        summary={summary}
        isLive={isLive}
        onToggleLive={() => setIsLive((v) => !v)}
        onRefresh={refreshNow}
        lastUpdatedAt={lastUpdatedAt}
      />

      <div className="eqCard">
        <div className="eqCard__bar">
          <div className="eqTabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === "food"}
              className={`eqTab${tab === "food" ? " eqTab--on" : ""}`}
              onClick={() => setTab("food")}
            >
              식품 가공공정
            </button>
            <button
              role="tab"
              aria-selected={tab === "fiber"}
              className={`eqTab${tab === "fiber" ? " eqTab--on" : ""}`}
              onClick={() => setTab("fiber")}
            >
              단섬유 가공공정
            </button>
          </div>

          <div className="eqFilters">
            <button className={`eqFilter${filter === "all" ? " eqFilter--on" : ""}`} onClick={() => setFilter("all")}>
              전체
            </button>
            {FILTER_ORDER.map((s) => (
              <button
                key={s}
                className={`eqFilter eqFilter--${s}${filter === s ? " eqFilter--on" : ""}`}
                onClick={() => setFilter((f) => (f === s ? "all" : s))}
              >
                <span className="eqFilter__dot" />
                {STATE_LABEL[s]}
                <em>{summary.counts[s]}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="eqCard__canvas">
          {tab === "food" ? (
            <FoodFlow statusMap={statusMap} filter={filter} />
          ) : (
            <FiberFlow statusMap={statusMap} filter={filter} />
          )}
        </div>

        {isError && (
          <div className="eqCard__overlay">
            <div className="eqAlert" role="alert">
              <span className="eqAlert__icon">!</span>
              <div className="eqAlert__text">
                <strong>실시간 연동에 실패했습니다</strong>
                <p>연속 {consecutiveFailures}회 실패 · 마지막으로 정상 수신된 데이터를 표시 중입니다.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════
   "N초 전" 라벨 - 자기 자신만 매초 리렌더
══════════════════════════════════════════ */
function ElapsedLabel({ lastUpdatedAt }: { lastUpdatedAt: Date | null }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formatElapsed(lastUpdatedAt, new Date())}</>;
}

/* ══════════════════════════════════════════
   헤더: 타이틀 + KPI 3종 + 액션
══════════════════════════════════════════ */
type Summary = {
  counts: Record<EquipmentRunState, number>;
  avgUtilization: number;
  total: number;
};

function EquipmentHeader({
  summary,
  isLive,
  onToggleLive,
  onRefresh,
  lastUpdatedAt,
}: {
  summary: Summary;
  isLive: boolean;
  onToggleLive: () => void;
  onRefresh: () => void;
  lastUpdatedAt: Date | null;
}) {
  const abnormal = summary.counts.stopped + summary.counts.maintenance;
  const hasStopped = summary.counts.stopped > 0;

  return (
    <header className="eqHead">
      <div className="eqHead__title">
        <h2>실시간 설비 운영상태</h2>
        <p>
          <span className={`eqLive${isLive ? " eqLive--on" : ""}`} />
          {isLive ? "실시간 연동 중" : "연동 일시정지"} · 업데이트 <ElapsedLabel lastUpdatedAt={lastUpdatedAt} />
        </p>
      </div>

      <div className="eqHead__actions">
        <button
          className={`eqBtn eqBtn--pill${isLive ? " eqBtn--on" : ""}`}
          onClick={onToggleLive}
          title={isLive ? "자동 갱신을 일시정지합니다" : "자동 갱신을 다시 시작합니다"}
        >
          {isLive ? "일시정지" : "재시작"}
        </button>
        <button className="eqBtn eqBtn--icon" onClick={onRefresh} title="지금 바로 새로고침" aria-label="새로고침">
          ↻
        </button>
      </div>

      <div className="eqKpis">
        <Kpi
          value={summary.counts.running}
          unit={`/ ${summary.total || ALL_EQUIPMENT_IDS.length}`}
          label="가동중 설비"
          tone="running"
        />
        <Kpi value={summary.avgUtilization} unit="%" label="평균 가동률" tone="running" />
        <Kpi
          value={abnormal}
          unit="대"
          label="점검 · 정지"
          tone={hasStopped ? "stopped" : abnormal > 0 ? "maintenance" : "running"}
        />
      </div>
    </header>
  );
}

function Kpi({ value, unit, label, tone }: { value: number; unit: string; label: string; tone: EquipmentRunState }) {
  return (
    <div className={`eqKpi eqKpi--${tone}`}>
      <div className="eqKpi__label">
        <span className="eqKpi__dot" />
        {label}
      </div>
      <div className="eqKpi__num">
        {value}
        <small>{unit}</small>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   범례
══════════════════════════════════════════ */
function Legend({ items }: { items: { bg: string; border?: string; dash?: boolean; label: string }[] }) {
  return (
    <div className="eqLegend">
      {items.map((it, i) => (
        <div key={i} className="eqLegend__item">
          <span
            className="eqLegend__dot"
            style={{
              background: it.bg,
              border: it.border ? `1px ${it.dash ? "dashed" : "solid"} ${it.border}` : undefined,
            }}
          />
          {it.label}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   공정 박스
   - 상세 팝오버는 portal + fixed 로 렌더링한다.
     (패널의 overflow-x:auto 가 overflow-y 까지 auto 로 만들어 팝오버가 잘리던 게 근본 원인이라,
      z-index !important 로 덮는 대신 DOM 위치 자체를 패널 밖으로 뺐다)
══════════════════════════════════════════ */
type PopPos = { x: number; y: number; up: boolean };

const Box = ({
  label,
  sub,
  equipmentId,
  status,
  filter,
}: {
  label: string;
  sub?: string;
  equipmentId?: EquipmentId;
  status?: EquipmentStatus;
  filter: StatusFilter;
}) => {
  const [pop, setPop] = useState<PopPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const clickable = Boolean(equipmentId && status);
  const open = pop !== null;

  useEffect(() => {
    setPop(null);
  }, [equipmentId]);

  useEffect(() => {
    if (!open) return;
    const close = () => setPop(null);
    const handlePointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, true); // 스크롤 시 위치가 어긋나므로 닫기
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggleOpen = () => {
    if (!clickable || !rootRef.current) return;
    if (pop) return setPop(null);
    const r = rootRef.current.getBoundingClientRect();
    const up = r.bottom + 200 > window.innerHeight;
    setPop({
      x: Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130),
      y: up ? r.top - 10 : r.bottom + 10,
      up,
    });
  };

  const handleKeyActivate = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleOpen();
    }
  };

  const dim = filter !== "all" && status && status.state !== filter;
  const stateClass = status ? ` flow__box--${status.state}` : "";

  return (
    <>
      <div
        ref={rootRef}
        className={`flow__node flow__box${stateClass}${clickable ? " flow__box--clickable" : ""}${open ? " flow__box--open" : ""}${dim ? " flow__box--dim" : ""}`}
        onClick={toggleOpen}
        onKeyDown={clickable ? handleKeyActivate : undefined}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-expanded={clickable ? open : undefined}
        aria-label={clickable ? `${label} - ${STATE_LABEL[status!.state]}, 상세정보 보기` : undefined}
      >
        <div className="flow__head">
          <span className="flow__dot" />
          <span className="flow__label">{label}</span>
          {sub && <span className="flow__sub">{sub}</span>}
        </div>

        <div className="flow__meta">
          <span className="flow__state">{status ? STATE_LABEL[status.state] : "수신 대기"}</span>
          <span className="flow__util">{status?.state === "running" ? `${status.utilization}%` : "–"}</span>
        </div>
      </div>

      {pop &&
        status &&
        createPortal(
          <div
            ref={popRef}
            className={`eqPop${pop.up ? " eqPop--up" : ""}`}
            style={{ left: pop.x, top: pop.y }}
            role="dialog"
            aria-label={`${label} 상세정보`}
          >
            <div className="eqPop__head">
              <strong>{label}</strong>
              <span className={`eqPop__state eqPop__state--${status.state}`}>
                <i />
                {STATE_LABEL[status.state]}
              </span>
            </div>
            {status.state === "running" && (
              <div className="eqPop__util">
                <div className="eqPop__row">
                  <span>가동률</span>
                  <strong>{status.utilization}%</strong>
                </div>
              </div>
            )}
            <div className="eqPop__row">
              <span>설비 ID</span>
              <strong>{EQUIPMENT_MASTER_ID_MAP[equipmentId!] ?? equipmentId}</strong>
            </div>
            <div className="eqPop__row">
              <span>갱신 시각</span>
              <strong>{new Date(status.updatedAt).toLocaleTimeString("ko-KR")}</strong>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

const Pill = ({ label }: { label: string }) => <div className="flow__node flow__pill">{label}</div>;
const Amber = ({ label }: { label: string }) => <div className="flow__node flow__amber">{label}</div>;
const Tag = ({ label }: { label: string }) => <div className="flow__node flow__tag">{label}</div>;
const Arr = () => <span className="flow__arr" aria-hidden />;
const ArrDash = () => <span className="flow__arr flow__arr--dash" aria-hidden />;

type FlowProps = { statusMap: Record<EquipmentId, EquipmentStatus>; filter: StatusFilter };

/* ══════════════════════════════════════════
   세로 트리 (부모 아래로 내려가며, 분기점에서 좌우로 갈라진다)
   - 자식이 1개면 직선, 2개 이상이면 가로 bus + 각 자식으로 내려가는 선
   - 연결선은 CSS 로만 그린다
══════════════════════════════════════════ */
type VNode = { node: ReactNode; children?: VNode[] };

const VLine = ({ className = "" }: { className?: string }) => (
  <span className={`flow__vline ${className}`.trim()} aria-hidden />
);

function VTree({ item }: { item: VNode }) {
  const kids = item.children;

  if (!kids?.length) return <div className="vt">{item.node}</div>;

  if (kids.length === 1) {
    return (
      <div className="vt">
        {item.node}
        <VLine className="flow__vline--end" />
        <VTree item={kids[0]} />
      </div>
    );
  }

  return (
    <div className="vt">
      {item.node}
      <VLine className="flow__vline--half" />
      <div className="vt__kids">
        {kids.map((kid, i) => (
          <div key={i} className="vt__kid">
            <VLine className="flow__vline--half flow__vline--end vt__stub" />
            <VTree item={kid} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* 전처리 박스 아래로 내려가는 라인 (부모 박스 가운데 정렬) */
function Lane({ className, item }: { className: string; item: VNode }) {
  return (
    <div className={`flow__lane ${className}`}>
      <VLine className="flow__vline--end" />
      <VTree item={item} />
    </div>
  );
}

/* ══════════════════════════════
   식품 가공공정
   1행: 헴프 씨 → 겉피 탈피 → 세척 → 건조 → 전처리 완료된 씨드
   2행: 겉피 탈피 ↓ 착유 / 세척 ↓ 분쇄 / 건조 ↓ 선별 (각 부모 박스 가운데 아래)
══════════════════════════════ */
function FoodFlow({ statusMap, filter }: FlowProps) {
  const B = (id: string, label: string, sub?: string) => (
    <Box label={label} sub={sub} equipmentId={id} status={statusMap[id]} filter={filter} />
  );

  /* 겉피 탈피 ↓ 착유 */
  const peelLane: VNode = {
    node: B("food-press", "착유"),
    children: [
      {
        node: B("food-filter", "필터링"),
        children: [
          {
            node: B("food-tank", "탱크저장"),
            children: [{ node: B("food-fill", "충진 / 포장"), children: [{ node: <Pill label="헴프오일" /> }] }],
          },
        ],
      },
      {
        node: B("food-extract-heat", "열수 추출"),
        children: [{ node: B("food-concentrate", "농축"), children: [{ node: <Pill label="헴프박 농축액" /> }] }],
      },
    ],
  };

  /* 세척 ↓ 분쇄 */
  const washLane: VNode = {
    node: B("food-grind", "분쇄"),
    children: [
      {
        node: B("food-extract-sc", "초임계 추출"),
        children: [{ node: B("food-pack-oil", "계량 / 포장"), children: [{ node: <Pill label="초임계 추출물" /> }] }],
      },
    ],
  };

  /* 건조 ↓ 선별  ※ 헴프씨드 연결 위치는 실제 공정에 맞게 조정 */
  const dryLane: VNode = {
    node: B("food-select", "선별"),
    children: [
      {
        node: B("food-powder-tank", "분말저장"),
        children: [
          { node: B("food-pack-powder", "계량 / 포장"), children: [{ node: <Pill label="단백질 파우더" /> }] },
        ],
      },
      { node: <Pill label="헴프씨드" /> },
    ],
  };

  return (
    <div className="flow flow--food">
      <Legend
        items={[
          { bg: "var(--eq-run)", label: "투입 원물 / 최종 제품" },
          { bg: "var(--eq-surface)", border: "var(--eq-line-strong)", label: "공정 단계 (클릭 시 상세정보)" },
          { bg: "var(--eq-warn-soft)", border: "var(--eq-warn)", dash: true, label: "부산물 처리" },
        ]}
      />

      {/* 1행: 전처리 라인 / 2행: 겉피·세척·건조 각각의 하위 라인 */}
      <div className="flow__foodGrid">
        <Pill label="헴프 씨" />
        <Arr />
        {B("food-peel", "겉피 탈피")}
        <Arr />
        {B("food-wash", "세척", "(탈피 / 세척)")}
        <Arr />
        {B("food-dry", "건조")}
        <Arr />
        <div className="flow__seedPill">
          <div className="flow__node flow__pill flow__pill--col">전처리 완료된 씨드</div>
          <div className="flow__byproduct">
            <ArrDash />
            <Amber label="슬러지 / 껍질 신고반납" />
          </div>
        </div>

        <Lane className="flow__lane--peel" item={peelLane} />
        <Lane className="flow__lane--wash" item={washLane} />
        <Lane className="flow__lane--dry" item={dryLane} />
      </div>
    </div>
  );
}

/* ══════════════════════════════
   단섬유 가공공정
   1행: 줄기 → 스커칭 → 정련/표백 → 건조 → 탈수
   2행: (탈수에서 꺾여 내려옴) 압축 → 인피 → 개섬 → 개면 → 카딩 → 압축포장 → 헴프솜
══════════════════════════════ */
function FiberFlow({ statusMap, filter }: FlowProps) {
  const B = (id: string, label: string) => (
    <Box label={label} equipmentId={id} status={statusMap[id]} filter={filter} />
  );

  return (
    <div className="flow">
      <Legend
        items={[
          { bg: "var(--eq-run)", label: "투입 원물 / 최종 제품" },
          { bg: "var(--eq-surface)", border: "var(--eq-line-strong)", label: "공정 단계 (클릭 시 상세정보)" },
          { bg: "transparent", border: "var(--eq-line-strong)", dash: true, label: "연결 공정 경로" },
        ]}
      />

      <div className="flow__row">
        <div className="flow__node flow__pill flow__pill--box">줄기 (인피)</div>
        <Arr />
        {B("fiber-scutch", "스커칭")}
        <ArrDash />
        {B("fiber-refine", "정련 / 표백")}
        <Arr />
        {B("fiber-dry", "건조")}
        <Arr />
        {B("fiber-dehydrate", "탈수")}
      </div>

      {/* 탈수 → 압축 연결 (1행 끝에서 2행 시작으로 꺾임) */}
      <div className="flow__elbow" aria-hidden>
        <i />
        <i />
        <i />
      </div>

      <div className="flow__row flow__row--indent">
        {B("fiber-compress", "압축")}
        <ArrDash />
        <Tag label="인피" />
        <ArrDash />
        {B("fiber-open-fiber", "개섬")}
        <Arr />
        {B("fiber-open-cotton", "개면")}
        <Arr />
        {B("fiber-card", "카딩")}
        <Arr />
        {B("fiber-pack", "압축포장")}
        <Arr />
        <Pill label="헴프솜" />
      </div>
    </div>
  );
}
