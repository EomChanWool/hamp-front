import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
   - 식품: 초임계 추출물이 충진 / 포장으로 합류하므로 food-pack-oil 은 제거
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

type FlowProps = { statusMap: Record<EquipmentId, EquipmentStatus>; filter: StatusFilter };

/* ══════════════════════════════════════════
   플로우 캔버스 (폭 100% · 가로로만 늘어남)
   - 디자인 좌표(최소 폭 designWidth) 기준으로 작성하고, 실제 폭이 더 넓으면
     가로 위치(X)와 박스 폭(Wd)만 늘린다. 글자 크기/높이/세로 간격은 그대로.
   - 연결선은 늘어난 실제 좌표로 다시 계산해서 SVG 로 그린다 (코너 반경 12 고정)
   - 위치 수정: build() 안의 cx(가운데 x) / y / w 와 edges 좌표만 고치면 된다
══════════════════════════════════════════ */
type Pt = [number, number];
interface Edge {
  /** 꺾이는 점 목록. 꺾이는 모서리는 자동으로 둥글게 처리 */
  paths: Pt[][];
  rings?: Pt[];
  tone?: "run" | "warn";
  dash?: boolean;
}
interface Place {
  x: number;
  y: number;
  w: number;
  h: number;
  node: ReactNode;
}
interface Layout {
  nodes: Place[];
  edges: Edge[];
}
interface Geo {
  /** 디자인 x(가운데 기준) → 실제 x */
  X: (x: number) => number;
  /** 디자인 폭 → 실제 폭 */
  Wd: (w: number) => number;
}
type LineOpt = Pick<Edge, "tone" | "dash">;

const BOX_W = 124;
const BOX_H = 84;
const PILL_H = 40;
const CORNER = 12;
/** 늘어난 폭 중 박스 폭으로 가는 비율 (나머지는 박스 사이 간격으로 간다) */
const WIDTH_SHARE = 0.4;

const hLine = (x1: number, x2: number, y: number, opt: LineOpt = {}): Edge => ({
  paths: [
    [
      [x1, y],
      [x2, y],
    ],
  ],
  rings: [[x2, y]],
  ...opt,
});
const vLine = (x: number, y1: number, y2: number, opt: LineOpt = {}): Edge => ({
  paths: [
    [
      [x, y1],
      [x, y2],
    ],
  ],
  rings: [[x, y2]],
  ...opt,
});

/** 꺾인 선 → path (모서리는 반경 CORNER 의 원호) */
function roundedPath(pts: Pt[]): string {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  const last = pts.length - 1;
  for (let i = 1; i < last; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const d1 = Math.hypot(cx - px, cy - py);
    const d2 = Math.hypot(nx - cx, ny - cy);
    if (!d1 || !d2) continue;
    const r = Math.min(CORNER, i > 1 ? d1 / 2 : d1, i < last - 1 ? d2 / 2 : d2);
    const cross = (cx - px) * (ny - cy) - (cy - py) * (nx - cx);
    const ax = cx + ((px - cx) / d1) * r;
    const ay = cy + ((py - cy) / d1) * r;
    const bx = cx + ((nx - cx) / d2) * r;
    const by = cy + ((ny - cy) / d2) * r;
    d += ` L${ax},${ay} A${r},${r} 0 0 ${cross > 0 ? 1 : 0} ${bx},${by}`;
  }
  d += ` L${pts[last][0]},${pts[last][1]}`;
  return d;
}

function FlowCanvas({
  designWidth,
  height,
  build,
}: {
  designWidth: number;
  height: number;
  build: (g: Geo) => Layout;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(designWidth);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(designWidth, Math.floor(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);

  const k = width / designWidth; // 가로 늘림 배율 (최소 1)
  const kw = 1 + (k - 1) * WIDTH_SHARE;
  const geo: Geo = {
    X: (x) => Math.round(x * k),
    Wd: (w) => Math.round((w * kw) / 2) * 2, // 짝수로 맞춰 가운데 정렬 시 반 픽셀 방지
  };
  const { nodes, edges } = build(geo);

  return (
    <div ref={ref} className="flow__canvas" style={{ height }}>
      {nodes.map((n, i) => (
        <div key={i} className="flow__abs" style={{ left: n.x, top: n.y, width: n.w, height: n.h }}>
          {n.node}
        </div>
      ))}

      <svg
        className="flow__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
        focusable="false"
      >
        {edges.flatMap((e, i) =>
          e.paths.map((pts, j) => (
            <path
              key={`${i}-${j}`}
              d={roundedPath(pts)}
              className={`flow__ln${e.dash ? " flow__ln--dash" : ""}${e.tone ? ` flow__ln--${e.tone}` : ""}`}
            />
          )),
        )}
        {edges.flatMap((e, i) =>
          (e.rings ?? []).map(([x, y], j) => (
            <circle
              key={`r${i}-${j}`}
              cx={x}
              cy={y}
              r={3.25}
              className={`flow__ring${e.tone ? ` flow__ring--${e.tone}` : ""}`}
            />
          )),
        )}
      </svg>
    </div>
  );
}

/* ══════════════════════════════
   식품 가공공정 (이미지 기준)
   1행  헴프 씨 → 겉피 탈피 → 세척 → 건조 → 전처리 완료된 씨드
        (세척·건조에서 위로 올라가 슬러지/껍질 신고반납으로 연결)
   분기 씨드 아래 가로선 → 착유 / 분쇄 / 선별
   좌측 착유 → 열수 추출 → 농축 → (←) 필터링 → 탱크저장, 착유 ↓ 필터링
        탱크저장·초임계 추출 → 충진 / 포장 → 헴프오일 · 헴프박 농축액 · 초임계 추출물
   우측 분쇄 → 분말저장 → (←) 초임계 추출
        분말저장·선별 → 계량 / 포장 → 단백질 파우더 · 헴프씨드
══════════════════════════════ */
function FoodFlow({ statusMap, filter }: FlowProps) {
  const build = ({ X, Wd }: Geo): Layout => {
    const L = (cx: number, w = BOX_W) => X(cx) - Wd(w) / 2;
    const R = (cx: number, w = BOX_W) => X(cx) + Wd(w) / 2;
    const pad = Wd(BOX_W) / 2;

    const B = (id: string, label: string, cx: number, y: number, w = BOX_W, sub?: string): Place => ({
      x: L(cx, w),
      y,
      w: Wd(w),
      h: BOX_H,
      node: <Box label={label} sub={sub} equipmentId={id} status={statusMap[id]} filter={filter} />,
    });
    const P = (label: string, cx: number, y: number, w: number): Place => ({
      x: L(cx, w),
      y,
      w: Wd(w),
      h: PILL_H,
      node: <Pill label={label} />,
    });
    /* 여러 선이 들어오는 합류 박스: 첫/마지막 입력 가운데 x 사이를 덮는다 */
    const span = (id: string, label: string, cxA: number, cxB: number, y: number): Place => ({
      x: X(cxA) - pad,
      y,
      w: X(cxB) - X(cxA) + pad * 2,
      h: BOX_H,
      node: <Box label={label} equipmentId={id} status={statusMap[id]} filter={filter} />,
    });

    const seedL = L(676, 160);
    const mid1 = (X(62) + X(366)) / 2; // 충진 / 포장 가운데
    const mid2 = (X(518) + X(676)) / 2; // 계량 / 포장 가운데

    const nodes: Place[] = [
      /* 1행 */
      P("헴프 씨", 44, 78, 88),
      B("food-peel", "겉피 탈피", 178, 56),
      B("food-wash", "세척", 342, 56, 148, "(탈피 / 세척)"),
      B("food-dry", "건조", 506, 56),
      P("전처리 완료된 씨드", 676, 78, 160),
      { x: seedL, y: 0, w: Wd(176), h: PILL_H, node: <Amber label="슬러지 / 껍질 신고반납" /> },

      /* 2행 */
      B("food-press", "착유", 62, 188),
      B("food-extract-heat", "열수 추출", 214, 188),
      B("food-grind", "분쇄", 442, 188),
      B("food-select", "선별", 676, 188),

      /* 3행 */
      B("food-filter", "필터링", 62, 308),
      B("food-concentrate", "농축", 214, 308),

      /* 4행 */
      B("food-tank", "탱크저장", 62, 428),
      B("food-extract-sc", "초임계 추출", 366, 428),
      B("food-powder-tank", "분말저장", 518, 428),

      /* 5행: 합류 박스 */
      span("food-fill", "충진 / 포장", 62, 366, 548),
      span("food-pack-powder", "계량 / 포장", 518, 676, 548),

      /* 6행: 최종 제품 */
      P("헴프오일", 62, 668, 100),
      P("헴프박 농축액", 214, 668, 136),
      P("초임계 추출물", 366, 668, 128),
      P("단백질 파우더", 518, 668, 130),
      P("헴프씨드", 676, 668, 100),
    ];

    const edges: Edge[] = [
      /* 1행 가로 연결 */
      hLine(R(44, 88), L(178), 98),
      hLine(R(178), L(342, 148), 98),
      hLine(R(342, 148), L(506), 98),
      hLine(R(506), seedL, 98),

      /* 세척·건조 → 슬러지/껍질 (노란선) */
      {
        paths: [
          [
            [X(342), 56],
            [X(342), 20],
            [seedL, 20],
          ],
          [
            [X(506), 56],
            [X(506), 20],
          ],
        ],
        rings: [[seedL, 20]],
        tone: "warn",
      },

      /* 씨드 → 착유 / 분쇄 / 선별 */
      {
        paths: [
          [
            [X(676), 118],
            [X(676), 188],
          ],
          [
            [X(676), 164],
            [X(62), 164],
            [X(62), 188],
          ],
          [
            [X(442), 164],
            [X(442), 188],
          ],
        ],
        rings: [
          [X(676), 188],
          [X(62), 188],
          [X(442), 188],
        ],
      },

      /* 착유 라인 */
      hLine(R(62), L(214), 230), // 착유 → 열수 추출
      vLine(X(62), 272, 308), // 착유 ↓ 필터링
      vLine(X(214), 272, 308), // 열수 추출 ↓ 농축
      hLine(L(214), R(62), 350), // 농축 → 필터링 (←)
      vLine(X(62), 392, 428), // 필터링 ↓ 탱크저장

      /* 분쇄 라인 */
      {
        paths: [
          [
            [X(442), 272],
            [X(442), 410],
            [X(518), 410],
            [X(518), 428],
          ],
        ],
        rings: [[X(518), 428]],
      }, // 분쇄 ↓ 분말저장
      hLine(L(518), R(366), 470), // 분말저장 → 초임계 추출 (←)

      /* 충진 / 포장으로 합류 */
      vLine(X(62), 512, 548), // 탱크저장
      vLine(X(366), 512, 548), // 초임계 추출

      /* 계량 / 포장으로 합류 */
      vLine(X(518), 512, 548), // 분말저장
      vLine(X(676), 272, 548), // 선별

      /* 충진 / 포장 → 제품 3종 */
      {
        paths: [
          [
            [mid1, 632],
            [mid1, 668],
          ],
          [
            [mid1, 650],
            [X(62), 650],
            [X(62), 668],
          ],
          [
            [mid1, 650],
            [X(366), 650],
            [X(366), 668],
          ],
        ],
        rings: [
          [X(62), 668],
          [mid1, 668],
          [X(366), 668],
        ],
      },

      /* 계량 / 포장 → 제품 2종 */
      {
        paths: [
          [
            [mid2, 632],
            [mid2, 650],
          ],
          [
            [mid2, 650],
            [X(518), 650],
            [X(518), 668],
          ],
          [
            [mid2, 650],
            [X(676), 650],
            [X(676), 668],
          ],
        ],
        rings: [
          [X(518), 668],
          [X(676), 668],
        ],
      },
    ];

    return { nodes, edges };
  };

  return (
    <div className="flow">
      <Legend
        items={[
          { bg: "var(--eq-run)", label: "투입 원물 / 최종 제품" },
          { bg: "var(--eq-surface)", border: "var(--eq-line-strong)", label: "공정 단계 (클릭 시 상세정보)" },
          { bg: "var(--eq-warn-soft)", border: "var(--eq-warn)", dash: true, label: "부산물 처리" },
        ]}
      />
      <FlowCanvas designWidth={780} height={708} build={build} />
    </div>
  );
}

/* ══════════════════════════════
   단섬유 가공공정 (이미지 기준)
   줄기(인피) → 스커칭 / 압축 (좌측 분기)
   인피 ⇢ 정련/표백 — 건조 — 탈수   (초록 점선: 인피에서 올라가는 경로)
   압축 ⇢ 개섬 — 개면 — 카딩 — 압축포장 — 헴프솜  (초록 점선: 인피에서 내려오는 경로)
   탈수 ┈┈ 개섬 (회색 점선, 꺾여서 내려옴)
══════════════════════════════ */
function FiberFlow({ statusMap, filter }: FlowProps) {
  const build = ({ X, Wd }: Geo): Layout => {
    const L = (cx: number, w = BOX_W) => X(cx) - Wd(w) / 2;
    const R = (cx: number, w = BOX_W) => X(cx) + Wd(w) / 2;

    const B = (id: string, label: string, cx: number, y: number): Place => ({
      x: L(cx),
      y,
      w: Wd(BOX_W),
      h: BOX_H,
      node: <Box label={label} equipmentId={id} status={statusMap[id]} filter={filter} />,
    });

    const busX = (R(62) + L(232)) / 2; // 줄기 → 스커칭/압축 분기선 x

    const nodes: Place[] = [
      { x: L(62), y: 104, w: Wd(BOX_W), h: PILL_H, node: <Pill label="줄기 (인피)" /> },

      /* 1행 */
      B("fiber-scutch", "스커칭", 232, 0),
      B("fiber-refine", "정련 / 표백", 432, 0),
      B("fiber-dry", "건조", 584, 0),
      B("fiber-dehydrate", "탈수", 736, 0),

      /* 인피 (두 행 사이) */
      { x: L(332, 64), y: 107, w: Wd(64), h: 34, node: <Tag label="인피" /> },

      /* 2행 */
      B("fiber-compress", "압축", 232, 164),
      B("fiber-open-fiber", "개섬", 432, 164),
      B("fiber-open-cotton", "개면", 584, 164),
      B("fiber-card", "카딩", 736, 164),
      B("fiber-pack", "압축포장", 888, 164),
      { x: L(1028, 100), y: 186, w: Wd(100), h: PILL_H, node: <Pill label="헴프솜" /> },
    ];

    const edges: Edge[] = [
      /* 줄기 → 스커칭 / 압축 */
      {
        paths: [
          [
            [R(62), 124],
            [busX, 124],
          ],
          [
            [busX, 124],
            [busX, 42],
            [L(232), 42],
          ],
          [
            [busX, 124],
            [busX, 206],
            [L(232), 206],
          ],
        ],
        rings: [
          [L(232), 42],
          [L(232), 206],
        ],
      },

      /* 인피 → 정련/표백, 압축 → 개섬 (초록 점선) */
      {
        paths: [
          [
            [X(332), 107],
            [X(332), 42],
            [L(432), 42],
          ],
        ],
        rings: [[L(432), 42]],
        tone: "run",
        dash: true,
      }, // 인피 ⇢ 정련/표백
      hLine(R(232), L(432), 206, { tone: "run", dash: true }), // 압축 ⇢ 개섬
      { paths: [[[X(332), 141], [X(332), 206]]], tone: "run", dash: true },

      /* 1행 실선 */
      hLine(R(432), L(584), 42),
      hLine(R(584), L(736), 42),

      /* 탈수 ┈ 개섬 (회색 점선, 꺾임) */
      {
        paths: [
          [
            [X(736), 84],
            [X(736), 124],
            [X(432), 124],
            [X(432), 164],
          ],
        ],
        rings: [[X(432), 164]],
        dash: true,
      },

      /* 2행 실선 */
      hLine(R(432), L(584), 206),
      hLine(R(584), L(736), 206),
      hLine(R(736), L(888), 206),
      hLine(R(888), L(1028, 100), 206),
    ];

    return { nodes, edges };
  };

  return (
    <div className="flow">
      <Legend
        items={[
          { bg: "var(--eq-run)", label: "투입 원물 / 최종 제품" },
          { bg: "var(--eq-surface)", border: "var(--eq-line-strong)", label: "공정 단계 (클릭 시 상세정보)" },
          { bg: "transparent", border: "var(--eq-line-strong)", dash: true, label: "연결 공정 경로" },
        ]}
      />
      <FlowCanvas designWidth={1078} height={248} build={build} />
    </div>
  );
}