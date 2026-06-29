import type { ReactNode } from 'react'
import { Badge } from '../components/Badge'
import { getStatusTone } from '../data/mesScreens'
import type { MesRow } from '../data/mesScreens'
import type { StatusTone } from '../types'

function cellTone(value: string): StatusTone | null {
  const tone = getStatusTone(value)
  return tone === 'muted' ? null : tone
}

const ACTION_VALUES = new Set(['수정/삭제', '상세', '처리', '등록/수정'])

export function buildTableRows(
  rows: MesRow[],
  columnCount: number,
  onDetail: (row: MesRow) => void,
  onDelete: (row: MesRow) => void,
): Array<Array<ReactNode>> {
  return rows.map((row) => {
    // 마지막 셀이 액션 텍스트면 데이터 셀에서 제외 (버튼으로 대체)
    const lastValue = row[`c${columnCount - 1}`] ?? ''
    const dataCount = ACTION_VALUES.has(lastValue) ? columnCount - 1 : columnCount

    return [
      ...Array.from({ length: dataCount }, (_, i) => {
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
    ]
  })
}
