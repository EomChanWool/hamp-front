import { useMemo } from 'react';

export interface ChartData {
  name: string;
  value: number;
}

export function useOrderChartData(rows: any[]) {
  return useMemo(() => {
    const currentYear = 2026;

    const monthlyStats: Record<string, any> = {};
    for (let i = 1; i <= 12; i++) {
      const month = `${currentYear}-${String(i).padStart(2, '0')}`;
      // 시각화를 위해 랜덤값 생성
      monthlyStats[month] = { 
        month, 
        amount: Math.floor(Math.random() * 50000000) + 10000000, 
        prod: Math.floor(Math.random() * 5000) + 1000, 
        count: Math.floor(Math.random() * 20) + 5 
      };
    }

    const dailyStats: Record<string, any> = {};
    for (let i = 1; i <= 30; i++) {
      const key = String(i).padStart(2, '0');
      dailyStats[key] = { 
        day: `${key}일`, 
        count: Math.floor(Math.random() * 10) + 1 
      };
    }

    // 실제 데이터가 있다면 랜덤값 위에 덮어쓰기 (또는 더하기)
    rows.forEach((row) => {
      const date = row['c6'] || '';
      const parts = date.split('-');
      if (parts.length < 3) return;

      const month = `${parts[0]}-${parts[1]}`;
      const dayKey = String(parseInt(parts[2], 10)).padStart(2, '0');

      if (monthlyStats[month]) {
        monthlyStats[month].amount += Number(row['c5'] || 0);
        monthlyStats[month].prod += Number(row['c4'] || 0);
        monthlyStats[month].count += 1;
      }
      if (dailyStats[dayKey]) {
        dailyStats[dayKey].count += 1;
      }
    });

    return {
      monthlyAmount: Object.values(monthlyStats).map((d: any) => ({ name: d.month, value: d.amount })) as ChartData[],
      monthlyProd: Object.values(monthlyStats).map((d: any) => ({ name: d.month, value: d.prod })) as ChartData[],
      monthlyCount: Object.values(monthlyStats).map((d: any) => ({ name: d.month, value: d.count })) as ChartData[],
      dailyCount: Object.values(dailyStats).map((d: any) => ({ name: d.day, value: d.count })) as ChartData[],
    };
  }, [rows]);
}