import type { ReactNode } from 'react'
import type { StatusTone } from '@/types'

type BadgeProps = {
  tone: StatusTone
  children: ReactNode
}

/** 상태(tone: good/warn/danger 등)에 따라 색이 바뀌는 작은 라벨 뱃지 */
export function Badge({ tone, children }: BadgeProps) {
  return <span className={`badge ${tone}`}>{children}</span>
}
