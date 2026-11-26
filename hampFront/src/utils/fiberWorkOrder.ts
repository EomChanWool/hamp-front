import axios from 'axios'
import type { StatusTone } from '@/types'

/** 섬유 작업지시 상태 옵션 (탭/검색 공용) */
export const FIBER_WO_STATUS_OPTIONS = [
  { label: '대기', value: 'WAITING' },
  { label: '작업 중', value: 'IN_PROGRESS' },
  { label: '완료', value: 'COMPLETED' },
  { label: '취소', value: 'CANCELLED' },
] as const

export const FIBER_WO_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  FIBER_WO_STATUS_OPTIONS.map((o) => [o.value, o.label]),
)

export const FIBER_WO_STATUS_TONE: Record<string, StatusTone> = {
  WAITING: 'muted',
  IN_PROGRESS: 'warn',
  COMPLETED: 'good',
  CANCELLED: 'danger',
}

/** 수주가 이미 끝났거나 취소된 상태 - 작업지시 등록 대상에서 제외 (수주 상태 코드에 맞게 조정) */
export const CLOSED_ORDER_STATUSES = ['COMPLETED', 'CANCELLED']

/** 진행률(%) = 실제 투입 ÷ 기준량 × 100, 계획보다 많이 투입하면 100% 초과도 그대로 표시 */
export const calcPct = (input: number | null | undefined, total: number | null | undefined) =>
  total ? Math.round((Number(input ?? 0) / Number(total)) * 1000) / 10 : 0

export const fmtKg = (n: number | null | undefined) =>
  n == null ? '-' : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 })

/** 상태별 가능한 작업 (화면에서 구분할 조건) */
export const canEditWo = (status: string) => status === 'WAITING' || status === 'IN_PROGRESS'
export const canDeleteWo = (status: string) => status === 'WAITING'
export const canRevertStartWo = (status: string, performanceCount: number) =>
  status === 'IN_PROGRESS' && performanceCount === 0
export const canCancelWo = (status: string, performanceCount: number) =>
  (status === 'WAITING' || status === 'IN_PROGRESS') && performanceCount === 0
export const canReopenWo = (status: string) => status === 'COMPLETED'

export function getErrorMessage(error: unknown, fallback: string) {
  const message = axios.isAxiosError(error) ? error.response?.data?.message : null
  return typeof message === 'string' && message ? message : fallback
}
