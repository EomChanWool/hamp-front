import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface DefectRow {
  defectNo: string
  occurredAt: string
  itemName: string
  lotNumber: string
  process: string
  defectType: '이물' | '중량미달' | '파손' | '색상불량'
  quantity: string
  status: '접수' | '원인분석중' | '조치완료' | '폐기'
}

const dummyDefects: DefectRow[] = [
  { defectNo: 'DF-F-5100', occurredAt: '2026-06-22 10:20', itemName: '헴프 오일', lotNumber: 'LOT-7000', process: '세척', defectType: '이물', quantity: '4 kg', status: '접수' },
  { defectNo: 'DF-F-5101', occurredAt: '2026-06-21 11:20', itemName: '헴프 분말', lotNumber: 'LOT-7001', process: '건조', defectType: '중량미달', quantity: '5 kg', status: '원인분석중' },
  { defectNo: 'DF-F-5102', occurredAt: '2026-06-20 12:20', itemName: '단백질 바', lotNumber: 'LOT-7002', process: '포장', defectType: '파손', quantity: '6 kg', status: '조치완료' },
  { defectNo: 'DF-F-5103', occurredAt: '2026-06-19 13:20', itemName: '헴프 음료', lotNumber: 'LOT-7003', process: '압축', defectType: '색상불량', quantity: '7 kg', status: '폐기' },
  { defectNo: 'DF-F-5104', occurredAt: '2026-06-18 14:20', itemName: '씨드 그래놀라', lotNumber: 'LOT-7004', process: '세척', defectType: '이물', quantity: '8 kg', status: '접수' },
  { defectNo: 'DF-F-5105', occurredAt: '2026-06-17 15:20', itemName: '헴프 캡슐', lotNumber: 'LOT-7005', process: '건조', defectType: '중량미달', quantity: '9 kg', status: '원인분석중' },
]

const DEFECT_TYPE_COLORS: Record<string, string> = {
  이물: '#10b981',
  중량미달: '#ef4444',
  파손: '#ff8c3a',
  색상불량: '#8b5cf6',
  포장불량: '#eab308',
  기타: '#64748b',
}

const DEFECT_STATUS_COLORS: Record<string, string> = {
  접수: '#818cf8',
  원인분석중: '#e879f9',
  조치완료: '#22d3ee',
  폐기: '#94a3b8',
}

const PAGE_SIZE = 10

export function FoodDefectManagePage() {
  const [filteredDefects, setFilteredDefects] = useState<DefectRow[]>(dummyDefects)
  const [modalDefect, setModalDefect] = useState<DefectRow | null>(null)
  const [page, setPage] = useState(0)

  const occurredStartRef = useRef<HTMLInputElement>(null)
  const occurredEndRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '발생', startRef: occurredStartRef, endRef: occurredEndRef },
    { type: 'input', label: '품목명', ref: itemNameRef },
    { type: 'input', label: '처리상태', ref: statusRef },
  ]

  const handleSearch = () => {
    const occurredStart = occurredStartRef.current?.value ?? ''
    const occurredEnd = occurredEndRef.current?.value ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미불량에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredDefects(
      dummyDefects.filter(
        (defect) =>
          (!occurredStart || defect.occurredAt.slice(0, 10) >= occurredStart) &&
          (!occurredEnd || defect.occurredAt.slice(0, 10) <= occurredEnd) &&
          (!itemName || defect.itemName.includes(itemName)) &&
          (!status || defect.status.includes(status)),
      ),
    )
  }

  const handleReset = () => {
    ;[occurredStartRef, occurredEndRef, itemNameRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredDefects(dummyDefects)
  }

  const handleDelete = (defect: DefectRow) => {
    if (window.confirm(`${defect.defectNo} 불량건을 삭제할까요?`)) {
      setFilteredDefects((prev) => prev.filter((d) => d !== defect))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredDefects((prev) => prev.map((d) => (d === modalDefect ? ({ ...d, ...updated } as DefectRow) : d)))
    setModalDefect(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredDefects])

  const totalPages = Math.max(1, Math.ceil(filteredDefects.length / PAGE_SIZE))
  const pagedDefects = filteredDefects.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<DefectRow>[] = useMemo(
    () => [
      { accessorKey: 'defectNo', header: '불량번호' },
      { accessorKey: 'occurredAt', header: '발생일시' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'lotNumber', header: 'LOT번호' },
      { accessorKey: 'process', header: '공정' },
      {
        accessorKey: 'defectType',
        header: '불량유형',
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <span style={{ color: DEFECT_TYPE_COLORS[value], fontWeight: 600 }}>{value}</span>
        },
      },
      { accessorKey: 'quantity', header: '수량' },
      {
        accessorKey: 'status',
        header: '처리상태',
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <span style={{ color: DEFECT_STATUS_COLORS[value], fontWeight: 600 }}>{value}</span>
        },
      },
      {
        id: 'actions',
        header: '관리',
        meta: { width: '150px' },
        cell: ({ row }) => (
          <div className="rowActions">
            <button
              type="button"
              className="miniButton"
              onClick={(e) => {
                e.stopPropagation()
                setModalDefect(row.original)
              }}
            >
              상세
            </button>
            <button
              type="button"
              className="miniButton danger"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(row.original)
              }}
            >
              삭제
            </button>
          </div>
        ),
      },
    ],
    [],
  )

  const detailFields = [
    { label: '불량번호', key: 'defectNo' },
    { label: '발생일시', key: 'occurredAt' },
    { label: '품목명', key: 'itemName' },
    { label: 'LOT번호', key: 'lotNumber' },
    { label: '공정', key: 'process' },
    { label: '불량유형', key: 'defectType' },
    { label: '수량', key: 'quantity' },
    { label: '처리상태', key: 'status' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="식품 불량관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedDefects} columns={columns} onRowClick={setModalDefect} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredDefects.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalDefect !== null}
        onClose={() => setModalDefect(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalDefect ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
