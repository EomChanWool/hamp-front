import { useEffect, useState } from 'react'
import {
  SunIcon,
  BeakerIcon,
  CloudIcon,
  SparklesIcon,
} from '@heroicons/react/16/solid'
import type { StatusTone } from '@/types'

type KpiItem = {
  label: string
  value: React.ReactNode;
  tone: StatusTone

  // 기본 "아이콘 + label/value" 레이아웃 대신 카드 내부를 완전히 커스텀으로 그리고 싶을 때 사용.
  render?: (isDark: boolean) => React.ReactNode
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
  onCardClick?: (kpi: KpiItem) => void
  selectedLabel?: string
}

/** KPI 지표 카드들을 그리드로 보여주는 컴포넌트. 다크모드 전환에 맞춰 아이콘 색상도 함께 바뀜 */
export function KpiGrid({ kpis, pulse = 0, onCardClick, selectedLabel }: Props) {
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
        // render가 지정된 카드는 기본 아이콘/label/value 레이아웃을 쓰지 않으므로 meta 조회 및 아래 기본 렌더링 분기를 건너뛴다.
        const meta = kpi.render ? undefined : kpiIconMap[kpi.label]
        const iconColor = meta ? (isDark ? meta.darkColor : meta.color) : undefined

        // 이 페이지에서 클릭 기능을 썼는지 여부 판단
        const isClickable = !!onCardClick;
        // 현재 카드가 선택된 카드인지 판단
        const isSelected = selectedLabel === kpi.label;

        return (
          <article
            key={kpi.label}
            onClick={() => onCardClick?.(kpi)}
            className={`metricCard ${kpi.tone} ${pulse % 2 === 1 && index === 0 ? 'pulse' : ''} ${isSelected ? 'is-selected' : ''}`}
            style={{
              cursor: isClickable ? 'pointer' : 'default', // 클릭 가능한 페이지에서만 포인터 커서 적용
            }}
          >
            {kpi.render ? (
              // 커스텀 렌더 카드 (예: 도넛 차트형 KPI)
              kpi.render(isDark)
            ) : (
              <>
                {meta && (
                  <div className="metricIcon">
                    <meta.icon style={{ width: 18, height: 18, color: iconColor }} />
                  </div>
                )}
                <div className="metricValue">
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                </div>
              </>
            )}
          </article>
        )
      })}
    </section>
  )
}

export type { KpiItem }