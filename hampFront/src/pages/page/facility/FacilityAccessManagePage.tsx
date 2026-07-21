import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

import {
  fetchAccessRequest,
  deleteAccessRequest,
  updateAccessRequest,
  type AccessRequest,
  type AccessRequestSearchParams,
} from '@/services/facility/FacilityAccessManagePage'

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
  const [accessRequest, setAccessRequest] = useState<AccessRequest[]>([]) // 서버(더미)에서 받은 원본 데이터
  const [searchParams, setSearchParams] = useState<AccessRequestSearchParams>({}) // 현재 검색 조건 상태
  const [isLoading, setIsLoading] = useState(false) // 로딩 상태 추가
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

  const loadAccessManage = async (params: AccessRequestSearchParams) => {
    setIsLoading(true)
    try {
      const data = await fetchAccessRequest(params)
      setAccessRequest(data)
      setPage(0) // 검색 조건이 바뀌면 페이지를 첫 페이지로 초기화
    } catch (error) {
      console.error(error)
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 컴포넌트 마운트 및 검색 조건 변경 시 실행
  useEffect(() => {
    loadAccessManage(searchParams)
  }, [searchParams])


  const handleSearch = () => {
    const params: AccessRequestSearchParams = {
      visitorName: visitorNameRef.current?.value.trim(),
      category: categoryRef.current?.value.trim(),
      zone: zoneRef.current?.value.trim(),
      approvalStatus: approvalStatusRef.current?.value.trim(),
    }
    setSearchParams(params) // 상태를 바꾸면 useEffect가 감지하여 로드합니다.
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
        await deleteAccessRequest(request.visitorName)
        window.alert('삭제되었습니다.')
        loadAccessManage(searchParams) // 삭제 후 목록 리로드
      } catch (err) {
        window.alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalRequest) return
    try {
      await updateAccessRequest(modalRequest.visitorName, updated)
      window.alert('저장되었습니다.')
      setModalRequest(null)
      loadAccessManage(searchParams) // 수정 후 목록 리로드
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
