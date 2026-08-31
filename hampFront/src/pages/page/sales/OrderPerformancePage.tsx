import { useOrderChartData } from '@/hooks/useOrderChartData';
import { OrderPerformanceDashboard } from '@pages/page/dashboard/OrderPerformanceDashboard';
import { useTableData } from '@/hooks/useTableData';
import { mesScreens } from '@/data/mesScreens';
import { KpiGrid, type KpiItem } from '@/components/kpi/KpiGrid';
import { ProgressRadialChart } from '@components/chart/ProgressRadialChart';
import { useState } from 'react';
import '@/components/kpi/KpiGrid.css';

const DEF = mesScreens.orderManage;

// [추가] 상단 "월간 / 분기 / 연간" 탭 값 타입 및 목록.
// "기간별 추이" 카드의 X축 단위(월/분기/연)를 이 값으로 결정함.
type PeriodUnit = 'monthly' | 'quarterly' | 'yearly';

const PERIOD_TABS: { key: PeriodUnit; label: string }[] = [
  { key: 'monthly', label: '월간' },
  { key: 'quarterly', label: '분기' },
  { key: 'yearly', label: '연간' },
];

export function OrderPerformancePage() {
  const [period, setPeriod] = useState<PeriodUnit>('yearly');

  const { filteredRows } = useTableData(DEF.rows);
  const chartData = useOrderChartData(filteredRows, period);

  const currentProgressPct = 76.4;

  const orderStatusKpis: KpiItem[] = [
    {
      // render 카드는 label을 화면에 그리지 않지만, KpiGrid에서 key로 사용하므로
      // 다른 카드와 겹치지 않는 고유한 값을 넣어둔다.
      label: '진행률',
      value: null,
      tone: 'warn',
      render: (isDark) => (
        <div className="customProgressKpiCard customProgressKpiCard--spread">
          {/* 차트 크기를 55로 줄여 다른 카드 높이와 평형을 맞춤 */}
          <ProgressRadialChart value={currentProgressPct} label="" size={55} isDark={isDark} />
          <div className="customProgressKpiCard__text">
            <span className="customProgressKpiCard__title">2,564 / 3,450 EA</span>
            <span className="customProgressKpiCard__badge">● 8월 평균 진행중</span>
          </div>
        </div>
      ),
    },
    { label: '총 주문수량', value: '1,850 EA', tone: 'danger' },
    { label: '총 생산수량', value: '1,414 EA', tone: 'warn' },
    { label: '완료 라인', value: '1 / 4 건', tone: 'good' },
  ];

  return (
    <section className="screenStack">
      <h2>수주 실적 현황</h2>

      <div className="periodTabs" role="tablist" aria-label="집계 기간 선택">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={period === tab.key}
            className={`periodTabs__item${period === tab.key ? ' periodTabs__item--active' : ''}`}
            onClick={() => setPeriod(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <KpiGrid kpis={orderStatusKpis} />
      <OrderPerformanceDashboard data={chartData} />
    </section>
  );
}
