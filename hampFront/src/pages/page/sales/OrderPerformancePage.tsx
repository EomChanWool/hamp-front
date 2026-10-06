import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  ChartPieIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { SalesOrderApi, type SalesOrderPerformanceKpiResponse, type SalesOrderPerformanceTrendSeriesResponse } from '@/api/sales/SalesOrder';
import { OrderPerformanceDashboard } from '@pages/page/dashboard/OrderPerformanceDashboard';
import { ProgressRadialChart } from '@components/chart/ProgressRadialChart';
import { Panel } from '@/components/card/Panel';
import './Sales.css'; // 반드시 OrderPerformanceDashboard import 보다 아래에 둘 것 (토글 스타일 덮어쓰기)

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

  const periods = Array.from(periodSet).sort();

  return periods.map((periodLabel) => {
    const row: Record<string, any> = { name: periodLabel };

    trendSeriesList.forEach((series) => {
      const point = series.points?.find((p) => p.periodLabel === periodLabel);
      row[series.groupLabel] = point ? point.totalOrderQty : 0;
    });

    return row;
  });
}

/* ══════════════════════════════════════════
   KPI 카드 (이 페이지 전용)
══════════════════════════════════════════ */
type KpiTone = 'blue' | 'amber' | 'green';
type KpiIcon = typeof CubeIcon;

/** 가까운 [data-theme] 요소를 보고 다크모드 여부를 추적 (ProgressRadialChart 의 isDark 용) */
function useIsDark(ref: RefObject<HTMLElement | null>) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const host = ref.current?.closest('[data-theme]');
    if (!host) return;
    const read = () => setIsDark(host.getAttribute('data-theme') === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(host, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [ref]);

  return isDark;
}

function ProgressCard({
  pct,
  ordered,
  produced,
  periodText,
}: {
  pct: number;
  ordered: number;
  produced: number;
  periodText: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isDark = useIsDark(ref);
  const remaining = Math.max(ordered - produced, 0);

  return (
    <div ref={ref} className="opKpi opKpi--amber opKpi--withChart">
      <div className="opKpi__main">
        <div className="opKpi__top">
          <span className="opKpi__icon" aria-hidden>
            <ChartPieIcon />
          </span>
          <span className="opKpi__label">진행률</span>
        </div>

        <strong className="opKpi__value">
          {remaining.toLocaleString()}
          <small> EA 남음</small>
        </strong>
        <span className="opKpi__sub">{periodText ? `${periodText} 기준` : '-'}</span>
      </div>

      <div className="opKpi__chart">
        <ProgressRadialChart value={pct} size={80} isDark={isDark} />
      </div>
    </div>
  );
}

function StatCard({
  Icon,
  tone,
  label,
  value,
  unit,
  sub,
}: {
  Icon: KpiIcon;
  tone: KpiTone;
  label: string;
  value: string;
  unit: string;
  sub: string;
}) {
  return (
    <div className={`opKpi opKpi--${tone}`}>
      <div className="opKpi__main">
        <div className="opKpi__top">
          <span className="opKpi__icon" aria-hidden>
            <Icon />
          </span>
          <span className="opKpi__label">{label}</span>
        </div>

        <strong className="opKpi__value">
          {value}
          <small> {unit}</small>
        </strong>
        <span className="opKpi__sub">{sub}</span>
      </div>
    </div>
  );
}

export function OrderPerformancePage() {
  const [period, setPeriod] = useState<PeriodUnit>('year');
  const [groupBy, setGroupBy] = useState<GroupByType>('item');

  const [kpiData, setKpiData] = useState<SalesOrderPerformanceKpiResponse | null>(null);
  const [trendData, setTrendData] = useState<SalesOrderPerformanceTrendSeriesResponse[]>([]);

  // 탭(period)을 빠르게 연속 전환할 때 반투명 처리로만 로딩을 표시하기 위한 플래그
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 이전 요청이 늦게 도착해서 최신 상태를 덮어쓰는 걸 막기 위한 cancel 플래그
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [kpiRes, trendRes] = await Promise.all([
          SalesOrderApi.getPerformanceKpi({ period }),
          SalesOrderApi.getPerformanceTrend({ period, groupBy }),
        ]);

        if (cancelled) return;

        if (kpiRes?.data) {
          setKpiData(kpiRes.data);
        }
        if (trendRes?.data) {
          setTrendData(trendRes.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('데이터를 불러오는 중 오류가 발생했습니다:', error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [period, groupBy]);

  const currentProgressPct = kpiData?.progressRate ?? 0;
  const totalOrderQty = kpiData?.totalOrderQty ?? 0;
  const totalProducedQty = kpiData?.totalProducedQty ?? 0;
  const completedLineCount = kpiData?.completedLineCount ?? 0;
  const totalLineCount = kpiData?.totalLineCount ?? 0;

  const periodText = formatPeriodBadgeText(kpiData?.periodStart, period);

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
    // 전체를 반투명 처리 + 클릭 차단으로만 표시
    <section className={`screenStack${isLoading ? ' screenStack--loading' : ''}`}>
      <Panel title="수주실적 현황">
        <div className="opBar">
          {/* 기간별 현황 패널의 토글과 같은 클래스를 써서 디자인을 통일 */}
          <div className="orderPerfDashboard__toggle" role="tablist" aria-label="집계 기간 선택">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={period === tab.key}
                className={period === tab.key ? 'isActive' : ''}
                onClick={() => setPeriod(tab.key)}
                // 로딩 중 연타로 인한 중복 요청/깜빡임 방지
                disabled={isLoading}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="opBar__desc">
            <strong>{periodText || '-'}</strong> 기준 수주 대비 생산 실적
          </p>
        </div>
      </Panel>

      <div className="opKpis" role="group" aria-label="수주실적 요약">
        <ProgressCard
          pct={currentProgressPct}
          produced={totalProducedQty}
          ordered={totalOrderQty}
          periodText={periodText}
        />
        <StatCard
          Icon={ClipboardDocumentListIcon}
          tone="blue"
          label="총 주문수량"
          value={totalOrderQty.toLocaleString()}
          unit="EA"
          sub={`${totalLineCount.toLocaleString()}개 라인`}
        />
        <StatCard
          Icon={CubeIcon}
          tone="amber"
          label="총 생산수량"
          value={totalProducedQty.toLocaleString()}
          unit="EA"
          sub={`주문 대비 ${currentProgressPct}%`}
        />
        <StatCard
          Icon={CheckCircleIcon}
          tone="green"
          label="완료 라인"
          value={`${completedLineCount.toLocaleString()} / ${totalLineCount.toLocaleString()}`}
          unit="건"
          sub={`미완료 ${Math.max(totalLineCount - completedLineCount, 0).toLocaleString()}건`}
        />
      </div>

      <OrderPerformanceDashboard
        data={dashboardData}
        barData={trendData}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />
    </section>
  );
}