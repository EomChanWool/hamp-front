import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface RepairRow {
  repairDate: string
  equipmentName: string
  failureContent: string
  action: string
  manager: string
  cost: string
  completeStatus: '완료' | '진행중'
}

const dummyRepairs: RepairRow[] = [
  { repairDate: '2026-06-12', equipmentName: '추출기-01', failureContent: '벨트 마모', action: '부품교체', manager: '김민준', cost: '30만원', completeStatus: '완료' },
  { repairDate: '2026-06-13', equipmentName: '건조기-02', failureContent: '센서 불량', action: '캘리브레이션', manager: '이서연', cost: '42만원', completeStatus: '진행중' },
  { repairDate: '2026-06-14', equipmentName: '세척기-03', failureContent: '모터 과열', action: '윤활작업', manager: '박지훈', cost: '54만원', completeStatus: '완료' },
  { repairDate: '2026-06-15', equipmentName: '분쇄기-01', failureContent: '벨트 마모', action: '부품교체', manager: '최유진', cost: '66만원', completeStatus: '완료' },
  { repairDate: '2026-06-16', equipmentName: '포장기-04', failureContent: '센서 불량', action: '캘리브레이션', manager: '정도윤', cost: '78만원', completeStatus: '완료' },
  { repairDate: '2026-06-17', equipmentName: '압축기-02', failureContent: '모터 과열', action: '윤활작업', manager: '한수아', cost: '90만원', completeStatus: '완료' },
]

const STATUS_TONE: Record<RepairRow['completeStatus'], 'good' | 'warn'> = {
  완료: 'good',
  진행중: 'warn',
}

const ACTION_COLORS: Record<string, string> = {
  부품교체: '#38bdf8',
  캘리브레이션: '#c084fc',
  윤활작업: '#fb923c',
}

const PAGE_SIZE = 10

export function EquipmentRepairHistoryPage() {
  const [filteredRepairs, setFilteredRepairs] = useState<RepairRow[]>(dummyRepairs)
  const [modalRepair, setModalRepair] = useState<RepairRow | null>(null)
  const [page, setPage] = useState(0)

  const repairStartRef = useRef<HTMLInputElement>(null)
  const repairEndRef = useRef<HTMLInputElement>(null)
  const equipmentNameRef = useRef<HTMLInputElement>(null)
  const completeStatusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '수리', startRef: repairStartRef, endRef: repairEndRef },
    { type: 'input', label: '설비명', ref: equipmentNameRef },
    { type: 'input', label: '완료상태', ref: completeStatusRef },
  ]

  const handleSearch = () => {
    const repairStart = repairStartRef.current?.value.trim() ?? ''
    const repairEnd = repairEndRef.current?.value.trim() ?? ''
    const equipmentName = equipmentNameRef.current?.value.trim() ?? ''
    const completeStatus = completeStatusRef.current?.value.trim() ?? ''

    // 현재는 더미수리이력에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredRepairs(
      dummyRepairs.filter(
        (repair) =>
          (!repairStart || repair.repairDate >= repairStart) &&
          (!repairEnd || repair.repairDate <= repairEnd) &&
          (!equipmentName || repair.equipmentName.includes(equipmentName)) &&
          (!completeStatus || repair.completeStatus.includes(completeStatus)),
      ),
    )
  }

  const handleReset = () => {
    ;[repairStartRef, repairEndRef, equipmentNameRef, completeStatusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredRepairs(dummyRepairs)
  }

  const handleDelete = (repair: RepairRow) => {
    if (window.confirm(`${repair.equipmentName} 수리이력을 삭제할까요?`)) {
      setFilteredRepairs((prev) => prev.filter((r) => r !== repair))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredRepairs((prev) => prev.map((r) => (r === modalRepair ? ({ ...r, ...updated } as RepairRow) : r)))
    setModalRepair(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredRepairs])

  const totalPages = Math.max(1, Math.ceil(filteredRepairs.length / PAGE_SIZE))
  const pagedRepairs = filteredRepairs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<RepairRow>[] = useMemo(
    () => [
      { accessorKey: 'repairDate', header: '수리일자' },
      { accessorKey: 'equipmentName', header: '설비명' },
      { accessorKey: 'failureContent', header: '고장내용' },
      {
        accessorKey: 'action',
        header: '조치내용',
        cell: ({ getValue }) => {
          const value = getValue() as string
          const color = ACTION_COLORS[value]
          return color ? <span style={{ color, fontWeight: 600 }}>{value}</span> : value
        },
      },
      { accessorKey: 'manager', header: '수리담당자' },
      { accessorKey: 'cost', header: '비용' },
      {
        accessorKey: 'completeStatus',
        header: '완료상태',
        cell: ({ getValue }) => {
          const value = getValue() as RepairRow['completeStatus']
          return <Badge tone={STATUS_TONE[value]}>{value}</Badge>
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
                setModalRepair(row.original)
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
    { label: '수리일자', key: 'repairDate' },
    { label: '설비명', key: 'equipmentName' },
    { label: '고장내용', key: 'failureContent' },
    { label: '조치내용', key: 'action' },
    { label: '수리담당자', key: 'manager' },
    { label: '비용', key: 'cost' },
    { label: '완료상태', key: 'completeStatus' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="수리이력관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedRepairs} columns={columns} onRowClick={setModalRepair} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredRepairs.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalRepair !== null}
        onClose={() => setModalRepair(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalRepair ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
