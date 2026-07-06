import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface AccessHistory {
  accessedAt: string
  visitorName: string
  category: string
  zone: string
  accessStatus: string
  approver: string
  note: string
}

const dummyAccessHistory: AccessHistory[] = [
  { accessedAt: '2026-06-22 06:20', visitorName: '김민준', category: '작업자', zone: 'A동 원료실', accessStatus: '정상출입', approver: '정도윤', note: '일일 출입 이력' },
  { accessedAt: '2026-06-21 07:20', visitorName: '이서연', category: '방문자', zone: 'B동 생산실', accessStatus: '출입거부', approver: '한수아', note: '일일 출입 이력' },
  { accessedAt: '2026-06-20 08:20', visitorName: '박지훈', category: '차량', zone: 'C동 포장실', accessStatus: '퇴실완료', approver: '오현우', note: '일일 출입 이력' },
  { accessedAt: '2026-06-19 09:20', visitorName: '최유진', category: '작업자', zone: '품질검사실', accessStatus: '정상출입', approver: '임하린', note: '일일 출입 이력' },
  { accessedAt: '2026-06-18 10:20', visitorName: '정도윤', category: '방문자', zone: '저온창고', accessStatus: '출입거부', approver: '강태오', note: '일일 출입 이력' },
  { accessedAt: '2026-06-17 11:20', visitorName: '한수아', category: '차량', zone: '출하장', accessStatus: '퇴실완료', approver: '윤지아', note: '일일 출입 이력' },
  { accessedAt: '2026-06-16 12:20', visitorName: '오현우', category: '작업자', zone: 'A동 원료실', accessStatus: '정상출입', approver: '서준호', note: '일일 출입 이력' },
  { accessedAt: '2026-06-15 13:20', visitorName: '임하린', category: '방문자', zone: 'B동 생산실', accessStatus: '출입거부', approver: '문채원', note: '일일 출입 이력' },
  { accessedAt: '2026-06-14 14:20', visitorName: '강태오', category: '차량', zone: 'C동 포장실', accessStatus: '퇴실완료', approver: '김민준', note: '일일 출입 이력' },
]

const PAGE_SIZE = 10

export function FacilityAccessHistoryPage() {
  const [filteredHistory, setFilteredHistory] = useState<AccessHistory[]>(dummyAccessHistory)
  const [modalHistory, setModalHistory] = useState<AccessHistory | null>(null)
  const [page, setPage] = useState(0)

  const periodStartRef = useRef<HTMLInputElement>(null)
  const periodEndRef = useRef<HTMLInputElement>(null)
  const visitorNameRef = useRef<HTMLInputElement>(null)
  const accessStatusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '기간', startRef: periodStartRef, endRef: periodEndRef },
    { type: 'input', label: '출입자명', ref: visitorNameRef },
    { type: 'input', label: '출입상태', ref: accessStatusRef },
  ]

  const handleSearch = () => {
    const start = periodStartRef.current?.value ?? ''
    const end = periodEndRef.current?.value ?? ''
    const visitorName = visitorNameRef.current?.value.trim() ?? ''
    const accessStatus = accessStatusRef.current?.value.trim() ?? ''

    // 현재는 더미출입기록에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredHistory(
      dummyAccessHistory.filter((history) => {
        const date = history.accessedAt.slice(0, 10)
        return (
          (!start || date >= start) &&
          (!end || date <= end) &&
          (!visitorName || history.visitorName.includes(visitorName)) &&
          (!accessStatus || history.accessStatus.includes(accessStatus))
        )
      }),
    )
  }

  const handleReset = () => {
    ;[periodStartRef, periodEndRef, visitorNameRef, accessStatusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredHistory(dummyAccessHistory)
  }

  const handleDelete = (history: AccessHistory) => {
    if (window.confirm(`${history.visitorName}의 출입 이력을 삭제할까요?`)) {
      setFilteredHistory((prev) => prev.filter((h) => h !== history))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredHistory((prev) => prev.map((h) => (h === modalHistory ? ({ ...h, ...updated } as AccessHistory) : h)))
    setModalHistory(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredHistory])

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE))
  const pagedHistory = filteredHistory.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<AccessHistory>[] = useMemo(
    () => [
      { accessorKey: 'accessedAt', header: '출입일시' },
      { accessorKey: 'visitorName', header: '출입자명' },
      { accessorKey: 'category', header: '구분' },
      { accessorKey: 'zone', header: '출입구역' },
      { accessorKey: 'accessStatus', header: '출입상태' },
      { accessorKey: 'approver', header: '승인자' },
      { accessorKey: 'note', header: '비고' },
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
    { label: '출입일시', key: 'accessedAt' },
    { label: '출입자명', key: 'visitorName' },
    { label: '구분', key: 'category' },
    { label: '출입구역', key: 'zone' },
    { label: '출입상태', key: 'accessStatus' },
    { label: '승인자', key: 'approver' },
    { label: '비고', key: 'note' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="출입 이력 조회 목록" action="상세" onAction={() => window.alert('mock 동작입니다.')}>
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
