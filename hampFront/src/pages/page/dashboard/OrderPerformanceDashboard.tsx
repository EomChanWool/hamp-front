import { useState } from "react";
import {
  ResponsiveContainer,
  // AreaChart,
  // Area,
  // BarChart,
  // Bar,
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

  // null이면 '전체 보기(모두 켜짐)' 상태, Set에 키가 있으면 해당 키들만 켜진 상태
  const [visibleKeys, setVisibleKeys] = useState<Set<string> | null>(null);

  // 범례 클릭 핸들러
  const handleLegendClick = (e: any) => {
    const clickedKey = e.dataKey;

    setVisibleKeys((prev) => {
      // 1. 만약 현재 '전체 보기(null)' 상태였다면?
      // -> 첫 클릭이므로 '클릭한 것 단독으로' 켜기
      if (prev === null) {
        return new Set([clickedKey]);
      }

      // 2. 이미 무언가 선택(필터링)되어 있는 상태라면?
      const next = new Set(prev);
      if (next.has(clickedKey)) {
        // 이미 켜져 있는 걸 또 누르면 -> 끄기 (단, 다 꺼지면 전체 보기로 돌릴지 여부는 선택인데 여기선 끄기 처리)
        next.delete(clickedKey);
        // 만약 다 꺼버렸다면 아예 전체 보기(null)로 리셋하는 게 친절할 수 있습니다.
        return next.size === 0 ? null : next;
      } else {
        // 꺼져 있던 걸 누르면 -> 기존에 켜져 있던 것에 '추가'
        next.add(clickedKey);
        return next;
      }
    });
  };

  // 전체 보기 버튼 클릭: 전체 켜기로 리셋
  const handleShowAll = () => {
    setVisibleKeys(null);
  };

  // 탭 변경 시 상태 초기화
  const handleGroupChange = (newGroup: GroupByType) => {
    setGroupBy(newGroup);
    setVisibleKeys(null);
  };

  // 일부만 켜져 있는지 확인 (전체 보기 버튼 노출용)
  const isFiltered = visibleKeys !== null && visibleKeys.size < seriesKeys.length;

  return (
    <div className="orderPerfDashboard__card orderPerfDashboard__card--wide">
      <div className="orderPerfDashboard__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 className="orderPerfDashboard__title">기간별 추이</h4>

        {/* 전체 보기 버튼을 토글 버튼 그룹 스타일로 통일 */}
        {isFiltered && (
          <div className="orderPerfDashboard__toggle">
            <button
              type="button"
              className="isActive"
              onClick={handleShowAll}
            >
              전체 보기
            </button>
          </div>
        )}
      </div>

      <div className="orderPerfDashboard__toggle">
        <button
          type="button"
          className={groupBy === "item" ? "isActive" : ""}
          onClick={() => handleGroupChange("item")}
        >
          품목별
        </button>
        <button
          type="button"
          className={groupBy === "bp" ? "isActive" : ""}
          onClick={() => handleGroupChange("bp")}
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

      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={series} margin={{ top: 20, right: 80, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            width={40}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            formatter={(value: any, name: any) => [`${value} EA`, name]}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            wrapperStyle={{ fontSize: 12 }}
            onClick={handleLegendClick}
          />
          {seriesKeys.map((key, i) => {
            // visibleKeys가 null이면 전체 보기이므로 안 숨김(false)
            // null이 아니면 visibleKeys에 포함된 것만 보여주고 나머지는 숨김(isHidden = true)
            const isHidden = visibleKeys !== null && !visibleKeys.has(key);

            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={TREND_COLORS[i % TREND_COLORS.length]}
                strokeWidth={visibleKeys?.has(key) ? 3 : 2} // 선택된 선은 살짝 두껍게 강조
                dot={false}
                activeDot={{ r: 4 }}
                hide={isHidden}
                label={(props: any) => {
                  const isLast = props.index === series.length - 1;
                  if (!isLast || isHidden) return <></>;
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
            );
          })}
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

  //  const fallbackMockData = {
  //   monthlyAmount: [
  //     { name: "2026-01", value: 15000000 },
  //     { name: "2026-02", value: 22000000 },
  //     { name: "2026-03", value: 18000000 },
  //     { name: "2026-04", value: 26000000 },
  //     { name: "2026-05", value: 21000000 },
  //     { name: "2026-06", value: 29000000 },
  //   ],
  //   monthlyProd: [
  //     { name: "2026-01", value: 1200 },
  //     { name: "2026-02", value: 1900 },
  //     { name: "2026-03", value: 1500 },
  //     { name: "2026-04", value: 2400 },
  //     { name: "2026-05", value: 2000 },
  //     { name: "2026-06", value: 2700 },
  //   ],
  //   monthlyCount: [
  //     { name: "2026-01", value: 45 },
  //     { name: "2026-02", value: 60 },
  //     { name: "2026-03", value: 50 },
  //     { name: "2026-04", value: 75 },
  //     { name: "2026-05", value: 65 },
  //     { name: "2026-06", value: 85 },
  //   ],
  //   dailyCount: [
  //     { name: "01일", value: 5 },
  //     { name: "02일", value: 8 },
  //     { name: "03일", value: 3 },
  //     { name: "04일", value: 6 },
  //     { name: "05일", value: 7 },
  //     { name: "06일", value: 2 },
  //     { name: "07일", value: 9 },
  //   ]
  // };

  //  const safeData = {
  //   ...data, // 기존 TrendCard용 데이터(trendByItem 등)는 그대로 유지
  //   monthlyAmount: data?.monthlyAmount?.length ? data.monthlyAmount : fallbackMockData.monthlyAmount,
  //   monthlyProd: data?.monthlyProd?.length ? data.monthlyProd : fallbackMockData.monthlyProd,
  //   monthlyCount: data?.monthlyCount?.length ? data.monthlyCount : fallbackMockData.monthlyCount,
  //   dailyCount: data?.dailyCount?.length ? data.dailyCount : fallbackMockData.dailyCount,
  // };



  // const charts = [
  //   { key: "monthlyAmount", title: "월별 수주금액", color: "#6366f1", type: "month", chart: "area" },
  //   { key: "monthlyProd", title: "월별 생산예정량", color: "#10b981", type: "month", chart: "area" },
  //   { key: "monthlyCount", title: "월별 수주건수", color: "#f59e0b", type: "month", chart: "area" },
  //   { key: "dailyCount", title: "일별 수주건수", color: "#f97316", type: "day", chart: "bar" },
  // ];

  return (
    <div className="orderPerfDashboard">
      <TrendCard data={data} groupBy={groupBy} setGroupBy={setGroupBy} />
      {/* {charts.map((c) => (
        <div key={c.key} className="orderPerfDashboard__card">
          <h4 className="orderPerfDashboard__title">{c.title}</h4>
          <ResponsiveContainer width="100%" height={260}>
            {c.chart === "area" ? (
              <AreaChart
                data={safeData[c.key as keyof typeof safeData]} 
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
                  tickFormatter={(value) => {
                    const safeValue = value || 0;
                    return c.key === "monthlyAmount" ? `${(safeValue / 10000).toLocaleString()}만원` : safeValue.toLocaleString()
                  }}
                />

                <Tooltip
                  formatter={(value: any) => {
                    const num = Number(value || 0);
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
              <BarChart data={safeData[c.key as keyof typeof safeData]} 
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }} 
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />

                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={2} axisLine={false} tickLine={false} />

                <YAxis
                  width={50}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => (value || 0).toLocaleString()}
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
      ))} */}
    </div>
  );
}