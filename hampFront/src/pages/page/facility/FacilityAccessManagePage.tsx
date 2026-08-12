import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

// --- 타입 정의 ---
export interface AccessRequest {
  visitorName: string
  affiliation: string
  zone: string
  purpose: string
  approvalStatus: string
  scheduledAt: string
  category: string
}

export interface AccessRequestSearchParams {
  visitorName?: string
  category?: string
  zone?: string
  approvalStatus?: string
}

// --- 더미 데이터 초기값 ---
const INITIAL_DUMMY_DATA: AccessRequest[] = [
  {
    visitorName: '홍길동',
    affiliation: '(주)한국이엔지',
    zone: 'A동 제 1공장',
    purpose: '정기점검',
    approvalStatus: '승인완료',
    scheduledAt: '2026-06-10 09:00',
    category: '방문객',
  },
  {
    visitorName: '김철수',
    affiliation: '태성물류',
    zone: 'B동 물류창고',
    purpose: '원료납품',
    approvalStatus: '승인대기',
    scheduledAt: '2026-06-11 14:30',
    category: '납품업체',
  },
  {
    visitorName: '이영희',
    affiliation: '한국품질검증',
    zone: 'C동 연구소',
    purpose: '품질확인',
    approvalStatus: '반려',
    scheduledAt: '2026-06-12 10:00',
    category: '외부심사',
  },
]

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

const PAGE_SIZE = 10

export function FacilityAccessManagePage() {
  const [rawData, setRawData] = useState<AccessRequest[]>(INITIAL_DUMMY_DATA)
  const [accessRequest, setAccessRequest] = useState<AccessRequest[]>(INITIAL_DUMMY_DATA)
  const [searchParams, setSearchParams] = useState<AccessRequestSearchParams>({})
  const [isLoading, setIsLoading] = useState(false)
  const [modalRequest, setModalRequest] = useState<AccessRequest | null>(null)
  const [page, setPage] = useState(0)

  const visitorNameRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLInputElement>(null)
  const zoneRef = useRef<HTMLInputElement>(null)
  const approvalStatusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '출입자명', ref: visitorNameRef, name: "equipmentName" },
    { type: 'input', label: '구분', ref: categoryRef, name: "equipmentName" },
    { type: 'input', label: '출입구역', ref: zoneRef, name: "equipmentName" },
    { type: 'input', label: '승인상태', ref: approvalStatusRef, name: "equipmentName" },
  ]

  // 내부 더미 API 연동 로직
  const loadAccessManage = async (params: AccessRequestSearchParams) => {
    setIsLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 200)) // 가상 딜레이

      let filtered = [...rawData]

      if (params.visitorName) {
        filtered = filtered.filter((item) =>
          item.visitorName.toLowerCase().includes(params.visitorName!.toLowerCase())
        )
      }
      if (params.category) {
        filtered = filtered.filter((item) =>
          item.category.toLowerCase().includes(params.category!.toLowerCase())
        )
      }
      if (params.zone) {
        filtered = filtered.filter((item) =>
          item.zone.toLowerCase().includes(params.zone!.toLowerCase())
        )
      }
      if (params.approvalStatus) {
        filtered = filtered.filter((item) =>
          item.approvalStatus.toLowerCase().includes(params.approvalStatus!.toLowerCase())
        )
      }

      setAccessRequest(filtered)
      setPage(0)
    } catch (error) {
      console.error(error)
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAccessManage(searchParams)
  }, [searchParams, rawData])

  const handleSearch = () => {
    const params: AccessRequestSearchParams = {
      visitorName: visitorNameRef.current?.value.trim(),
      category: categoryRef.current?.value.trim(),
      zone: zoneRef.current?.value.trim(),
      approvalStatus: approvalStatusRef.current?.value.trim(),
    }
    setSearchParams(params)
  }

  const handleReset = () => {
    ;[visitorNameRef, categoryRef, zoneRef, approvalStatusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setSearchParams({})
  }

  const handleDelete = async (request: AccessRequest) => {
    if (window.confirm(`${request.visitorName}의 출입 신청을 삭제할까요?`)) {
      try {
        setRawData((prev) => prev.filter((item) => item !== request))
        window.alert('삭제되었습니다.')
      } catch (err) {
        window.alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalRequest) return
    try {
      setRawData((prev) =>
        prev.map((item) =>
          item === modalRequest ? ({ ...item, ...updated } as AccessRequest) : item
        )
      )
      window.alert('저장되었습니다.')
      setModalRequest(null)
    } catch (err) {
      window.alert('저장에 실패했습니다.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(accessRequest.length / PAGE_SIZE))
  const pagedRequests = accessRequest.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

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
    [accessRequest, searchParams],
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

      <Panel title="출입 관리 목록" action="등록" onAction={() => window.alert('mock 등록 동작입니다.')}>
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            <CusTable data={pagedRequests} columns={columns} onRowClick={setModalRequest} />
            <CusPagination page={page} totalPages={totalPages} totalCount={accessRequest.length} onPageChange={setPage} />
          </>
        )}
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