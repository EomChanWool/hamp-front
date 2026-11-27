import type { ComponentProps } from 'react'
import type { Badge } from '@/components/common/Badge'
import type { FiberShipmentLineRequest, FiberShippableLotResponse } from '@/api/ioInpi/FiberShipment'
import { fmtKg } from '@/utils/fiberWorkOrder'

// ── 상태 ─────────────────────────────────────────────────────────────────────

export type BadgeTone = ComponentProps<typeof Badge>['tone']

/** 출고지시서 상태 라벨 */
export const FIBER_SHIP_STATUS_LABEL: Record<string, string> = {
  WAITING: '출고 대기',
  SCANNED: '스캔됨',
  SHIPPED: '출고 완료',
  CANCELLED: '취소',
}

/** 출고지시서 상태 배지 색 */
export const FIBER_SHIP_STATUS_TONE: Record<string, BadgeTone> = {
  WAITING: 'muted',
  SCANNED: 'info',
  SHIPPED: 'good',
  CANCELLED: 'danger',
}

/** 탭/검색용 상태 옵션 */
export const FIBER_SHIP_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: '출고 대기', value: 'WAITING' },
  { label: '스캔됨', value: 'SCANNED' },
  { label: '출고 완료', value: 'SHIPPED' },
  { label: '취소', value: 'CANCELLED' },
]

// ── 상태별 가능 동작 (서버도 같은 규칙으로 막지만 버튼 노출용) ─────────────────

/** 수정: 현장 스캔 전(대기)만 */
export const canEditShip = (status: string) => status === 'WAITING'
/** 삭제: 대기만 (재고 변동 없음) */
export const canDeleteShip = (status: string) => status === 'WAITING'
/** 지시서 취소: 대기만 (잡혀 있던 LOT 양이 풀림) */
export const canCancelShip = (status: string) => status === 'WAITING'
/** 출고 확인 / 스캔 취소: 스캔됨만 */
export const canConfirmShip = (status: string) => status === 'SCANNED'
export const canRevertScan = (status: string) => status === 'SCANNED'
/** 출고 취소: 출고 완료만 (재고 되돌림) */
export const canRevertShip = (status: string) => status === 'SHIPPED'
/** 지시서 출력: 취소 제외 */
export const canPrintShip = (status: string) => status !== 'CANCELLED'

// ── LOT 선택 (perfId → 입력 중인 kg 문자열) ──────────────────────────────────

export type LotPicks = Record<number, string>

export const round2 = (n: number) => Math.round(n * 100) / 100

/** 선택한 LOT 출고 중량 합계 */
export const sumPicks = (picks: LotPicks) =>
  round2(Object.values(picks).reduce((sum, v) => sum + (Number(v) > 0 ? Number(v) : 0), 0))

/** 요청 body용 라인 */
export const buildShipLines = (picks: LotPicks): FiberShipmentLineRequest[] =>
  Object.entries(picks).map(([perfId, qty]) => ({ perfId: Number(perfId), shipQty: Number(qty) }))

/** 한 LOT 입력값이 잘못됐는지 (0 이하 / 남은 양 초과) */
export const isPickInvalid = (lot: FiberShippableLotResponse, value: string | undefined) => {
  const q = Number(value)
  return !(q > 0) || q > lot.remainingQty + 1e-9
}

/** 저장 전 라인 검증 - 문제 있으면 안내 문구, 없으면 null */
export function validateShipLines(lots: FiberShippableLotResponse[], picks: LotPicks): string | null {
  const ids = Object.keys(picks).map(Number)
  if (ids.length === 0) return '출고할 제품 LOT을 1개 이상 선택해 주세요.'
  for (const id of ids) {
    const lot = lots.find((l) => l.perfId === id)
    const q = Number(picks[id])
    const code = lot?.productLotCode ?? `실적 #${id}`
    if (!(q > 0)) return `${code}: 출고 중량은 0보다 커야 합니다.`
    if (lot && q > lot.remainingQty + 1e-9) {
      return `${code}: 더 출고할 수 있는 중량(${fmtKg(lot.remainingQty)} kg)을 넘었습니다. 입력 ${fmtKg(q)} kg`
    }
  }
  return null
}

/** 제품별 합계 (요약 패널용) */
export function sumByProduct(items: { name: string; qty: number }[]) {
  const map = new Map<string, number>()
  items.forEach(({ name, qty }) => map.set(name, round2((map.get(name) ?? 0) + (qty > 0 ? qty : 0))))
  return [...map].map(([name, qty]) => ({ name, qty }))
}
