import { useOrderChartData } from '../../hooks/useOrderChartData';
import { OrderPerformanceDashboard } from '../dashboard/OrderPerformanceDashboard'; 
import { useTableData } from '../../hooks/useTableData';
import { mesScreens } from '../../data/mesScreens';

const DEF = mesScreens.orderManage;

export function OrderPerformancePage() {
  const { filteredRows } = useTableData(DEF.rows);
  const chartData = useOrderChartData(filteredRows);

  return (
    <section className="screenStack">
      <h2>수주 실적 현황</h2>
      <OrderPerformanceDashboard data={chartData} />
    </section>
  );
}