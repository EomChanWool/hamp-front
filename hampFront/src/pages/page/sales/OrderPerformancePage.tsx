import { useState, useEffect } from 'react';
import { SalesOrderApi, type SalesOrderPerformanceKpiResponse, type SalesOrderPerformanceTrendSeriesResponse } from '@/api/sales/SalesOrder';
import { OrderPerformanceDashboard } from '@pages/page/dashboard/OrderPerformanceDashboard';
import { KpiGrid, type KpiItem } from '@/components/kpi/KpiGrid';
import { ProgressRadialChart } from '@components/chart/ProgressRadialChart';
import '@/components/kpi/KpiGrid.css';
import { Panel } from '@/components/card/Panel';

type PeriodUnit = 'month' | 'quarter' | 'year';
type GroupByType = 'item' | 'bp' | 'order';

const PERIOD_TABS: { key: PeriodUnit; label: string }[] = [
  { key: 'month', label: '월간' },
  { key: 'quarter', label: '분기' },
  { key: 'year', label: '연간' },
];

/** 
 * 서버에서 받아온 periodStart 날짜를 기반으로 화면 표시용 라벨 생성 
 */
function formatPeriodBadgeText(periodStart?: string, unit?: PeriodUnit) {
  if (!periodStart) return '';

  const date = new Date(periodStart);
  if (isNaN(date.getTime())) return '';

  const fullYear = date.getFullYear();
  const shortYear = String(fullYear).slice(-2);
  const month = date.getMonth() + 1;

  if (unit === 'month') {
    return `${shortYear}년 ${month}월`;
  }

  if (unit === 'quarter') {
    const quarter = Math.ceil(month / 3);
    return `${shortYear}년 Q${quarter}`;
  }

  if (unit === 'year') {
    return `${fullYear}년`;
  }

  return '';
}

/** 
 * 서버에서 받아온 추이 배열 데이터를 Recharts가 이해할 수 있는 형식으로 변환 
 */
function convertTrendToChartData(trendSeriesList: SalesOrderPerformanceTrendSeriesResponse[]) {
  if (!trendSeriesList || trendSeriesList.length === 0) return [];

  const periodSet = new Set<string>();
  trendSeriesList.forEach((series) => {
    series.points?.forEach((p) => {
      if (p.periodLabel) periodSet.add(p.periodLabel);
    });
  });
  const periods = Array.from(periodSet);

  return periods.map((periodLabel) => {
    const row: Record<string, any> = { name: periodLabel };

    trendSeriesList.forEach((series) => {
      const point = series.points?.find((p) => p.periodLabel === periodLabel);
      row[series.groupLabel] = point ? point.totalOrderQty : 0;
    });

    return row;
  });
}

export function OrderPerformancePage() {
  const [period, setPeriod] = useState<PeriodUnit>('year');
  const [groupBy, setGroupBy] = useState<GroupByType>('item');

  const [kpiData, setKpiData] = useState<SalesOrderPerformanceKpiResponse | null>(null);
  const [trendData, setTrendData] = useState<SalesOrderPerformanceTrendSeriesResponse[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. KPI API 호출
        const kpiRes = await SalesOrderApi.getPerformanceKpi({ period });
        if (kpiRes?.data) {
          setKpiData(kpiRes.data);
        }

        // 2. 추이 API 호출
        const trendRes = await SalesOrderApi.getPerformanceTrend({ period, groupBy });
        if (trendRes?.data) {
          setTrendData(trendRes.data);
        }
      } catch (error) {
        console.error('데이터를 불러오는 중 오류가 발생했습니다:', error);
      }
    };

    fetchData();
  }, [period, groupBy]);

  const currentProgressPct = kpiData?.progressRate ?? 0;
  const totalOrderQty = kpiData?.totalOrderQty ?? 0;
  const totalProducedQty = kpiData?.totalProducedQty ?? 0;
  const completedLineCount = kpiData?.completedLineCount ?? 0;
  const totalLineCount = kpiData?.totalLineCount ?? 0;

  const orderStatusKpis: KpiItem[] = [
    {
      label: '진행률',
      value: null,
      tone: 'warn',
      render: (isDark) => (
        <div className="customProgressKpiCard customProgressKpiCard--spread">
          <ProgressRadialChart value={currentProgressPct} size={110} isDark={isDark} />
          <div className="customProgressKpiCard__text">
            <span className="customProgressKpiCard__title">
              {totalProducedQty.toLocaleString()} / {totalOrderQty.toLocaleString()} EA
            </span>
            <span className="customProgressKpiCard__badge">
              ● {formatPeriodBadgeText(kpiData?.periodStart, period)} 진행중
            </span>
          </div>
        </div>
      ),
    },
    { label: '총 주문수량', value: `${totalOrderQty.toLocaleString()} EA`, tone: 'danger' },
    { label: '총 생산수량', value: `${totalProducedQty.toLocaleString()} EA`, tone: 'warn' },
    { label: '완료 라인', value: `${completedLineCount} / ${totalLineCount} 건`, tone: 'good' },
  ];

  const formattedChartData = convertTrendToChartData(trendData);

  const dashboardData = {
    trendByItem: groupBy === 'item' ? formattedChartData : [],
    trendByVendor: groupBy === 'bp' ? formattedChartData : [],
    monthlyAmount: [],
    monthlyProd: [],
    monthlyCount: [],
    dailyCount: [],
  };

  return (
    <section className="screenStack">
      <Panel title="수주실적 현황">
        {/* 조회 단위 변경 탭 */}
        <div className="tabGroup" role="tablist" aria-label="집계 기간 선택">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={period === tab.key}
              className={`tabButton ${period === tab.key ? ' tabButtonActive' : ''}`}
              onClick={() => setPeriod(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Panel>

      <KpiGrid kpis={orderStatusKpis} />
      <OrderPerformanceDashboard
        data={dashboardData}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />
    </section>
  );
}