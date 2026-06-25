import { useMemo, useState } from 'react'
import type { MesRow } from '../data/mesScreens'

export function useTableData(initialRows: MesRow[]) {
  const [rows, setRows] = useState<MesRow[]>(initialRows)
  const [keyword, setKeyword] = useState('')
  const [modalRow, setModalRow] = useState<MesRow | null>(null)

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(q))
  }, [rows, keyword])

  const handleDelete = (row: MesRow) => {
    if (window.confirm(`${row.c0} 항목을 삭제할까요?`)) {
      setRows((prev) => prev.filter((r) => r !== row))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setRows((prev) => prev.map((r) => (r === modalRow ? { ...r, ...updated } : r)))
    setModalRow(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  return {
    rows,
    setRows,
    keyword,
    setKeyword,
    modalRow,
    setModalRow,
    filteredRows,
    handleDelete,
    handleSave,
  }
}
