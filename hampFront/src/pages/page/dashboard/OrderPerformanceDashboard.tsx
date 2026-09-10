import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  // LineChart,
  // Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  // Tooltip,
  Legend,
  LabelList,
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

// /** 1. 기존 기간별 추이 (선 형태) 차트 카드 */
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

/** 3. 하단 X축 연도별, 각 그룹별 막대 내부 바 차트 */
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

  // 💡 특정 차트 클릭 시 하단 표출을 위한 상태 관리
  const [selectedItemInfo, setSelectedItemInfo] = useState<{
    periodLabel: string;
    groupLabel: string;
    totalOrderQty: number;
    totalProducedQty: number;
    progressRate: string;
    periodStart?: string;
    periodEnd?: string;
  } | null>(null);

  const handleBarLegendClick = (e: any) => {
    const dataKey = String(e.dataKey || "");
    const clickedGroupKey = dataKey.endsWith("_prod") ? dataKey.replace("_prod", "") : dataKey;

    setVisibleGroupKeys((prev) => {
      if (prev === null) {
        return new Set([clickedGroupKey]);
      }

      const next = new Set(prev);

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
    setSelectedItemInfo(null);
  };

  const isFiltered = visibleGroupKeys !== null && visibleGroupKeys.size < groupKeys.length;

  const chartData = useMemo(() => {
    const periodSet = new Set<string>();
    groupList.forEach((group: any) => {
      group.points?.forEach((pt: any) => {
        if (pt.periodLabel) periodSet.add(pt.periodLabel);
      });
    });
    const periods = Array.from(periodSet).sort();

    return periods.map((periodLabel) => {
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
          periodLabel: periodLabel,
        };
      });

      return row;
    });
  }, [barData, groupBy]);

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

  const visibleGroupLabels = isFiltered
    ? groupList
      .filter((g: any) => visibleGroupKeys!.has(g.groupKey))
      .map((g: any) => g.groupLabel)
    : [];

  // 특정 차트 클릭 핸들러
  const handleBarClick = (data: any, dataKey: string) => {
    const baseKey = dataKey.endsWith("_prod")
      ? dataKey.replace("_prod", "")
      : dataKey.endsWith("_remain")
        ? dataKey.replace("_remain", "")
        : null;

    if (!baseKey) return;
    const info = data[`${baseKey}_info`];
    if (info) {
      setSelectedItemInfo(info);
    }
  };

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

      {isFiltered && (
        <div className="orderPerfDashboard__filterBanner">
          <span className="orderPerfDashboard__filterBadge">필터 모드</span>
          <span className="orderPerfDashboard__filterText">
            {visibleGroupLabels.length}개 항목 표시 중: {visibleGroupLabels.join(", ")}
          </span>
        </div>
      )}

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
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            margin={{ top: 40, right: 30, left: 20, bottom: 5 }}
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

  const getLabelText = (row: any) => {
    const info = row[`${group.groupKey}_info`];
    if (!info || info.totalOrderQty === 0) return "";
    return `${info.totalProducedQty.toLocaleString()} / ${info.totalOrderQty.toLocaleString()} (${info.progressRate}%)`;
  };

  return (
    <React.Fragment key={group.groupKey}>
      {/* 생산량 바 (100%일 때 레이블 담당) */}
      <Bar
        dataKey={`${group.groupKey}_prod`}
        name={group.groupLabel}
        fill={color}
        stackId={`group_stack_${group.groupKey}`}
        maxBarSize={28}
        hide={isHidden}
        onClick={(data) => handleBarClick(data, `${group.groupKey}_prod`)}
        style={{ cursor: "pointer" }}
      >
        {/* 생산량이 전체(100%)일 때만 레이블 출력 */}
        <LabelList
          dataKey={(row: any) => {
            const info = row[`${group.groupKey}_info`];
            return info && info.progressRate >= 100 ? getLabelText(row) : "";
          }}
          position="top"
          style={{ fill: "#1e293b", fontSize: 11, fontWeight: 700 }}
        />
      </Bar>

      {/* 잔여량 바 (0%이거나 진행 중일 때 레이블 담당) */}
      <Bar
        dataKey={`${group.groupKey}_remain`}
        name={group.groupLabel}
        fill="#e2e8f0"
        radius={[6, 6, 0, 0]}
        stackId={`group_stack_${group.groupKey}`}
        maxBarSize={28}
        legendType="none"
        hide={isHidden}
        onClick={(data) => handleBarClick(data, `${group.groupKey}_remain`)}
        style={{ cursor: "pointer" }}
      >
        {/* 진행률이 100% 미만일 때만 레이블 출력 */}
        <LabelList
          dataKey={(row: any) => {
            const info = row[`${group.groupKey}_info`];
            return info && info.progressRate < 100 ? getLabelText(row) : "";
          }}
          position="top"
          style={{ fill: "#1e293b", fontSize: 11, fontWeight: 700 }}
        />
      </Bar>
    </React.Fragment>
  );
})}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 특정 차트 클릭 시 하단에 표출되는 상세 정보 표 */}
      {selectedItemInfo && (
        <div style={{ marginTop: "24px", padding: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h5 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
              상세 정보: [{selectedItemInfo.groupLabel}] - {selectedItemInfo.periodLabel}
            </h5>
            <button
              type="button"
              onClick={() => setSelectedItemInfo(null)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#64748b" }}
            >
              닫기 ✕
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", background: "#fff" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#475569" }}>
                <th style={{ padding: "10px", borderBottom: "1px solid #cbd5e1" }}>기간 구분</th>
                <th style={{ padding: "10px", borderBottom: "1px solid #cbd5e1" }}>항목명</th>
                <th style={{ padding: "10px", borderBottom: "1px solid #cbd5e1", textAlign: "right" }}>총주문량</th>
                <th style={{ padding: "10px", borderBottom: "1px solid #cbd5e1", textAlign: "right" }}>생산량</th>
                <th style={{ padding: "10px", borderBottom: "1px solid #cbd5e1", textAlign: "right" }}>진행률</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>{selectedItemInfo.periodLabel}</td>
                <td style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", fontWeight: 600 }}>{selectedItemInfo.groupLabel}</td>
                <td style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>{selectedItemInfo.totalOrderQty.toLocaleString()} EA</td>
                <td style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", textAlign: "right", color: "#6366f1" }}>{selectedItemInfo.totalProducedQty.toLocaleString()} EA</td>
                <td style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: "bold", color: "#10b981" }}>{selectedItemInfo.progressRate}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
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