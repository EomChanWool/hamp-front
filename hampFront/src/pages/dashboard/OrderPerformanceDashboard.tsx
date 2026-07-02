import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export function OrderPerformanceDashboard({ data }: { data: any }) {
  const charts = [
    { key: 'monthlyAmount', title: '월별 수주금액', fill: '#8884d8', type: 'month' },
    { key: 'monthlyProd', title: '월별 생산예정량', fill: '#82ca9d', type: 'month' },
    { key: 'monthlyCount', title: '월별 수주건수', fill: '#ffc658', type: 'month' },
    { key: 'dailyCount', title: '일별 수주건수', fill: '#ff8042', type: 'day' }, 
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', marginBottom: '30px' }}>
      {charts.map((c) => (
        <div key={c.key} style={{ border: '1px solid #ddd', padding: '40px', borderRadius: '10px', background: '#fff' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>{c.title}</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart 
              data={data[c.key]}
              margin={{ top: 10, right: 30, left: c.key === 'monthlyAmount' ? 30 : 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 9 }}
                interval={c.type === 'month' ? 0 : 2} 
              />
              
              <YAxis 
                width={c.key === 'monthlyAmount' ? 70 : 50}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => 
                  c.key === 'monthlyAmount' 
                    ? `${(value / 10000).toLocaleString()}만원` 
                    : value.toLocaleString()
                }
              />
              <Tooltip 
                formatter={(value: any) => {
                  const num = Number(value);
                  const formattedValue = c.key === 'monthlyAmount' 
                    ? `${(num / 10000).toLocaleString()}만원` 
                    : num.toLocaleString();
                  const label = c.key === 'monthlyAmount' ? '금액' : '수량/건수';
                  return [formattedValue, label];
                }} 
              />
              <Bar dataKey="value" fill={c.fill} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
