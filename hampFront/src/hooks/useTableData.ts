import { useMemo, useState } from 'react'
import type { MesRow } from '@/data/mesScreens'

/**
 * 목록 화면 하나에 필요한 검색/삭제/수정 상태를 묶어서 재사용하는 훅.
 * 백엔드 연동 전이라 실제 API 호출 없이 로컬 useState로만 동작한다 (새로고침하면 초기화됨).
 */
export function useTableData(initialRows: MesRow[]) {
  const [rows, setRows] = useState<MesRow[]>(initialRows) // 원본 행 데이터 (삭제/수정이 반영되는 대상)
  const [keyword, setKeyword] = useState('') // SearchBand의 조회 결과로 채워지는 검색어
  const [modalRow, setModalRow] = useState<MesRow | null>(null) // 상세보기 모달에 띄울 행 (null이면 모달 닫힘)

  // keyword로 걸러진 행 목록 — 모든 컬럼 값을 합친 문자열에 keyword가 포함되는지로 판단
  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(q))
  }, [rows, keyword])

  // '삭제' 클릭 시 확인창을 띄우고, 확인하면 rows에서 제거 (화면 상태에서만 삭제됨)
  const handleDelete = (row: MesRow) => {
    if (window.confirm(`${row.c0} 항목을 삭제할까요?`)) {
      setRows((prev) => prev.filter((r) => r !== row))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  // 상세 모달의 '저장' 클릭 시 modalRow와 같은 행을 찾아 수정된 값으로 덮어씀
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
