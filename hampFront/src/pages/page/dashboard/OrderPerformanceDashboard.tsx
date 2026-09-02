import React, { useState } from "react";
import {
  ResponsiveContainer,
  // LineChart,
  // Line,
  BarChart,
  Bar,
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
  barData?: any;
  groupBy: GroupByType;
  setGroupBy: (val: GroupByType) => void;
}

/** 1. 기존 기간별 추이 (선 형태) 차트 카드 */
// function TrendCard({
//   data,
//   groupBy,
//   setGroupBy,
// }: OrderPerformanceDashboardProps) {
//   const series = groupBy === "item" ? data?.trendByItem : data?.trendByVendor;
//   const seriesKeys = series?.length ? Object.keys(series[0]).filter((k) => k !== "name") : [];

//   const [visibleKeys, setVisibleKeys] = useState<Set<string> | null>(null);

//   const handleLegendClick = (e: any) => {
//     const clickedKey = e.dataKey;

//     setVisibleKeys((prev) => {
//       // 1. 아직 아무것도 필터링되지 않은 상태(전체 보기)에서 클릭한 경우:
//       // -> "그 하나만 먼저 선택된 상태"로 만듦
//       if (prev === null) {
//         return new Set([clickedKey]);
//       }

//       const next = new Set(prev);

//       // 2. 이미 선택되어 있는 상태라면?
//       if (next.has(clickedKey)) {
//         next.delete(clickedKey);
//         // 만약 다 지워져서 0개가 되면 -> 다시 전체 보기(null)로 처리
//         if (next.size === 0) {
//           return null;
//         }
//       } else {
//         // 3. 선택되지 않은 항목이라면 추가(누적)
//         next.add(clickedKey);
//       }

//       // 만약 우연히 전부 다 선택된 상태가 된다면 전체 보기(null)로 처리하여 깔끔하게 유지
//       if (next.size === seriesKeys.length) {
//         return null;
//       }

//       return next;
//     });
//   };

//   const handleShowAll = () => {
//     setVisibleKeys(null);
//   };

//   const handleGroupChange = (newGroup: GroupByType) => {
//     setGroupBy(newGroup);
//     setVisibleKeys(null);
//   };

//   const isFiltered = visibleKeys !== null && visibleKeys.size < seriesKeys.length;

//   return (
//     <div className="orderPerfDashboard__card orderPerfDashboard__card--wide">
//       <div className="orderPerfDashboard__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h4 className="orderPerfDashboard__title">기간별 추이</h4>

//         {isFiltered && (
//           <div className="orderPerfDashboard__toggle">
//             <button
//               type="button"
//               className="isActive"
//               onClick={handleShowAll}
//             >
//               전체 보기
//             </button>
//           </div>
//         )}
//       </div>

//       <div className="orderPerfDashboard__toggle">
//         <button
//           type="button"
//           className={groupBy === "item" ? "isActive" : ""}
//           onClick={() => handleGroupChange("item")}
//         >
//           품목별
//         </button>
//         <button
//           type="button"
//           className={groupBy === "bp" ? "isActive" : ""}
//           onClick={() => handleGroupChange("bp")}
//         >
//           거래처별
//         </button>
//       </div>

//       <ResponsiveContainer width="100%" height={360}>
//         <LineChart data={series} margin={{ top: 20, right: 80, left: 20, bottom: 0 }}>
//           <CartesianGrid strokeDasharray="3 3" vertical={false} />
//           <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
//           <YAxis
//             width={40}
//             tick={{ fontSize: 10 }}
//             axisLine={false}
//             tickLine={false}
//             tickFormatter={(v) => `${v}`}
//           />
//           <Tooltip
//             formatter={(value: any, name: any) => [`${value} EA`, name]}
//             contentStyle={{ borderRadius: 8, fontSize: 12 }}
//           />
//           <Legend
//             verticalAlign="bottom"
//             align="center"
//             iconType="circle"
//             wrapperStyle={{ fontSize: 12 }}
//             onClick={handleLegendClick}
//           />
//           {seriesKeys.map((key, i) => {
//             const isHidden = visibleKeys !== null && !visibleKeys.has(key);

//             return (
//               <Line
//                 key={key}
//                 type="monotone"
//                 dataKey={key}
//                 stroke={TREND_COLORS[i % TREND_COLORS.length]}
//                 strokeWidth={visibleKeys?.has(key) ? 3 : 2}
//                 dot={false}
//                 activeDot={{ r: 4 }}
//                 hide={isHidden}
//                 label={(props: any) => {
//                   const isLast = props.index === series.length - 1;
//                   if (!isLast || isHidden) return <></>;
//                   return (
//                     <text
//                       x={props.x + 8}
//                       y={props.y}
//                       fill={TREND_COLORS[i % TREND_COLORS.length]}
//                       fontSize={12}
//                       fontWeight={700}
//                     >
//                       {props.value}
//                     </text>
//                   );
//                 }}
//               />
//             );
//           })}
//         </LineChart>
//       </ResponsiveContainer>
//     </div>
//   );
// }

/** 3. 하단 X축 연도별, 각 그룹별 막대 내부 바 차트 (누적 다중 선택 인터랙션 연동) */
function PerformanceBarCard({
  barData,
  groupBy,
  setGroupBy,
}: {
  barData: any;
  groupBy: GroupByType;
  setGroupBy: (val: GroupByType) => void;
}) {
  const rawGroupList = Array.isArray(barData)
    ? barData
    : Array.isArray(barData?.data)
      ? barData.data
      : (groupBy === "item" ? barData?.performanceTrendByItem : barData?.performanceTrendByVendor) || barData?.performanceTrend || [];

  const groupList = Array.isArray(rawGroupList) ? rawGroupList : [];
  const groupKeys = groupList.map((g: any) => g.groupKey);

  const [visibleGroupKeys, setVisibleGroupKeys] = useState<Set<string> | null>(null);

  const handleBarLegendClick = (e: any) => {
    const dataKey = String(e.dataKey || "");
    const clickedGroupKey = dataKey.endsWith("_prod") ? dataKey.replace("_prod", "") : dataKey;

    setVisibleGroupKeys((prev) => {
      // 1. 전체 보기 상태에서 클릭 시 -> 해당 항목만 먼저 선택
      if (prev === null) {
        return new Set([clickedGroupKey]);
      }

      const next = new Set(prev);

      // 2. 이미 선택된 상태면 해제, 아니면 추가(누적)
      if (next.has(clickedGroupKey)) {
        next.delete(clickedGroupKey);
        if (next.size === 0) {
          return null;
        }
      } else {
        next.add(clickedGroupKey);
      }

      if (next.size === groupKeys.length) {
        return null;
      }

      return next;
    });
  };

  const handleShowAll = () => {
    setVisibleGroupKeys(null);
  };

  const handleGroupChange = (newGroup: GroupByType) => {
    setGroupBy(newGroup);
    setVisibleGroupKeys(null);
  };

  if (groupList.length === 0) {
    return (
      <div className="orderPerfDashboard__card orderPerfDashboard__card--wide">
        <div className="orderPerfDashboard__header">
          <h4 className="orderPerfDashboard__title">기간별 달성 현황</h4>
        </div>
        <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          데이터가 없습니다.
        </div>
      </div>
    );
  }

  const isFiltered = visibleGroupKeys !== null && visibleGroupKeys.size < groupKeys.length;

  const periodSet = new Set<string>();
  groupList.forEach((group: any) => {
    group.points?.forEach((pt: any) => {
      if (pt.periodLabel) periodSet.add(pt.periodLabel);
    });
  });
  const periods = Array.from(periodSet).sort();

  const chartData = periods.map((periodLabel) => {
    const row: Record<string, any> = { name: periodLabel };

    groupList.forEach((group: any) => {
      const point = group.points?.find((p: any) => p.periodLabel === periodLabel);
      const orderQty = point ? point.totalOrderQty || 0 : 0;
      const prodQty = point ? point.totalProducedQty || 0 : 0;

      const actualProd = Math.min(prodQty, orderQty);
      const remainingOrder = Math.max(0, orderQty - actualProd);

      row[`${group.groupKey}_prod`] = actualProd;
      row[`${group.groupKey}_remain`] = remainingOrder;

      row[`${group.groupKey}_info`] = {
        groupLabel: group.groupLabel,
        totalOrderQty: orderQty,
        totalProducedQty: prodQty,
        progressRate: orderQty > 0 ? ((prodQty / orderQty) * 100).toFixed(1) : 0,
        periodStart: point?.periodStart,
        periodEnd: point?.periodEnd,
      };
    });

    return row;
  });

  return (
    <div className="orderPerfDashboard__card orderPerfDashboard__card--wide">
      <div className="orderPerfDashboard__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 className="orderPerfDashboard__title">기간별 현황</h4>

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

      <div className="orderPerfDashboard__toggle" style={{ marginBottom: "16px" }}>
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
      </div>

      <div style={{ marginTop: "16px" }}>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis
              width={50}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => (value || 0).toLocaleString()}
            />
            <Tooltip
              shared={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const entry = payload[0];
                  if (!entry || !entry.dataKey) return null;

                  const dataKey = String(entry.dataKey);
                  const baseKey = dataKey.endsWith("_prod") 
                    ? dataKey.replace("_prod", "") 
                    : dataKey.endsWith("_remain") 
                      ? dataKey.replace("_remain", "") 
                      : null;

                  if (!baseKey) return null;

                  const groupIndex = groupList.findIndex((g: any) => g.groupKey === baseKey);
                  const group = groupList[groupIndex];
                  const info = entry.payload[`${baseKey}_info`];

                  if (!group || !info || info.totalOrderQty === 0) return null;

                  const color = TREND_COLORS[groupIndex % TREND_COLORS.length];

                  return (
                    <div style={{ background: "#fff", padding: "12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                      <p style={{ fontWeight: "bold", marginBottom: 6, color: "#0f172a" }}>
                        {entry.payload.name}
                      </p>
                      <div style={{ paddingTop: 4 }}>
                        <p style={{ fontWeight: 600, color: color }}>{info.groupLabel}</p>
                        <p style={{ color: "#64748b", fontSize: 12 }}>총주문량: {info.totalOrderQty?.toLocaleString()} EA</p>
                        <p style={{ color: "#6366f1", fontSize: 12 }}>생산량: {info.totalProducedQty?.toLocaleString()} EA</p>
                        <p style={{ color: "#10b981", fontWeight: "bold", fontSize: 12, marginTop: 2 }}>
                          진행률: {info.progressRate}%
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
              cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
              onClick={handleBarLegendClick}
              formatter={(value, entry: any) => {
                if (entry.dataKey && entry.dataKey.endsWith("_remain")) {
                  return null; 
                }
                return value; 
              }}
            />

            {groupList.map((group: any, i: number) => {
              const color = TREND_COLORS[i % TREND_COLORS.length];
              const isHidden = visibleGroupKeys !== null && !visibleGroupKeys.has(group.groupKey);

              return (
                <React.Fragment key={group.groupKey}>
                  <Bar
                    dataKey={`${group.groupKey}_prod`}
                    name={group.groupLabel}
                    fill={color}
                    stackId={`group_stack_${group.groupKey}`}
                    maxBarSize={28}
                    hide={isHidden}
                  />
                  <Bar
                    dataKey={`${group.groupKey}_remain`}
                    name={group.groupLabel}
                    fill="#e2e8f0"
                    radius={[6, 6, 0, 0]}
                    stackId={`group_stack_${group.groupKey}`}
                    maxBarSize={28}
                    legendType="none"
                    hide={isHidden}
                  />
                </React.Fragment>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 메인 대시보드 컴포넌트 */
export function OrderPerformanceDashboard({
  // data,
  barData,
  groupBy,
  setGroupBy,
}: OrderPerformanceDashboardProps) {
  return (
    <div className="orderPerfDashboard">
      {/* <TrendCard data={data} groupBy={groupBy} setGroupBy={setGroupBy} /> */}
      <PerformanceBarCard barData={barData} groupBy={groupBy} setGroupBy={setGroupBy} />
    </div>
  );
}