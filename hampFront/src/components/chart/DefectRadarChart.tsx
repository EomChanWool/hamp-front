import { useMemo, useState } from "react";
import {
  ExclamationTriangleIcon,
  ChartBarIcon,
  FireIcon,
} from "@heroicons/react/24/outline";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import styles from "./Defectradarchart.module.css";

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface DefectEntry {
  date: string;
  defectType: string;
  count: number;
  total: number;
}

interface ChartPoint {
  subject:  string;
  value:    number;
  rawCount: number;
  rawRate:  number;
  color:    string;
  fullMark: number;
}

// ─── 타입별 고유 색상 ─────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, { dark: string; light: string }> = {
  이물:    { dark: "#6ee7b7", light: "#059669" },
  중량미달: { dark: "#34d399", light: "#10b981" },
  파손:    { dark: "#4ade80", light: "#16a34a" },
  색상불량: { dark: "#86efac", light: "#22c55e" },
  포장불량: { dark: "#a7f3d0", light: "#65a30d" },
  기타:    { dark: "#5eead4", light: "#0d9488" },
};

// ─── 별 고유 색상 ─────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, { dark: string; light: string }> = {
  총불량:    { dark: "#fbbf24", light: "#d97706" },
  평균불량률: { dark: "#60a5fa", light: "#2563eb" },
  최다불량:  { dark: "#f87171", light: "#dc2626" },
};

// ─── CSS 변수 주입용 테마 맵 ──────────────────────────────────────────────────
const DARK_VARS: Record<string, string> = {
  "--rc-surface":          "#1e1e2e",
  "--rc-border":           "rgba(255,255,255,0.08)",
  "--rc-text":             "#e2e8f0",
  "--rc-text-muted":       "rgba(255,255,255,0.45)",
  "--rc-text-faint":       "rgba(255,255,255,0.40)",
  "--rc-grid-line":        "rgba(255,255,255,0.07)",
  "--rc-select-bg":        "rgba(255,255,255,0.06)",
  "--rc-select-option-bg": "#1e1e2e",
  "--rc-badge-bg":         "rgba(255,255,255,0.04)",
  "--rc-poly-stroke":      "#57d3a1",
  "--rc-bar-track":        "rgba(255,255,255,0.06)",
  "--rc-tooltip-bg":       "#2a2a3e",
  "--rc-tooltip-border":   "rgba(255,255,255,0.10)",
};

const LIGHT_VARS: Record<string, string> = {
  "--rc-surface":          "#ffffff",
  "--rc-border":           "rgba(0,0,0,0.09)",
  "--rc-text":             "#1e293b",
  "--rc-text-muted":       "rgba(0,0,0,0.45)",
  "--rc-text-faint":       "rgba(0,0,0,0.38)",
  "--rc-grid-line":        "rgba(0,0,0,0.08)",
  "--rc-select-bg":        "rgba(0,0,0,0.04)",
  "--rc-select-option-bg": "#ffffff",
  "--rc-badge-bg":         "rgba(0,0,0,0.03)",
  "--rc-poly-stroke":      "#10b981",
  "--rc-bar-track":        "rgba(0,0,0,0.06)",
  "--rc-tooltip-bg":       "#ffffff",
  "--rc-tooltip-border":   "rgba(0,0,0,0.10)",
};

// ─── 목업 데이터 ─────────────────────────────────────────────────────────────
const DEFECT_TYPES = ["이물", "중량미달", "파손", "색상불량", "포장불량", "기타"];

const MOCK_DATA: DefectEntry[] = (() => {
  const seed = (n: number) => (((n * 1103515245 + 12345) & 0x7fffffff) % 40) + 3;
  let s = 7;
  return [
    "2025-01-15", "2025-01-22", "2025-01-29",
    "2025-02-05", "2025-02-12", "2025-02-19",
    "2025-03-03", "2025-03-10", "2025-03-17",
  ].flatMap((date) =>
    DEFECT_TYPES.map((defectType) => {
      s = seed(s);
      return { date, defectType, count: s, total: 500 };
    }),
  );
})();

// ─── 커스텀 Dot — 타입별 색상 ────────────────────────────────────────────────
function ColoredDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: ChartPoint;
}) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8}  fill={payload.color} fillOpacity={0.2} />
      <circle cx={cx} cy={cy} r={4.5} fill={payload.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1.5} />
    </g>
  );
}

// ─── 커스텀 Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background:   "var(--rc-tooltip-bg)",
        border:       "1px solid var(--rc-tooltip-border)",
        borderRadius: 8,
        padding:      "8px 12px",
        fontSize:     12,
        color:        "var(--rc-text)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 3, color: d.color }}>{d.subject}</div>
      <div style={{ color: "var(--rc-text-muted)" }}>
        {d.rawCount}건&nbsp;
        <span style={{ color: d.color }}>({d.rawRate.toFixed(1)}%)</span>
      </div>
    </div>
  );
}

// ─── 커스텀 AngleAxis 레이블 ──────────────────────────────────────────────────
function CustomAngleLabel(props: {
  x?: string | number;
  y?: string | number;
  cx?: string | number;
  cy?: string | number;
  payload?: { value: string };
  data?: ChartPoint[];
}) {
  const { x: _x, y: _y, cx: _cx, cy: _cy, payload, data } = props;
  const x  = Number(_x  ?? 0);
  const y  = Number(_y  ?? 0);
  const cx = Number(_cx ?? 0);
  const cy = Number(_cy ?? 0);
  if (!payload || !data) return null;
  const point = data.find((d) => d.subject === payload.value);
  if (!point) return null;

  // 중심 대비 방향 계산 — 레이블을 바깥쪽으로 오프셋
  const dx = x - cx;
  const dy = y - cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ox = (dx / len) * 12;
  const oy = (dy / len) * 12;
  const lx = x + ox;
  const ly = y + oy;
  const anchor = Math.abs(dx) < 10 ? "middle" : dx > 0 ? "start" : "end";

  return (
    <g>
      <text
        x={lx} y={ly - 5}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={11.5}
        fontWeight={500}
        fill="var(--rc-text)"
      >
        {payload.value}
      </text>
      <text
        x={lx} y={ly + 9}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={10}
        fill={point.color}
      >
        {point.rawCount}건 ({point.rawRate.toFixed(1)}%)
      </text>
    </g>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
interface DefectRadarChartProps {
  colorMode?: "dark" | "light";
}

export function DefectRadarChart({ colorMode = "dark" }: DefectRadarChartProps) {
  const cssVars = colorMode === "light" ? LIGHT_VARS : DARK_VARS;
  const mode    = colorMode === "light" ? "light" : "dark";

  const dates = useMemo(() => [...new Set(MOCK_DATA.map((d) => d.date))].sort(), []);
  const [selectedDate, setSelectedDate] = useState(dates[dates.length - 1]);

  const chartData: ChartPoint[] = useMemo(() => {
    const entries  = MOCK_DATA.filter((d) => d.date === selectedDate);
    const maxCount = Math.max(...entries.map((e) => e.count), 1);
    return DEFECT_TYPES.map((type) => {
      const entry = entries.find((e) => e.defectType === type);
      const count = entry?.count ?? 0;
      return {
        subject:  type,
        value:    count / maxCount,
        rawCount: count,
        rawRate:  (count / 500) * 100,
        color:    TYPE_COLORS[type]?.[mode] ?? "#94a3b8",
        fullMark: 1,
      };
    });
  }, [selectedDate, mode]);

  const totalDefects = chartData.reduce((s, a) => s + a.rawCount, 0);
  const avgRate      = (chartData.reduce((s, a) => s + a.rawRate, 0) / chartData.length).toFixed(2);
  const worstAxis    = chartData.reduce((a, b) => (a.rawCount > b.rawCount ? a : b));

  const badges = [
    { label: "총 불량",    value: `${totalDefects}건`, color: BADGE_COLORS["총불량"][mode],    Icon: ExclamationTriangleIcon },
    { label: "평균 불량률", value: `${avgRate}%`,       color: BADGE_COLORS["평균불량률"][mode], Icon: ChartBarIcon            },
    { label: "최다 불량",  value: worstAxis.subject,    color: BADGE_COLORS["최다불량"][mode],   Icon: FireIcon                },
  ];

  const polyStroke = cssVars["--rc-poly-stroke"];
  const gridLine   = cssVars["--rc-grid-line"];

  return (
    <div className={styles.card} style={cssVars as React.CSSProperties}>

      {/* 헤더 */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerLabel}>불량 유형별 분석</div>
          <div className={styles.headerTitle}>레이더 차트</div>
        </div>
        <select
          className={styles.select}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        >
          {dates.map((d) => (
            <option key={d} value={d} className={styles.selectOption}>{d}</option>
          ))}
        </select>
      </div>

      {/* 배지 */}
      <div className={styles.badges}>
        {badges.map((b) => (
          <div key={b.label} className={styles.badge} style={{ borderColor: `${b.color}35` }}>
            <div className={styles.badgeHeader}>
              <b.Icon className={styles.badgeIcon} style={{ color: b.color }} />
              <span className={styles.badgeLabel}>{b.label}</span>
            </div>
            <span className={styles.badgeValue} style={{ color: b.color }}>{b.value}</span>
          </div>
        ))}
      </div>

      {/* 차트 + 범례 */}
      <div className={styles.chartBox}>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={chartData} outerRadius="72%" margin={{ top: 30, right: 60, bottom: 30, left: 60 }}>
              <PolarGrid stroke={gridLine} strokeWidth={1} gridType="polygon" polarRadius={[24, 48, 72, 96, 120]} />
              <PolarAngleAxis
                dataKey="subject"
                tick={(props) => <CustomAngleLabel {...props} data={chartData} />}
                tickLine={false}
                axisLine={false}
              />
              <PolarRadiusAxis
                domain={[0, 1]}
                tickCount={5}
                tick={false}
                axisLine={false}
                tickLine={false}
              />
              <Radar
                dataKey="value"
                stroke={polyStroke}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                fill={polyStroke}
                fillOpacity={0.08}
                dot={(props) => <ColoredDot {...props} />}
                activeDot={false}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* 범례 */}
        <div className={styles.legend}>
          {chartData.map((ax) => (
            <div key={ax.subject} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: ax.color, boxShadow: `0 0 6px ${ax.color}70` }}
              />
              <span className={styles.legendName}>{ax.subject}</span>
              <span className={styles.legendBar}>
                <span
                  className={styles.legendBarFill}
                  style={{
                    width:      `${ax.value * 100}%`,
                    background: `linear-gradient(90deg, ${ax.color}, ${ax.color}50)`,
                  }}
                />
              </span>
              <span className={styles.legendCount} style={{ color: ax.color }}>
                {ax.rawCount}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
