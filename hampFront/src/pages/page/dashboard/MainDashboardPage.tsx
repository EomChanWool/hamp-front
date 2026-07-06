import type { CSSProperties } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import styles from "./MainDashboardPage.module.css";

// ── 타입 ──────────────────────────────────────────────────────────────────────
type LineStatus = "on" | "off" | "warn";

interface ProductionLine {
  id: string;
  name: string;
  status: LineStatus;
  output: number; // kg
  target: number; // kg
  process: string;
}

interface DefectStat {
  type: string;
  count: number;
  rate: number;
  color: string;
}

interface ProcessUnit {
  label: string;
  status: LineStatus;
}

interface TrendPoint {
  day: string;
  output: number;
}

// ── 목업 데이터 ───────────────────────────────────────────────────────────────
const FOOD_LINES: ProductionLine[] = [
  { id: "F-L1", name: "1라인", status: "on", output: 1240, target: 1500, process: "세척→건조→분쇄→포장" },
  { id: "F-L2", name: "2라인", status: "warn", output: 820, target: 1200, process: "세척→건조→선별→포장" },
  { id: "F-L3", name: "3라인", status: "on", output: 960, target: 1000, process: "추출→농축→캡슐화" },
  { id: "F-L4", name: "4라인", status: "off", output: 0, target: 800, process: "오일→정제→병입" },
  { id: "F-L4", name: "5라인", status: "off", output: 0, target: 800, process: "오일→정제→병입" },
  { id: "F-L4", name: "6라인", status: "off", output: 0, target: 800, process: "오일→정제→병입" },
];

const FIBER_LINES: ProductionLine[] = [
  { id: "I-L1", name: "1라인", status: "on", output: 980, target: 1200, process: "개섬→정렬→압축→포장" },
  { id: "I-L2", name: "2라인", status: "on", output: 1100, target: 1100, process: "투입→개섬→정렬→포장" },
  { id: "I-L3", name: "3라인", status: "off", output: 0, target: 900, process: "압축→성형→검사" },
  { id: "I-L4", name: "4라인", status: "warn", output: 430, target: 800, process: "정렬→결속→출하" },
  { id: "I-L4", name: "5라인", status: "warn", output: 430, target: 800, process: "정렬→결속→출하" },
  { id: "I-L4", name: "6라인", status: "warn", output: 430, target: 800, process: "정렬→결속→출하" },
];

const FOOD_DEFECTS: DefectStat[] = [
  { type: "이물", count: 12, rate: 2.4, color: "#059669" },
  { type: "중량미달", count: 28, rate: 5.6, color: "#10b981" },
  { type: "파손", count: 9, rate: 1.8, color: "#34d399" },
  { type: "색상불량", count: 15, rate: 3.0, color: "#22c55e" },
  { type: "포장불량", count: 18, rate: 3.6, color: "#4ade80" },
  { type: "기타", count: 5, rate: 1.0, color: "#86efac" },
];

const FIBER_DEFECTS: DefectStat[] = [
  { type: "이물혼입", count: 8, rate: 1.6, color: "#6366f1" },
  { type: "중량미달", count: 22, rate: 4.4, color: "#4f46e5" },
  { type: "파손", count: 14, rate: 2.8, color: "#818cf8" },
  { type: "성형불량", count: 19, rate: 3.8, color: "#3b82f6" },
  { type: "포장불량", count: 11, rate: 2.2, color: "#0ea5e9" },
  { type: "기타", count: 3, rate: 0.6, color: "#a5b4fc" },
];

const FOOD_PROCESSES: ProcessUnit[] = [
  { label: "원료투입", status: "on" },
  { label: "세척", status: "on" },
  { label: "건조", status: "warn" },
  { label: "분쇄", status: "on" },
  { label: "선별", status: "on" },
  { label: "포장", status: "off" },
];

const FIBER_PROCESSES: ProcessUnit[] = [
  { label: "원료투입", status: "on" },
  { label: "개섬", status: "on" },
  { label: "정렬", status: "on" },
  { label: "압축", status: "on" },
  { label: "성형", status: "warn" },
  { label: "포장", status: "on" },
];

const FOOD_TREND: TrendPoint[] = [
  { day: "6/24", output: 4820 },
  { day: "6/25", output: 5210 },
  { day: "6/26", output: 4990 },
  { day: "6/27", output: 5430 },
  { day: "6/28", output: 5100 },
  { day: "6/29", output: 5680 },
  { day: "6/30", output: 5020 },
];

const FIBER_TREND: TrendPoint[] = [
  { day: "6/24", output: 3210 },
  { day: "6/25", output: 3380 },
  { day: "6/26", output: 3050 },
  { day: "6/27", output: 3640 },
  { day: "6/28", output: 3490 },
  { day: "6/29", output: 3720 },
  { day: "6/30", output: 2510 },
];

// ── 공통 헬퍼 ─────────────────────────────────────────────────────────────────
const statusLabel: Record<LineStatus, string> = { on: "가동중", off: "정지", warn: "주의" };
const badgeClass: Record<LineStatus, string> = { on: styles.badgeOn, off: styles.badgeOff, warn: styles.badgeWarn };
const dotClass: Record<LineStatus, string> = { on: styles.dotOn, off: styles.dotOff, warn: styles.dotWarn };
const nodeClass: Record<LineStatus, string> = { on: styles.nodeOn, off: styles.nodeOff, warn: styles.nodeWarn };

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

// ── KPI 요약 카드 ─────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  unit,
  delta,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: { value: string; positive: boolean };
  accent: string;
}) {
  return (
    <div className={styles.kpiCard} style={{ "--accent": accent } as CSSProperties}>
      <div className={styles.kpiCardTop}>
        <span className={styles.kpiCardDot} />
        <span className={styles.kpiCardLabel}>{label}</span>
      </div>
      <div className={styles.kpiCardValueBox}>
        <div className={styles.kpiCardValueRow}>
          <strong className={styles.kpiCardValue}>{value}</strong>
          {unit && <span className={styles.kpiCardUnit}>{unit}</span>}
        </div>
        {delta && (
          <span className={`${styles.kpiCardDelta} ${delta.positive ? styles.deltaUp : styles.deltaDown}`}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              {delta.positive ? (
                <path d="M5 1L9 7H1L5 1Z" fill="currentColor" />
              ) : (
                <path d="M5 9L1 3H9L5 9Z" fill="currentColor" />
              )}
            </svg>
            {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}

// ── 공정 흐름도 ───────────────────────────────────────────────────────────────
function ProcessFlow({ processes }: { processes: ProcessUnit[] }) {
  return (
    <div className={styles.processFlow}>
      {processes.map((p, i) => (
        <div key={p.label} className={styles.processStep}>
          <div className={`${styles.processNode} ${nodeClass[p.status]}`}>
            <span className={`${styles.processDot} ${dotClass[p.status]}`} />
            <span className={styles.processLabel}>{p.label}</span>
          </div>
          {i < processes.length - 1 && (
            <div className={`${styles.processArrow} ${p.status === "off" ? styles.arrowOff : ""}`}>
              <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
                <line
                  x1="0"
                  y1="6"
                  x2="18"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray={p.status === "off" ? "4 3" : "none"}
                />
                <polyline
                  points="14,2 20,6 14,10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 생산라인 카드 ─────────────────────────────────────────────────────────────
function LineCard({ line }: { line: ProductionLine }) {
  const pct = line.target > 0 ? Math.round((line.output / line.target) * 100) : 0;
  return (
    <div className={styles.lineCard}>
      <div className={styles.lineTop}>
        <div className={styles.lineInfo}>
          <span className={`${styles.lineDot} ${dotClass[line.status]}`} />
          <span className={styles.lineName}>{line.name}</span>
          <span className={styles.lineProcess}>{line.process}</span>
        </div>
        <span className={`${styles.lineStatus} ${badgeClass[line.status]}`}>{statusLabel[line.status]}</span>
      </div>
      <div className={styles.lineOutputRow}>
        <span className={styles.lineOutputVal}>
          {line.output.toLocaleString()} <em>kg</em>
        </span>
        <span className={styles.lineTarget}>/ {line.target.toLocaleString()} kg</span>
        <span className={styles.linePct}>{pct}%</span>
      </div>
      <div className={styles.lineBar}>
        <div
          className={`${styles.lineBarFill} ${line.status === "warn" ? styles.barWarn : line.status === "off" ? styles.barOff : styles.barOn}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── 생산량 추이 영역차트 ───────────────────────────────────────────────────────
function TrendChart({ data, accent }: { data: TrendPoint[]; accent: string }) {
  const gradientId = `trendGradient-${accent.replace("#", "")}`;
  return (
    <div className={styles.trendChartWrap}>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text-muted)" }}
            formatter={(v) => [`${Number(v).toLocaleString()} kg`, "생산량"]}
          />
          <Area
            type="monotone"
            dataKey="output"
            stroke={accent}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: accent, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 불량 구성비 레이더차트 ─────────────────────────────────────────────────────
function DefectRadar({ defects, accent }: { defects: DefectStat[]; accent: string }) {
  const total = sum(defects.map((d) => d.count));

  return (
    <div className={styles.donutRow}>
      <div className={styles.radarChartWrap}>
        <ResponsiveContainer width={220} height={200}>
          <RadarChart data={defects} outerRadius="80%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="type" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
            <Radar
              dataKey="count"
              stroke={accent}
              fill={accent}
              fillOpacity={0.18}
              strokeWidth={2}
              dot={(dotProps: any) => {
                const { cx, cy, index, key } = dotProps;
                const color = defects[index]?.color ?? accent;
                return (
                  <circle key={key} cx={cx} cy={cy} r={5} fill={color} stroke="var(--bg-card)" strokeWidth={1.5} />
                );
              }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--text-muted)" }}
              formatter={(v) => [`${Number(v)}건`, "불량건수"]}
            />
          </RadarChart>
        </ResponsiveContainer>
        <span className={styles.radarTotal}>
          총 <strong>{total}</strong>건
        </span>
      </div>
      <div className={styles.defectList}>
        {defects.map((d) => (
          <div key={d.type} className={styles.defectRow}>
            <span className={styles.defectDot} style={{ background: d.color }} />
            <span className={styles.defectType}>{d.type}</span>
            <div className={styles.defectBar}>
              <div
                className={styles.defectBarFill}
                style={{
                  width: `${(d.count / Math.max(...defects.map((x) => x.count), 1)) * 100}%`,
                  background: `linear-gradient(90deg, ${d.color}cc, ${d.color}55)`,
                }}
              />
            </div>
            <span className={styles.defectCount} style={{ color: d.color }}>
              {d.count}건
            </span>
            <span className={styles.defectRate}>{d.rate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 공정 섹션 ─────────────────────────────────────────────────────────────────
function ProcessSection({
  title,
  accent,
  lines,
  processes,
  defects,
  trend,
}: {
  title: string;
  accent: string;
  lines: ProductionLine[];
  processes: ProcessUnit[];
  defects: DefectStat[];
  trend: TrendPoint[];
}) {
  const onCount = lines.filter((l) => l.status === "on").length;
  const warnCount = lines.filter((l) => l.status === "warn").length;
  const totalOut = sum(lines.map((l) => l.output));
  const totalTgt = sum(lines.map((l) => l.target));
  const eff = totalTgt > 0 ? Math.round((totalOut / totalTgt) * 100) : 0;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleRow}>
          <span className={styles.sectionAccent} style={{ background: accent }} />
          <h2 className={styles.sectionTitle}>{title}</h2>
        </div>
        <div className={styles.sectionKpis}>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>가동</span>
            <strong className={styles.kpiVal} style={{ color: "#10b981" }}>
              {onCount}라인
            </strong>
          </div>
          <div className={styles.kpiDiv} />
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>주의</span>
            <strong className={styles.kpiVal} style={{ color: "#f59e0b" }}>
              {warnCount}라인
            </strong>
          </div>
          <div className={styles.kpiDiv} />
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>효율</span>
            <strong className={styles.kpiVal} style={{ color: accent }}>
              {eff}%
            </strong>
          </div>
        </div>
      </div>

      {/* 생산량 추이 */}
      <div className={styles.panelCard}>
        <div className={styles.panelTitle}>
          <span className={styles.panelName}>생산량 추이</span>
          <span className={styles.panelValue}>최근 7일</span>
        </div>
        <TrendChart data={trend} accent={accent} />
      </div>

      {/* 공정 흐름도 */}
      {/* <div className={styles.panelCard}>
        <div className={styles.panelTitle}>
          <span className={styles.panelName}>공정 흐름</span>
        </div>
        <ProcessFlow processes={processes} />
      </div> */}

      {/* 생산라인 */}
      <div className={styles.panelCard}>
        <div className={styles.panelTitle}>
          <span className={styles.panelName}>생산라인</span>
          <span className={styles.panelValue}>총 생산량 {totalOut.toLocaleString()}kg</span>
        </div>
        <div className={styles.lineGrid}>
          {lines.map((line) => (
            <LineCard key={line.id} line={line} />
          ))}
        </div>
      </div>

      {/* 불량현황 */}
      {/* <div className={styles.panelCard}>
        <div className={styles.panelTitle}>
          <span className={styles.panelName}>불량현황</span>
        </div>
        <DefectRadar defects={defects} accent={accent} />
      </div> */}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export function MainDashboardPage() {
  const allLines = [...FOOD_LINES, ...FIBER_LINES];
  const totalOutput = sum(allLines.map((l) => l.output));
  const totalTarget = sum(allLines.map((l) => l.target));
  const totalEff = totalTarget > 0 ? Math.round((totalOutput / totalTarget) * 100) : 0;
  const onLines = allLines.filter((l) => l.status === "on").length;
  const totalDefects = sum([...FOOD_DEFECTS, ...FIBER_DEFECTS].map((d) => d.count));
  const avgDefectRate = (
    sum([...FOOD_DEFECTS, ...FIBER_DEFECTS].map((d) => d.rate)) /
    (FOOD_DEFECTS.length + FIBER_DEFECTS.length)
  ).toFixed(1);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>생산 대시보드</h1>
        <span className={styles.pageTime}>실시간 · {new Date().toLocaleString("ko-KR", { hour12: false })}</span>
      </div>

      {/* 상단 KPI 요약 카드 */}
      <div className={styles.kpiCardGrid}>
        <KpiCard
          label="총 생산량"
          value={totalOutput.toLocaleString()}
          unit="kg"
          delta={{ value: "4.2%", positive: true }}
          accent="#34d399"
        />
        <KpiCard
          label="목표 대비 효율"
          value={`${totalEff}`}
          unit="%"
          delta={{ value: "1.8%", positive: true }}
          accent="#818cf8"
        />
        <KpiCard label="가동 라인" value={`${onLines}`} unit={`/ ${allLines.length}라인`} accent="#38bdf8" />
        <KpiCard
          label="총 불량건"
          value={`${totalDefects}`}
          unit="건"
          delta={{ value: "0.6%", positive: false }}
          accent="#f87171"
        />
        <KpiCard label="평균 불량률" value={avgDefectRate} unit="%" accent="#fbbf24" />
      </div>

      <div className={styles.grid}>
        <ProcessSection
          title="식품가공공정"
          accent="#10b981"
          lines={FOOD_LINES}
          processes={FOOD_PROCESSES}
          defects={FOOD_DEFECTS}
          trend={FOOD_TREND}
        />
        <ProcessSection
          title="단섬유가공공정"
          accent="#818cf8"
          lines={FIBER_LINES}
          processes={FIBER_PROCESSES}
          defects={FIBER_DEFECTS}
          trend={FIBER_TREND}
        />
      </div>
    </div>
  );
}
