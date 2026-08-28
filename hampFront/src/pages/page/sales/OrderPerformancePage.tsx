import { useOrderChartData } from '@/hooks/useOrderChartData';
import { OrderPerformanceDashboard } from '@pages/page/dashboard/OrderPerformanceDashboard'; 
import { useTableData } from '@/hooks/useTableData';
import { mesScreens } from '@/data/mesScreens';
import type { StatusTone } from '@/types';
import { KpiGrid } from '@/components/kpi/KpiGrid';
import { ProgressRadialChart } from '@components/chart/ProgressRadialChart';

const DEF = mesScreens.orderManage;

export function OrderPerformancePage() {
  const { filteredRows } = useTableData(DEF.rows);
  const chartData = useOrderChartData(filteredRows);

  const currentProgressPct = 76.4; 

  const orderStatusKpis: { label: string; value: React.ReactNode; tone: StatusTone }[] = [
    { 
      label: '', 
      value: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '2px' }}>
          {/* 차트 크기를 55로 줄여 다른 카드 높이와 완벽하게 평형을 맞춤 */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ProgressRadialChart value={currentProgressPct} label="" size={55} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
              2,564 / 3,450 EA
            </span>
            <span style={{ fontSize: '10px', color: '#d97706', background: '#fef3c7', borderRadius: '4px', width: 'fit-content', fontWeight: 600 }}>
              ● 8월 평균 진행중
            </span>
          </div>
        </div>
      ), 
      tone: 'warn' 
    },
    { label: '총 주문수량', value: '1,850 EA', tone: 'danger' },
    { label: '총 생산수량', value: '1,414 EA', tone: 'warn' },
    { label: '완료 라인', value: '1 / 4 건', tone: 'good' },
  ];

  return (
    <section className="screenStack">
      <h2>수주 실적 현황</h2>
      <KpiGrid kpis={orderStatusKpis} />
      <OrderPerformanceDashboard data={chartData} />
    </section>
  );
}