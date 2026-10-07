import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Panel } from '@components/card/Panel'
import type { StatusTone } from '@/types'

type ChartItem = {
  label: string
  value: number
  tone?: StatusTone
}

type Props = {
  title: string
  items: ChartItem[]
  pulse?: number
}

/** 대시보드 Primary(민트) 기준의 저채도 팔레트. 라이트/다크 모두 읽히는 중간 명도 */
const COLORS = ['#4fb98f', '#5f8fbf', '#d6a85c', '#9a86c4', '#cc7f8f', '#8c9aab']

/** 2시간 간격. 1시간 간격이 필요하면 '09:00', '11:00' ... 을 추가 */
const HOURS = ['08:00', '10:00', '12:00', '14:00', '16:00']

/** 항목별 값을 시간대별 세로 그룹 막대로 보여주는 공용 차트 컴포넌트 (대시보드/모니터링 화면에서 사용) */
export function MesAreaChart({ title, items, pulse = 0 }: Props) {
  const data = HOURS.map((hour, hi) => {
    const entry: Record<string, string | number> = { time: hour }
    items.forEach((item, ii) => {
      entry[item.label] = Math.round(
        Math.min(
          100,
          Math.max(
            10,
            item.value * Math.sin((hi * 2 + ii + pulse * 0.3) * 0.6 + ii) * 0.4 + item.value * 0.6,
          ),
        ),
      )
    })
    return entry
  })

  return (
    <Panel title={title}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          barCategoryGap="22%"
          barGap={3}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--text-body)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
            formatter={(value, name) => [`${value}%`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
          {items.map((item, i) => (
            <Bar
              key={item.label}
              dataKey={item.label}
              fill={COLORS[i % COLORS.length]}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}