import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface FactoryRow {
  code: string
  name: string
  location: string
  manager: string
  status: '사용' | '미사용'
  registeredAt: string
  note: string
}

const dummyFactories: FactoryRow[] = [
  { code: 'FAC-1', name: 'A동 원료실', location: '충북 음성 1구역', manager: '김민준', status: '사용', registeredAt: '2026-01-10', note: '생산/보관 구역' },
  { code: 'FAC-2', name: 'B동 생산실', location: '충북 음성 2구역', manager: '이서연', status: '사용', registeredAt: '2026-01-11', note: '생산/보관 구역' },
  { code: 'FAC-3', name: 'C동 포장실', location: '충북 음성 3구역', manager: '박지훈', status: '사용', registeredAt: '2026-01-12', note: '생산/보관 구역' },
  { code: 'FAC-4', name: '품질검사실', location: '충북 음성 4구역', manager: '최유진', status: '사용', registeredAt: '2026-01-13', note: '생산/보관 구역' },
  { code: 'FAC-5', name: '저온창고', location: '충북 음성 5구역', manager: '정도윤', status: '사용', registeredAt: '2026-01-14', note: '생산/보관 구역' },
  { code: 'FAC-6', name: '출하장', location: '충북 음성 6구역', manager: '한수아', status: '미사용', registeredAt: '2026-01-15', note: '생산/보관 구역' },
]

const PAGE_SIZE = 10

export function MasterFactoriesPage() {
  const [filteredFactories, setFilteredFactories] = useState<FactoryRow[]>(dummyFactories)
  const [modalFactory, setModalFactory] = useState<FactoryRow | null>(null)
  const [page, setPage] = useState(0)

  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const managerRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '공장코드', ref: codeRef },
    { type: 'input', label: '공장명', ref: nameRef },
    { type: 'input', label: '담당자', ref: managerRef },
    { type: 'input', label: '사용여부', ref: statusRef },
  ]

  const handleSearch = () => {
    const code = codeRef.current?.value.trim() ?? ''
    const name = nameRef.current?.value.trim() ?? ''
    const manager = managerRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미공장에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredFactories(
      dummyFactories.filter(
        (factory) =>
          (!code || factory.code.includes(code)) &&
          (!name || factory.name.includes(name)) &&
          (!manager || factory.manager.includes(manager)) &&
          (!status || factory.status.includes(status)),
      ),
    )
  }

  const handleReset = () => {
    ;[codeRef, nameRef, managerRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredFactories(dummyFactories)
  }

  const handleDelete = (factory: FactoryRow) => {
    if (window.confirm(`${factory.code} 공장을 삭제할까요?`)) {
      setFilteredFactories((prev) => prev.filter((f) => f !== factory))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredFactories((prev) => prev.map((f) => (f === modalFactory ? ({ ...f, ...updated } as FactoryRow) : f)))
    setModalFactory(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredFactories])

  const totalPages = Math.max(1, Math.ceil(filteredFactories.length / PAGE_SIZE))
  const pagedFactories = filteredFactories.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<FactoryRow>[] = useMemo(
    () => [
      { accessorKey: 'code', header: '공장코드' },
      { accessorKey: 'name', header: '공장명' },
      { accessorKey: 'location', header: '위치' },
      { accessorKey: 'manager', header: '담당자' },
      {
        accessorKey: 'status',
        header: '사용여부',
        cell: ({ getValue }) => <Badge tone={getValue() === '사용' ? 'good' : 'muted'}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'registeredAt', header: '등록일자' },
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
                setModalFactory(row.original)
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
    { label: '공장코드', key: 'code' },
    { label: '공장명', key: 'name' },
    { label: '위치', key: 'location' },
    { label: '담당자', key: 'manager' },
    { label: '사용여부', key: 'status' },
    { label: '등록일자', key: 'registeredAt' },
    { label: '비고', key: 'note' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="공장관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
        <CusTable data={pagedFactories} columns={columns} onRowClick={setModalFactory} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredFactories.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalFactory !== null}
        onClose={() => setModalFactory(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalFactory ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
