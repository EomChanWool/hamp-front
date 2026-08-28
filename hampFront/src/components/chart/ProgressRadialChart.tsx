import { PieChart, Pie, Cell } from 'recharts'

interface ProgressRadialChartProps {
  value?: number // 예: 76.4
  label?: string // 예: "진행률"
  size?: number  // 차트 전체 크기 (가로/세로 동일)
  isDark?: boolean
}

export function ProgressRadialChart({ 
  value = 76.4, 
  label = '진행률', 
  size = 120, 
  isDark = false 
}: ProgressRadialChartProps) {
  // 100을 기준으로 채워진 값과 남은 값으로 분할
  const safeValue = Math.min(Math.max(value, 0), 100)
  const data = [
    { name: 'completed', value: safeValue },
    { name: 'remaining', value: 100 - safeValue },
  ]

  // 다크모드 여부에 따라 배경 및 남은 영역 색상 변경 (인덱스 1번이 remaining)
  const COLORS = isDark ? ['#f59e0b', '#334155'] : ['#f59e0b', '#f1f5f9']
  
  // 다크모드 여부에 따른 중앙 텍스트 컬러 설정
  const valueColor = isDark ? '#f8fafc' : '#1e293b'
  const labelColor = isDark ? '#94a3b8' : '#64748b'

  return (
    <div style={{ 
      width: `${size}px`, 
      height: `${size}px`, 
      position: 'relative', 
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* ResponsiveContainer를 제거하고 PieChart에 직접 width, height 지정 */}
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={size * 0.38} // 크기에 맞춰 비율로 도넛 두께 조절
          outerRadius={size * 0.48} // 크기에 맞춰 비율로 바깥 반지름 조절
          startAngle={90}
          endAngle={-270}
          dataKey="value"
          stroke="none"
          cornerRadius={6}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>

      {/* 도넛 중앙에 텍스트 고정 배치 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: valueColor, lineHeight: 1.2 }}>
          {safeValue}%
        </span>
        <span style={{ fontSize: '11px', fontWeight: 500, color: labelColor, marginTop: '1px' }}>
          {label}
        </span>
      </div>
    </div>
  )
}