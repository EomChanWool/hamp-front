import { useEffect, useState } from 'react'
import {
  SunIcon,
  BeakerIcon,
  CloudIcon,
  SparklesIcon,
} from '@heroicons/react/16/solid'
import type { StatusTone } from '../../types'

type KpiItem = {
  label: string
  value: string
  tone: StatusTone
}

type KpiIconMeta = {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  darkColor: string
}

const kpiIconMap: Record<string, KpiIconMeta> = {
  온도: { icon: SunIcon, color: '#EA580C', darkColor: '#FB923C' },
  습도: { icon: BeakerIcon, color: '#0284C7', darkColor: '#38BDF8' },
  CO2: { icon: CloudIcon, color: '#64748B', darkColor: '#94A3B8' },
  미세먼지: { icon: SparklesIcon, color: '#16A34A', darkColor: '#4ADE80' },
}

type Props = {
  kpis: KpiItem[]
  pulse?: number
}

export function KpiGrid({ kpis, pulse = 0 }: Props) {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return (
    <section className="metricGrid">
      {kpis.map((kpi, index) => {
        const meta = kpiIconMap[kpi.label]
        const iconColor = meta ? (isDark ? meta.darkColor : meta.color) : undefined
        return (
          <article
            key={kpi.label}
            className={`metricCard ${kpi.tone} ${pulse % 2 === 1 && index === 0 ? 'pulse' : ''}`}
          >
            {meta && (
              <div className="metricIcon">
                <meta.icon style={{ width: 18, height: 18, color: iconColor }} />
              </div>
            )}
            <div className="metricValue">
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
            </div>
          </article>
        )
      })}
    </section>
  )
}
