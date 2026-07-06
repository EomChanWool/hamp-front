import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

interface AccessRequest {
  visitorName: string
  affiliation: string
  zone: string
  purpose: string
  approvalStatus: string
  scheduledAt: string
  category: string
}

const PURPOSE_COLORS: Record<string, string> = {
  정기점검: '#38bdf8',
  원료납품: '#34d399',
  품질확인: '#c084fc',
  출하: '#fb923c',
}

function approvalTone(status: string): StatusTone {
  if (status === '승인완료') return 'good'
  if (status === '승인대기') return 'warn'
  if (status === '반려') return 'danger'
  return 'muted'
}

const dummyAccessRequests: AccessRequest[] = [
  { visitorName: '김민준', affiliation: '협력사', zone: 'A동 원료실', purpose: '정기점검', approvalStatus: '승인완료', scheduledAt: '2026-06-22 09:20', category: '작업자' },
  { visitorName: '이서연', affiliation: '생산팀', zone: 'B동 생산실', purpose: '원료납품', approvalStatus: '승인대기', scheduledAt: '2026-06-21 10:20', category: '방문자' },
  { visitorName: '박지훈', affiliation: '품질팀', zone: 'C동 포장실', purpose: '품질확인', approvalStatus: '반려', scheduledAt: '2026-06-20 11:20', category: '차량' },
  { visitorName: '최유진', affiliation: '운송사', zone: '품질검사실', purpose: '출하', approvalStatus: '승인완료', scheduledAt: '2026-06-19 12:20', category: '작업자' },
  { visitorName: '정도윤', affiliation: '협력사', zone: '저온창고', purpose: '정기점검', approvalStatus: '승인대기', scheduledAt: '2026-06-18 13:20', category: '방문자' },
  { visitorName: '한수아', affiliation: '생산팀', zone: '출하장', purpose: '원료납품', approvalStatus: '반려', scheduledAt: '2026-06-17 14:20', category: '차량' },
  { visitorName: '오현우', affiliation: '품질팀', zone: 'A동 원료실', purpose: '품질확인', approvalStatus: '승인완료', scheduledAt: '2026-06-16 15:20', category: '작업자' },
  { visitorName: '임하린', affiliation: '운송사', zone: 'B동 생산실', purpose: '출하', approvalStatus: '승인대기', scheduledAt: '2026-06-15 16:20', category: '방문자' },
]

const PAGE_SIZE = 10

export function FacilityAccessManagePage() {
  const [filteredRequests, setFilteredRequests] = useState<AccessRequest[]>(dummyAccessRequests)
  const [modalRequest, setModalRequest] = useState<AccessRequest | null>(null)
  const [page, setPage] = useState(0)

  const visitorNameRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLInputElement>(null)
  const zoneRef = useRef<HTMLInputElement>(null)
  const approvalStatusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '출입자명', ref: visitorNameRef },
    { type: 'input', label: '구분', ref: categoryRef },
    { type: 'input', label: '출입구역', ref: zoneRef },
    { type: 'input', label: '승인상태', ref: approvalStatusRef },
  ]

  const handleSearch = () => {
    const visitorName = visitorNameRef.current?.value.trim() ?? ''
    const category = categoryRef.current?.value.trim() ?? ''
    const zone = zoneRef.current?.value.trim() ?? ''
    const approvalStatus = approvalStatusRef.current?.value.trim() ?? ''

    // 현재는 더미출입정보에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredRequests(
      dummyAccessRequests.filter(
        (request) =>
          (!visitorName || request.visitorName.includes(visitorName)) &&
          (!category || request.category.includes(category)) &&
          (!zone || request.zone.includes(zone)) &&
          (!approvalStatus || request.approvalStatus.includes(approvalStatus)),
      ),
    )
  }

  const handleReset = () => {
    ;[visitorNameRef, categoryRef, zoneRef, approvalStatusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredRequests(dummyAccessRequests)
  }

  const handleDelete = (request: AccessRequest) => {
    if (window.confirm(`${request.visitorName}의 출입 신청을 삭제할까요?`)) {
      setFilteredRequests((prev) => prev.filter((r) => r !== request))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredRequests((prev) => prev.map((r) => (r === modalRequest ? ({ ...r, ...updated } as AccessRequest) : r)))
    setModalRequest(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredRequests])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE))
  const pagedRequests = filteredRequests.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<AccessRequest>[] = useMemo(
    () => [
      { accessorKey: 'visitorName', header: '출입자명' },
      { accessorKey: 'affiliation', header: '소속' },
      { accessorKey: 'zone', header: '출입구역' },
      {
        accessorKey: 'purpose',
        header: '출입목적',
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <span style={{ color: PURPOSE_COLORS[value], fontWeight: 600 }}>{value}</span>
        },
      },
      {
        accessorKey: 'approvalStatus',
        header: '승인상태',
        cell: ({ getValue }) => <Badge tone={approvalTone(getValue() as string)}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'scheduledAt', header: '출입예정일시' },
      { accessorKey: 'category', header: '구분' },
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
                setModalRequest(row.original)
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
    { label: '출입자명', key: 'visitorName' },
    { label: '소속', key: 'affiliation' },
    { label: '출입구역', key: 'zone' },
    { label: '출입목적', key: 'purpose' },
    { label: '승인상태', key: 'approvalStatus' },
    { label: '출입예정일시', key: 'scheduledAt' },
    { label: '구분', key: 'category' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="출입 관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedRequests} columns={columns} onRowClick={setModalRequest} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredRequests.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalRequest !== null}
        onClose={() => setModalRequest(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalRequest ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
