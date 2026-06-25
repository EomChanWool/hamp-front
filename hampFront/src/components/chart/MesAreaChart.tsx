import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Panel } from '../Panel'
import type { StatusTone } from '../../types'

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

const COLORS = ['#38bdf8', '#57d3a1', '#f59e0b', '#a78bfa', '#f472b6']
const HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

export function MesAreaChart({ title, items, pulse = 0 }: Props) {
  const data = HOURS.map((hour, hi) => {
    const entry: Record<string, string | number> = { time: hour }
    items.forEach((item, ii) => {
      entry[item.label] = Math.min(
        100,
        Math.max(
          10,
          item.value * Math.sin((hi + ii + pulse * 0.3) * 0.6 + ii) * 0.4 + item.value * 0.6,
        ),
      )
    })
    return entry
  })

  return (
    <Panel title={title}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {items.map((item, i) => (
              <linearGradient key={item.label} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--text-body)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
            formatter={(value) => [`${Math.round(Number(value))}%`]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
          {items.map((item, i) => (
            <Area
              key={item.label}
              type="monotone"
              dataKey={item.label}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2.5}
              fill={`url(#grad-${i})`}
              dot={false}
              activeDot={{
                r: 5,
                fill: COLORS[i % COLORS.length],
                stroke: '#fff',
                strokeWidth: 2,
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  )
}
