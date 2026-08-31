import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart, // [추가] 기간별 추이 카드용 멀티 라인 차트
  Line, // [추가]
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend, // [추가] 라인별 범례(품목명/거래처명) 표시용
} from "recharts";
import { useState } from "react"; // [추가] 품목별/거래처별 토글 상태
import "./OrderPerformanceDashboard.css";

const TREND_COLORS = ["#6366f1", "#a855f7", "#06b6d4", "#ec4899", "#f59e0b", "#10b981"];

function TrendCard({ data }: { data: any }) {
  // 품목별 / 거래처별 전환 토글.
  const [groupBy, setGroupBy] = useState<"item" | "vendor">("item");

  // data.trendByItem / data.trendByVendor 는 useOrderChartData.ts의
  // buildTrendSeries()가 만들어주는 값. 아직 훅을 안 바꿨다면 undefined이므로
  // 아래 옵셔널 체이닝으로 방어함.
  const series = groupBy === "item" ? data?.trendByItem : data?.trendByVendor;

  // series의 첫 번째 row에서 name을 제외한 나머지 키가 곧 라인 목록(품목명/거래처명)
  const seriesKeys = series?.length ? Object.keys(series[0]).filter((k) => k !== "name") : [];

  return (
    // [추가] orderPerfDashboard__card--wide 클래스로 2열 그리드 전체 너비를 차지함
    // (CSS 쪽에 grid-column: 1 / -1 로 정의되어 있음)
    <div className="orderPerfDashboard__card orderPerfDashboard__card--wide">
      {/* [추가] 카드 제목 + 품목별/거래처별 토글을 한 줄에 배치하는 헤더 */}
      <div className="orderPerfDashboard__header">
        <h4 className="orderPerfDashboard__title">기간별 추이</h4>
        <div className="orderPerfDashboard__toggle">
          <button type="button" className={groupBy === "item" ? "isActive" : ""} onClick={() => setGroupBy("item")}>
            품목별
          </button>
          <button
            type="button"
            className={groupBy === "vendor" ? "isActive" : ""}
            onClick={() => setGroupBy("vendor")}
          >
            거래처별
          </button>
        </div>
      </div>

      {/* TODO: series가 비어있을 때(rows 없음/훅 미적용) 빈 상태 UI 필요할지 검토.
          지금은 recharts가 빈 배열을 받으면 빈 차트 영역만 그림. */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={series} margin={{ top: 10, right: 80, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            width={40}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
          />
          <Tooltip formatter={(value: any) => [`${value}%`, ""]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Legend verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ fontSize: 12, top: -5 }} />
          {seriesKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={TREND_COLORS[i % TREND_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              // [추가] 마지막 데이터 포인트 옆에만 퍼센트 값을 텍스트로 표시
              // (참고 이미지에서 각 라인 끝에 "100%", "98%" 등이 붙어있던 부분)
              label={(props: any) => {
                const isLast = props.index === series.length - 1;
                if (!isLast) return <></>;
                return (
                  <text
                    x={props.x + 8}
                    y={props.y}
                    fill={TREND_COLORS[i % TREND_COLORS.length]}
                    fontSize={12}
                    fontWeight={700}
                  >
                    {props.value}%
                  </text>
                );
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrderPerformanceDashboard({ data }: { data: any }) {
  // [기존] 단일 값 차트 4개 정의 - 변경 없음
  const charts = [
    { key: "monthlyAmount", title: "월별 수주금액", color: "#6366f1", type: "month", chart: "area" },
    { key: "monthlyProd", title: "월별 생산예정량", color: "#10b981", type: "month", chart: "area" },
    { key: "monthlyCount", title: "월별 수주건수", color: "#f59e0b", type: "month", chart: "area" },
    { key: "dailyCount", title: "일별 수주건수", color: "#f97316", type: "day", chart: "bar" },
  ];

  return (
    <div className="orderPerfDashboard">
        {/* [추가] 기간별 추이 카드. 2열 그리드 전체 너비를 차지하며 4개 카드 아래에 배치됨.
          삭제하고 싶다면 이 한 줄만 지우면 됨. */}
      <TrendCard data={data} />
      {charts.map((c) => (
        <div key={c.key} className="orderPerfDashboard__card">
          {/* [기존] 단순 제목만 표시. descriptions(전월 대비 문구)는 이 버전에는 없음.
              나중에 필요해지면 h4를 orderPerfDashboard__header로 감싸고
              옆에 span을 추가하는 식으로 확장하면 됨. */}
          <h4 className="orderPerfDashboard__title">{c.title}</h4>
          <ResponsiveContainer width="100%" height={260}>
            {/* [기존] area/bar 분기 코드 그대로 - 변경 없음 */}
            {c.chart === "area" ? (
              <AreaChart
                data={data[c.key]}
                margin={{ top: 10, right: 30, left: c.key === "monthlyAmount" ? -10 : 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={`gradient-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c.color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={c.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} />

                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} axisLine={false} tickLine={false} />

                <YAxis
                  width={c.key === "monthlyAmount" ? 70 : 50}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) =>
                    c.key === "monthlyAmount" ? `${(value / 10000).toLocaleString()}만원` : value.toLocaleString()
                  }
                />

                <Tooltip
                  formatter={(value: any) => {
                    const num = Number(value);
                    const formattedValue =
                      c.key === "monthlyAmount" ? `${(num / 10000).toLocaleString()}만원` : num.toLocaleString();
                    const label = c.key === "monthlyAmount" ? "금액" : "수량/건수";
                    return [formattedValue, label];
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={c.color}
                  strokeWidth={2}
                  fill={`url(#gradient-${c.key})`}
                  dot={{ r: 3, stroke: c.color, strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            ) : (
              <BarChart data={data[c.key]} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} />

                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={2} axisLine={false} tickLine={false} />

                <YAxis
                  width={50}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => value.toLocaleString()}
                />

                <Tooltip
                  formatter={(value: any) => [Number(value).toLocaleString(), "수량/건수"]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />

                <Bar dataKey="value" fill={c.color} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
