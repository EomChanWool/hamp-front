import type { FiberShippableLotResponse } from '@/api/ioInpi/FiberShipment'
import { fmtKg } from '@/utils/fiberWorkOrder'
import { isPickInvalid, type LotPicks } from '@/utils/fiberShipment'

interface Props {
  lots: FiberShippableLotResponse[]
  picks: LotPicks
  onChange: (next: LotPicks) => void
  loading?: boolean
  disabled?: boolean
}

/**
 * 출고지시서에 실을 제품 LOT 선택 표 (등록 / 상세 수정 공용)
 * - 체크하면 남은 양 전부가 채워지고, 일부만 보낼 때는 kg을 줄인다
 * - 남은 양 = 생산량 - 다른 지시서(대기·스캔·출고)에 잡힌 양 (서버 계산)
 */
export function FiberShipmentLotPicker({ lots, picks, onChange, loading, disabled }: Props) {
  const rows = lots.filter((l) => l.remainingQty > 0 || l.perfId in picks)
  const allOn = rows.length > 0 && rows.every((l) => l.perfId in picks)

  const toggle = (lot: FiberShippableLotResponse, checked: boolean) => {
    const next = { ...picks }
    if (checked) next[lot.perfId] = String(lot.remainingQty)
    else delete next[lot.perfId]
    onChange(next)
  }

  const toggleAll = (checked: boolean) => {
    if (!checked) return onChange({})
    const next: LotPicks = { ...picks }
    rows.forEach((l) => {
      if (!(l.perfId in next)) next[l.perfId] = String(l.remainingQty)
    })
    onChange(next)
  }

  const setQty = (perfId: number, value: string) => onChange({ ...picks, [perfId]: value })

  return (
    <div className="fwo-tableWrap">
      <table className="fwo-table fsh-lotTable">
        <thead>
          <tr>
            <th style={{ width: 44 }}>
              <input
                type="checkbox"
                className="fsh-check"
                aria-label="전체 선택"
                checked={allOn}
                disabled={disabled || rows.length === 0}
                onChange={(e) => toggleAll(e.target.checked)}
              />
            </th>
            <th>제품 LOT · 작업일</th>
            <th>제품</th>
            <th className="is-num">생산량</th>
            <th className="is-num">다른 지시서</th>
            <th className="is-num">남은 양</th>
            <th className="is-num">이번 출고 (kg)</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="fwo-empty">제품 LOT을 불러오는 중...</td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="fwo-empty">
                출고할 양이 남은 제품 LOT이 없습니다. 이 수주는 전부 출고됐거나 다른 지시서에 잡혀 있습니다.
              </td>
            </tr>
          ) : (
            rows.map((lot) => {
              const on = lot.perfId in picks
              const value = picks[lot.perfId] ?? ''
              const invalid = on && isPickInvalid(lot, value)
              const partial = on && !invalid && Number(value) < lot.outputQty
              return (
                <tr key={lot.perfId} className={on ? 'fsh-on' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      className="fsh-check"
                      aria-label={`${lot.productLotCode} 선택`}
                      checked={on}
                      disabled={disabled}
                      onChange={(e) => toggle(lot, e.target.checked)}
                    />
                  </td>
                  <td>
                    <span className="fwo-code">{lot.productLotCode}</span>
                    <span className="fwo-sub">{lot.workDate || '-'}</span>
                  </td>
                  <td>{lot.productItemNm || lot.productItemCode}</td>
                  <td className="is-num">{fmtKg(lot.outputQty)} kg</td>
                  <td className="is-num">{lot.reservedQty ? `${fmtKg(lot.reservedQty)} kg` : '-'}</td>
                  <td className="is-num">
                    <b>{fmtKg(lot.remainingQty)} kg</b>
                  </td>
                  <td className="is-num">
                    <input
                      type="number"
                      className="fsh-qty"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      aria-label={`${lot.productLotCode} 출고 중량`}
                      aria-invalid={invalid || undefined}
                      value={on ? value : ''}
                      disabled={!on || disabled}
                      onChange={(e) => setQty(lot.perfId, e.target.value)}
                    />
                    {partial && <span className="fsh-partial">일부</span>}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
