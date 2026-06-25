import type { ReactNode } from 'react'
import { Badge } from '../components/Badge'
import { getStatusTone } from '../data/mesScreens'
import type { MesRow } from '../data/mesScreens'
import type { StatusTone } from '../types'

function cellTone(value: string): StatusTone | null {
  const tone = getStatusTone(value)
  return tone === 'muted' ? null : tone
}

export function buildTableRows(
  rows: MesRow[],
  columnCount: number,
  onDetail: (row: MesRow) => void,
  onDelete: (row: MesRow) => void,
): Array<Array<ReactNode>> {
  return rows.map((row) => [
    ...Array.from({ length: columnCount }, (_, i) => {
      const value = row[`c${i}`] ?? ''
      const tone = cellTone(value)
      return tone ? <Badge tone={tone}>{value}</Badge> : value
    }),
    <div className="rowActions">
      <button
        type="button"
        className="miniButton"
        onClick={(e) => {
          e.stopPropagation()
          onDetail(row)
        }}
      >
        상세
      </button>
      <button
        type="button"
        className="miniButton danger"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(row)
        }}
      >
        삭제
      </button>
    </div>,
  ])
}
