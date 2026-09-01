import { PieChart, Pie, Cell } from 'recharts'
import './ProgressRadialChart.css'

interface ProgressRadialChartProps {
  value?: number // 예: 76.4
  label?: string // 예: "진행률"
  size?: number // 차트 전체 크기 (가로/세로 동일)
  isDark?: boolean
}

export function ProgressRadialChart({
  value = 76.4,
  label = '진행률',
  size = 120,
  isDark = false,
}: ProgressRadialChartProps) {
  // 100을 기준으로 채워진 값과 남은 값으로 분할
  const safeValue = Math.min(Math.max(value, 0), 100)
  
  // 소수점 둘째 자리까지 제한 (문자열 반환)
  const formattedValue = safeValue.toFixed(2)

  const data = [
    { name: 'completed', value: safeValue },
    { name: 'remaining', value: 100 - safeValue },
  ]

  // 다크모드 여부에 따라 배경 및 남은 영역 색상 변경
  const COLORS = isDark ? ['#f59e0b', '#334155'] : ['#f59e0b', '#f1f5f9']

  // 다크모드 여부에 따른 중앙 텍스트 컬러 설정
  const valueColor = isDark ? '#f8fafc' : '#1e293b'
  const labelColor = isDark ? '#94a3b8' : '#64748b'

  // size에 비례해서 중앙 텍스트 폰트 크기도 함께 스케일 (작은 size에서 글자가 안 잘리도록 최소값 보장)
  // 소수점 2자리가 들어가면 글자가 길어질 수 있으므로 스케일 비율을 살짝 조정하거나 그대로 유지해도 무방합니다.
  const valueFontSize = Math.max(size * 0.15, 9)
  const labelFontSize = Math.max(size * 0.09, 8)

  // props에 따라 매번 달라지는 값(크기, 색상)만 CSS 변수로 전달한다.
  const rootStyle = {
    '--prc-size': `${size}px`,
    '--prc-value-color': valueColor,
    '--prc-label-color': labelColor,
    '--prc-value-font-size': `${valueFontSize}px`,
    '--prc-label-font-size': `${labelFontSize}px`,
  } as React.CSSProperties

  return (
    <div className="progressRadialChart" style={rootStyle}>
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
      <div className="progressRadialChart__labels">
        <span className="progressRadialChart__value">{formattedValue}%</span>
        <span className="progressRadialChart__label">{label}</span>
      </div>
    </div>
  )
}