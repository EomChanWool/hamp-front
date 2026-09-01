import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import "./OrderPerformanceDashboard.css";

const TREND_COLORS = ["#6366f1", "#a855f7", "#06b6d4", "#ec4899", "#f59e0b", "#10b981"];

type GroupByType = 'item' | 'bp' | 'order';

interface OrderPerformanceDashboardProps {
  data: any;
  groupBy: GroupByType;
  setGroupBy: (val: GroupByType) => void;
}

function TrendCard({
  data,
  groupBy,
  setGroupBy,
}: OrderPerformanceDashboardProps) {
  const series = groupBy === "item" ? data?.trendByItem : data?.trendByVendor;
  const seriesKeys = series?.length ? Object.keys(series[0]).filter((k) => k !== "name") : [];

  return (
    <div className="orderPerfDashboard__card orderPerfDashboard__card--wide">
      <div className="orderPerfDashboard__header">
        <h4 className="orderPerfDashboard__title">기간별 추이</h4>
        <div className="orderPerfDashboard__toggle">
          <button 
            type="button" 
            className={groupBy === "item" ? "isActive" : ""} 
            onClick={() => setGroupBy("item")}
          >
            품목별
          </button>
          <button
            type="button"
            className={groupBy === "bp" ? "isActive" : ""} 
            onClick={() => setGroupBy("bp")}
          >
            거래처별
          </button>
          {/* <button
            type="button"
            className={groupBy === "order" ? "isActive" : ""}
            onClick={() => setGroupBy("order")}
          >
            수주별
          </button> */}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={series} margin={{ top: 10, right: 80, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            width={40}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip formatter={(value: any) => [`${value} EA`, ""]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
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
                    {props.value}
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

export function OrderPerformanceDashboard({
  data,
  groupBy,
  setGroupBy,
}: OrderPerformanceDashboardProps) {
  const charts = [
    { key: "monthlyAmount", title: "월별 수주금액", color: "#6366f1", type: "month", chart: "area" },
    { key: "monthlyProd", title: "월별 생산예정량", color: "#10b981", type: "month", chart: "area" },
    { key: "monthlyCount", title: "월별 수주건수", color: "#f59e0b", type: "month", chart: "area" },
    { key: "dailyCount", title: "일별 수주건수", color: "#f97316", type: "day", chart: "bar" },
  ];

  return (
    <div className="orderPerfDashboard">
      <TrendCard data={data} groupBy={groupBy} setGroupBy={setGroupBy} />
      {charts.map((c) => (
        <div key={c.key} className="orderPerfDashboard__card">
          <h4 className="orderPerfDashboard__title">{c.title}</h4>
          <ResponsiveContainer width="100%" height={260}>
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