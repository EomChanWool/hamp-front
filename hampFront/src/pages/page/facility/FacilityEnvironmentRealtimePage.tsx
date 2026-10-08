import { useMemo } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Panel } from "@components/card/Panel";
import { mesScreens } from "@/data/mesScreens";
import { KpiGrid } from "@components/kpi/KpiGrid";
import { RealtimeStrip } from "@components/common/RealtimeStrip";
import { useRealtimePulse } from "@/hooks/useRealtimePulse";

const DEF = mesScreens.facilityEnvironmentRealtime;

const A_SERIES = [
  { key: 'A동_온도',     label: '온도',    color: '#3b82f6', base: 55 },
  { key: 'A동_습도',     label: '습도',    color: '#10b981', base: 42 },
  { key: 'A동_CO2',      label: 'CO₂',     color: '#06b6d4', base: 25 },
  { key: 'A동_미세먼지', label: '미세먼지', color: '#34d399', base: 18 },
]

const B_SERIES = [
  { key: 'B동_온도',     label: '온도',    color: '#8b5cf6', base: 48 }, // 바이올렛
  { key: 'B동_습도',     label: '습도',    color: '#f59e0b', base: 30 }, // 앰버
  { key: 'B동_CO2',      label: 'CO₂',     color: '#f43f5e', base: 20 }, // 로즈
  { key: 'B동_미세먼지', label: '미세먼지', color: '#64748b', base: 12 }, // 슬레이트
]

/** 2시간 간격. 1시간 간격이 필요하면 '09:00', '11:00' ... 을 추가 */
const HOURS = ["08:00", "10:00", "12:00", "14:00", "16:00"];

function buildChartData(series: typeof A_SERIES, pulse: number) {
  return HOURS.map((hour, hi) => {
    const entry: Record<string, string | number> = { time: hour };
    series.forEach((s, si) => {
      entry[s.key] = Math.round(
        Math.min(
          100,
          Math.max(5, s.base + Math.sin((hi * 2 + si * 1.3 + pulse * 0.25) * 0.7) * s.base * 0.45),
        ),
      );
    });
    return entry;
  });
}

type EnvChartProps = {
  title: string;
  series: typeof A_SERIES;
  pulse: number;
};

function EnvChart({ title, series, pulse }: EnvChartProps) {
  const data = useMemo(() => buildChartData(series, pulse), [series, pulse]);

  return (
    <Panel title={title}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          barCategoryGap="22%"
          barGap={3}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--text-body)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
            formatter={(value, name) => {
              const s = series.find((s) => s.key === name);
              return [`${value}`, s?.label ?? name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 14 }}
            iconType="circle"
            iconSize={8}
            formatter={(value) => series.find((s) => s.key === value)?.label ?? value}
          />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={s.color}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              animationDuration={400}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

export function FacilityEnvironmentRealtimePage() {
  const { pulse, updatedAt } = useRealtimePulse(true);

  return (
    <section className="screenStack">
      {DEF.kpis && <KpiGrid kpis={DEF.kpis} pulse={pulse} />}
      <div className="panel">
        <RealtimeStrip updatedAt={updatedAt} />
        <div className="contentGrid two">
          <EnvChart title="A동 원료실 환경 현황" series={A_SERIES} pulse={pulse} />
          <EnvChart title="B동 생산실 환경 현황" series={B_SERIES} pulse={pulse} />
        </div>
      </div>
    </section>
  );
}