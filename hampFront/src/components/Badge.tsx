import type { ReactNode } from 'react'
import type { StatusTone } from '../types'

type BadgeProps = {
  tone: StatusTone
  children: ReactNode
}

export function Badge({ tone, children }: BadgeProps) {
  return <span className={`badge ${tone}`}>{children}</span>
}
