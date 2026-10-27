import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ExclamationTriangleIcon,
  ReceiptPercentIcon,
  FlagIcon,
  ChevronDownIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from "recharts";
import styles from "./Defectradarchart.module.css";

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface DefectEntry {
  date: string;
  defectType: string;
  count: number;
  total: number;
}

interface DefectRow {
  type: string;
  count: number;
  /** 생산수량 대비 불량률(%) */
  rate: number;
  /** 전체 불량 중 비중(%) — 도넛 조각 크기 */
  share: number;
  /** 최다 불량 여부 (동률이면 모두 true) */
  isTop: boolean;
}

// ─── 불량 유형별 고정 색상 (대시보드 팔레트 기준) ─────────────────────────────
// 이물=레드(안전·위생) / 중량미달=오렌지(규격 이탈) / 파손=퍼플 / 색상불량=그린 / 포장불량=블루 / 기타=그레이
// 라이트는 흰 배경 대비 확보를 위해 한 톤 깊게
const TYPE_COLORS_DARK: Record<string, string> = {
  이물: "#F73463",
  중량미달: "#FF9B2E",
  파손: "#9845EF",
  색상불량: "#43D1A7",
  포장불량: "#4560DC",
  기타: "#727C94",
};

const TYPE_COLORS_LIGHT: Record<string, string> = {
  이물: "#E02A55",
  중량미달: "#F28A12",
  파손: "#8338DC",
  색상불량: "#25B084",
  포장불량: "#3B52C8",
  기타: "#727C94",
};

// ─── CSS 변수 주입용 테마 맵 ──────────────────────────────────────────────────
// total: 총 불량 배지 / primary: 평균 불량률 배지 / highlight: 최다 불량(동률 시) · 최다 건수 텍스트
const DARK_VARS: Record<string, string> = {
  "--rc-border": "#2F374C",
  "--rc-text": "#e2e8f0",
  "--rc-text-muted": "#A8B0C3",
  "--rc-text-faint": "#8d97af",
  "--rc-select-bg": "rgba(255,255,255,0.06)",
  "--rc-select-option-bg": "#222631",
  "--rc-tooltip-bg": "#2F374C",
  "--rc-tooltip-border": "#3d4760",
  "--rc-total": "#4560DC",
  "--rc-primary": "#43D1A7",
  "--rc-highlight": "#F73463",
};

const LIGHT_VARS: Record<string, string> = {
  "--rc-border": "#e3e7ef",
  "--rc-text": "#222631",
  "--rc-text-muted": "#5e6882",
  "--rc-text-faint": "#6b7590",
  "--rc-select-bg": "rgba(34,38,49,0.04)",
  "--rc-select-option-bg": "#ffffff",
  "--rc-tooltip-bg": "#ffffff",
  "--rc-tooltip-border": "#e3e7ef",
  "--rc-total": "#3B52C8",
  "--rc-primary": "#25B084",
  "--rc-highlight": "#E02A55",
};

// ─── 목업 데이터 ─────────────────────────────────────────────────────────────
const DEFECT_TYPES = ["이물", "중량미달", "파손", "색상불량", "포장불량", "기타"];

const MOCK_DATA: DefectEntry[] = (() => {
  const seed = (n: number) => (((n * 1103515245 + 12345) & 0x7fffffff) % 40) + 3;
  let s = 7;
  return [
    "2025-01-15",
    "2025-01-22",
    "2025-01-29",
    "2025-02-05",
    "2025-02-12",
    "2025-02-19",
    "2025-03-03",
    "2025-03-10",
    "2025-03-17",
  ].flatMap((date) =>
    DEFECT_TYPES.map((defectType) => {
      s = seed(s);
      return { date, defectType, count: s, total: 500 };
    }),
  );
})();

// ─── 커스텀 Tooltip ───────────────────────────────────────────────────────────
function DonutTooltip({ active, payload }: { active?: boolean; payload?: { payload: DefectRow }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{d.type}</div>
      <div className={styles.tooltipRow}>
        {d.count}건 · 비중 {d.share.toFixed(1)}% · 불량률 {d.rate.toFixed(1)}%
      </div>
    </div>
  );
}

// ─── 커스텀 날짜 셀렉트 (div 기반 listbox) ────────────────────────────────────
interface DateSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function DateSelect({ value, options, onChange }: DateSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  // 키보드 이동 시 활성 항목이 보이도록 스크롤
  useEffect(() => {
    if (open) document.getElementById(optionId(activeIdx))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIdx]);

  const openMenu = () => {
    setActiveIdx(Math.max(options.indexOf(value), 0));
    setOpen(true);
  };

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIdx(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIdx(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        select(options[activeIdx]);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div className={styles.dateSelect} ref={rootRef}>
      <button
        type="button"
        className={styles.selectTrigger}
        role="combobox"
        aria-label="조회 일자"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(activeIdx) : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span>{value}</span>
        <ChevronDownIcon
          className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.selectMenu} role="listbox" id={listId} aria-label="조회 일자">
          {options.map((opt, i) => {
            const selected = opt === value;
            return (
              <div
                key={opt}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                className={[
                  styles.selectOption,
                  i === activeIdx ? styles.selectOptionActive : "",
                  selected ? styles.selectOptionSelected : "",
                ].join(" ")}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={(e) => e.preventDefault()} // 트리거 포커스 유지
                onClick={() => select(opt)}
              >
                <span>{opt}</span>
                {selected && <CheckIcon className={styles.selectCheck} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
interface DefectRadarChartProps {
  colorMode?: "dark" | "light";
}

interface BadgeItem {
  label: string;
  value: string;
  /** 값 뒤에 작게 붙는 단위 (건, % 등) */
  unit?: string;
  tone: string;
  Icon: typeof ExclamationTriangleIcon;
  /** 지정 시 tone 색을 덮어씀 (최다 불량 → 해당 도넛 조각 색) */
  color?: string;
}

/** 불량 유형별 발생 현황을 도넛 차트 + 건수 순 범례 + 요약 배지로 보여주는 컴포넌트 (mock 데이터 기반) */
export function DefectRadarChart({ colorMode = "dark" }: DefectRadarChartProps) {
  const cssVars = colorMode === "light" ? LIGHT_VARS : DARK_VARS;
  const typeColors = colorMode === "light" ? TYPE_COLORS_LIGHT : TYPE_COLORS_DARK;

  const dates = useMemo(() => [...new Set(MOCK_DATA.map((d) => d.date))].sort(), []);
  const [selectedDate, setSelectedDate] = useState(dates[dates.length - 1]);

  // 건수 내림차순 정렬 (동률은 DEFECT_TYPES 순서 유지)
  const rows: DefectRow[] = useMemo(() => {
    const entries = MOCK_DATA.filter((d) => d.date === selectedDate);
    const counts = DEFECT_TYPES.map((type) => entries.find((e) => e.defectType === type)?.count ?? 0);
    const total = counts.reduce((s, c) => s + c, 0);
    const maxCount = Math.max(...counts, 0);

    return DEFECT_TYPES.map((type, i) => ({
      type,
      count: counts[i],
      rate: (counts[i] / 500) * 100,
      share: total > 0 ? (counts[i] / total) * 100 : 0,
      isTop: counts[i] > 0 && counts[i] === maxCount,
    })).sort((a, b) => b.count - a.count);
  }, [selectedDate]);

  const totalDefects = rows.reduce((s, r) => s + r.count, 0);
  const avgRate = (rows.reduce((s, r) => s + r.rate, 0) / rows.length).toFixed(2);
  const topTypes = rows.filter((r) => r.isTop).map((r) => r.type);

  // 최다 불량이 단일 유형이면 해당 도넛 조각 색을 따라감 (동률이면 highlight 유지)
  const topColor = topTypes.length === 1 ? typeColors[topTypes[0]] : undefined;

  const badges: BadgeItem[] = [
    { label: "총 불량", value: String(totalDefects), unit: "건", tone: styles.toneTotal, Icon: ExclamationTriangleIcon },
    { label: "평균 불량률", value: avgRate, unit: "%", tone: styles.tonePrimary, Icon: ReceiptPercentIcon },
    {
      label: "최다 불량",
      value: topTypes.join(", ") || "-",
      tone: styles.toneHighlight,
      Icon: FlagIcon,
      color: topColor,
    },
  ];

  const chartData = rows.map((row) => ({ ...row, color: typeColors[row.type] })).filter((row) => row.count > 0);
  const chartLabel = `총 불량 ${totalDefects}건. ${rows.map((r) => `${r.type} ${r.count}건`).join(", ")}`;

  const HOVER_EXPAND = 8;

  const renderActiveShape = (props: React.ComponentProps<typeof Sector>) => (
    <Sector {...props} outerRadius={Number(props.outerRadius ?? 0) + HOVER_EXPAND} />
  );

  return (
    <div className={styles.card} style={cssVars as React.CSSProperties}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerLabel}>불량 유형별 분석</div>
          <h3 className={styles.headerTitle}>유형별 불량 비중</h3>
        </div>
        <DateSelect value={selectedDate} options={dates} onChange={setSelectedDate} />
      </div>

      <div className={styles.radarContent}>
        {/* 배지 */}
        <div className={styles.badges}>
          {badges.map((b) => (
            <div
              key={b.label}
              className={`${styles.badge} ${b.tone}`}
              style={b.color ? ({ "--tone": b.color } as React.CSSProperties) : undefined}
            >
              <span className={styles.badgeIconWrap}>
                <b.Icon className={styles.badgeIcon} aria-hidden="true" />
              </span>
              <div className={styles.badgeBody}>
                <span className={styles.badgeLabel}>{b.label}</span>
                <span className={styles.badgeValue} title={`${b.value}${b.unit ?? ""}`}>
                  {b.value}
                  {b.unit && <span className={styles.badgeUnit}>{b.unit}</span>}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 도넛 + 범례 */}
        <div className={styles.chartBox}>
          <div className={styles.donutWrap} role="img" aria-label={chartLabel}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="type"
                  innerRadius="74%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={3}  
                  cornerRadius={8} 
                  stroke="none"
                >
                  {chartData.map((row) => (
                    <Cell key={row.type} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} wrapperStyle={{ zIndex: 10 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.donutCenter}>
              <span className={styles.donutTotal}>{totalDefects}건</span>
              <span className={styles.donutLabel}>총 불량</span>
            </div>
          </div>

          <ul className={styles.legend}>
            {rows.map((row) => (
              <li key={row.type} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: typeColors[row.type] }} aria-hidden="true" />
                <span className={styles.legendName}>{row.type}</span>
                <strong className={row.isTop ? styles.legendCountTop : styles.legendCount}>{row.count}건</strong>
                <span className={styles.legendShare}>{row.share.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}