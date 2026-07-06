import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface OperationHistoryRow {
  equipmentName: string
  startedAt: string
  endedAt: string
  duration: string
  status: '정상종료' | '점검종료' | '비상정지'
  workOrderNo: string
  manager: string
}

const dummyOperationHistory: OperationHistoryRow[] = [
  { equipmentName: '추출기-01', startedAt: '2026-06-22 07:20', endedAt: '2026-06-22 15:20', duration: '6h', status: '정상종료', workOrderNo: 'WO-3000', manager: '김민준' },
  { equipmentName: '건조기-02', startedAt: '2026-06-21 08:20', endedAt: '2026-06-21 16:20', duration: '7h', status: '점검종료', workOrderNo: 'WO-3001', manager: '이서연' },
  { equipmentName: '세척기-03', startedAt: '2026-06-20 09:20', endedAt: '2026-06-20 17:20', duration: '8h', status: '비상정지', workOrderNo: 'WO-3002', manager: '박지훈' },
  { equipmentName: '분쇄기-01', startedAt: '2026-06-19 10:20', endedAt: '2026-06-19 18:20', duration: '9h', status: '정상종료', workOrderNo: 'WO-3003', manager: '최유진' },
  { equipmentName: '포장기-04', startedAt: '2026-06-18 11:20', endedAt: '2026-06-18 19:20', duration: '10h', status: '점검종료', workOrderNo: 'WO-3004', manager: '정도윤' },
  { equipmentName: '압축기-02', startedAt: '2026-06-17 12:20', endedAt: '2026-06-17 20:20', duration: '11h', status: '비상정지', workOrderNo: 'WO-3005', manager: '한수아' },
]

const STATUS_TONE: Record<OperationHistoryRow['status'], 'good' | 'warn' | 'muted'> = {
  정상종료: 'good',
  점검종료: 'warn',
  비상정지: 'muted',
}

const PAGE_SIZE = 10

export function EquipmentOperationHistoryPage() {
  const [filteredHistory, setFilteredHistory] = useState<OperationHistoryRow[]>(dummyOperationHistory)
  const [modalHistory, setModalHistory] = useState<OperationHistoryRow | null>(null)
  const [page, setPage] = useState(0)

  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const equipmentNameRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '기간', startRef: startDateRef, endRef: endDateRef },
    { type: 'input', label: '설비명', ref: equipmentNameRef },
    { type: 'input', label: '상태', ref: statusRef },
  ]

  const handleSearch = () => {
    const start = startDateRef.current?.value.trim() ?? ''
    const end = endDateRef.current?.value.trim() ?? ''
    const equipmentName = equipmentNameRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미가동이력에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredHistory(
      dummyOperationHistory.filter((history) => {
        const startedDate = history.startedAt.slice(0, 10)
        return (
          (!start || startedDate >= start) &&
          (!end || startedDate <= end) &&
          (!equipmentName || history.equipmentName.includes(equipmentName)) &&
          (!status || history.status.includes(status))
        )
      }),
    )
  }

  const handleReset = () => {
    ;[startDateRef, endDateRef, equipmentNameRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredHistory(dummyOperationHistory)
  }

  const handleDelete = (history: OperationHistoryRow) => {
    if (window.confirm(`${history.equipmentName} 가동이력을 삭제할까요?`)) {
      setFilteredHistory((prev) => prev.filter((h) => h !== history))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredHistory((prev) =>
      prev.map((h) => (h === modalHistory ? ({ ...h, ...updated } as OperationHistoryRow) : h)),
    )
    setModalHistory(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredHistory])

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE))
  const pagedHistory = filteredHistory.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<OperationHistoryRow>[] = useMemo(
    () => [
      { accessorKey: 'equipmentName', header: '설비명' },
      { accessorKey: 'startedAt', header: '가동시작' },
      { accessorKey: 'endedAt', header: '가동종료' },
      { accessorKey: 'duration', header: '가동시간' },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => {
          const value = getValue() as OperationHistoryRow['status']
          return <Badge tone={STATUS_TONE[value]}>{value}</Badge>
        },
      },
      { accessorKey: 'workOrderNo', header: '작업지시번호' },
      { accessorKey: 'manager', header: '담당자' },
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
                setModalHistory(row.original)
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
    { label: '설비명', key: 'equipmentName' },
    { label: '가동시작', key: 'startedAt' },
    { label: '가동종료', key: 'endedAt' },
    { label: '가동시간', key: 'duration' },
    { label: '상태', key: 'status' },
    { label: '작업지시번호', key: 'workOrderNo' },
    { label: '담당자', key: 'manager' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="설비가동이력 목록" action="상세" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedHistory} columns={columns} onRowClick={setModalHistory} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredHistory.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalHistory !== null}
        onClose={() => setModalHistory(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalHistory ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
