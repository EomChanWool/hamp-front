import { useMemo } from 'react';

export interface ChartData {
  name: string;
  value: number;
}

// [추가] 상단 "월간/분기/연간" 탭 값 타입.
export type PeriodUnit = 'monthly' | 'quarterly' | 'yearly';

// [추가] "기간별 추이" 집계에 쓸 컬럼 키.
// !!! 실제 rows 데이터 구조(mesScreens.orderManage 컬럼 정의)를 반드시 확인하고
//     아래 값들을 맞는 컬럼 키로 수정할 것. 지금은 추측값(c1~c6)임.
const ITEM_NAME_COL = 'c1';   // 품목명 컬럼 (확인 필요)
const VENDOR_NAME_COL = 'c2'; // 거래처명 컬럼 (확인 필요)
const ORDER_QTY_COL = 'c3';   // 주문수량 컬럼 (확인 필요)
const PROD_QTY_COL = 'c4';    // 생산수량 컬럼
const AMOUNT_COL = 'c5';      // 수주금액 컬럼
const DATE_COL = 'c6';        // 날짜 컬럼

// row의 날짜(DATE_COL)를 period 단위 그룹 라벨로 변환.
function getGroupKey(dateStr: string, period: PeriodUnit): string | null {
  const parts = dateStr.split('-');
  if (parts.length < 2) return null;
  const year = parts[0];
  const month = Number(parts[1]);

  if (period === 'yearly') return year;
  if (period === 'quarterly') return `${year} Q${Math.ceil(month / 3)}`;
  return `${year}-${String(month).padStart(2, '0')}`; // monthly
}

// rows를 (기간 x 품목) 또는 (기간 x 거래처)로 그룹핑해서
// 진행률(%) = 생산수량합 / 주문수량합 * 100 을 계산하고,
// recharts LineChart용으로 pivot한다.
// 결과 형태: [{ name: "2026", "프리미엄 삼베원단": 79, "헴프 부직포": 100 }, ...]
//
// TODO: 백엔드에 집계 API(getPerformanceTrend 등)가 생기면 이 함수는
// 삭제하고 API 응답을 그대로 trendByItem/trendByVendor에 매핑하는 방식으로
// 교체할 것. 현재는 프론트에서 rows 전체를 순회하는 임시 구현.
function buildTrendSeries(rows: any[], period: PeriodUnit, dimensionCol: string) {
  const acc: Record<string, { periodLabel: string; dim: string; orderQty: number; prodQty: number }> = {};

  rows.forEach((row) => {
    const dateStr = row[DATE_COL] || '';
    const periodLabel = getGroupKey(dateStr, period);
    const dim = row[dimensionCol] || '미지정';
    if (!periodLabel) return;

    const key = `${periodLabel}__${dim}`;
    if (!acc[key]) acc[key] = { periodLabel, dim, orderQty: 0, prodQty: 0 };
    acc[key].orderQty += Number(row[ORDER_QTY_COL] || 0);
    acc[key].prodQty += Number(row[PROD_QTY_COL] || 0);
  });

  const byPeriod: Record<string, Record<string, number>> = {};
  Object.values(acc).forEach(({ periodLabel, dim, orderQty, prodQty }) => {
    if (!byPeriod[periodLabel]) byPeriod[periodLabel] = {};
    byPeriod[periodLabel][dim] = orderQty > 0 ? Math.round((prodQty / orderQty) * 100) : 0;
  });

  // 기간(name) 오름차순 정렬. "2026 Q3"처럼 공백이 섞인 라벨도 문자열 정렬로 충분히 동작함.
  return Object.keys(byPeriod)
    .sort()
    .map((periodLabel) => ({ name: periodLabel, ...byPeriod[periodLabel] }));
}

// 두 번째 인자 trendPeriod 추가. 기본값 'yearly'라서
// 기존처럼 useOrderChartData(filteredRows) 한 개 인자로 호출해도 그대로 동작함.
export function useOrderChartData(rows: any[], trendPeriod: PeriodUnit = 'yearly') {
  // 월별/일별 단일 값 차트 데이터 집계 - 변경 없음 (컬럼 키만 상수로 교체)
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();

    const monthlyStats: Record<string, { month: string; amount: number; prod: number; count: number }> = {};
    for (let i = 1; i <= 12; i++) {
      const month = `${currentYear}-${String(i).padStart(2, '0')}`;
      monthlyStats[month] = { month, amount: 0, prod: 0, count: 0 };
    }

    const dailyStats: Record<string, { day: string; count: number }> = {};
    for (let i = 1; i <= 31; i++) {
      const key = String(i).padStart(2, '0');
      dailyStats[key] = { day: `${key}일`, count: 0 };
    }

    rows.forEach((row) => {
      const date = row[DATE_COL] || '';
      const parts = date.split('-');
      if (parts.length < 3) return;

      const month = `${parts[0]}-${parts[1]}`;
      const dayKey = String(parseInt(parts[2], 10)).padStart(2, '0');

      if (monthlyStats[month]) {
        monthlyStats[month].amount += Number(row[AMOUNT_COL] || 0);
        monthlyStats[month].prod += Number(row[PROD_QTY_COL] || 0);
        monthlyStats[month].count += 1;
      }
      if (dailyStats[dayKey]) {
        dailyStats[dayKey].count += 1;
      }
    });

    return {
      monthlyAmount: Object.values(monthlyStats).map((d) => ({ name: d.month, value: d.amount })) as ChartData[],
      monthlyProd: Object.values(monthlyStats).map((d) => ({ name: d.month, value: d.prod })) as ChartData[],
      monthlyCount: Object.values(monthlyStats).map((d) => ({ name: d.month, value: d.count })) as ChartData[],
      dailyCount: Object.values(dailyStats).map((d) => ({ name: d.day, value: d.count })) as ChartData[],
    };
  }, [rows]);

  // "기간별 추이" 카드용 데이터: 품목별 / 거래처별 진행률(%) 라인 시리즈.
  // trendPeriod가 바뀌면(월간<->분기<->연간) 자동으로 재계산됨.
  const trendData = useMemo(() => {
    return {
      trendByItem: buildTrendSeries(rows, trendPeriod, ITEM_NAME_COL),
      trendByVendor: buildTrendSeries(rows, trendPeriod, VENDOR_NAME_COL),
    };
  }, [rows, trendPeriod]);

  return { ...chartData, ...trendData };
}
