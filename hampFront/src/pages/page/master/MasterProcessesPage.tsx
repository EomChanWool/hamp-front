import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface ProcessRow {
  code: string
  name: string
  order: string
  appliedItem: string
  status: '사용' | '미사용'
  standardTime: string
  department: string
}

const dummyProcesses: ProcessRow[] = [
  { code: 'PROC-1', name: '원료투입', order: '1', appliedItem: '헴프 오일', status: '사용', standardTime: '30분', department: '생산팀' },
  { code: 'PROC-2', name: '세척', order: '2', appliedItem: '헴프 분말', status: '사용', standardTime: '45분', department: '생산팀' },
  { code: 'PROC-3', name: '건조', order: '3', appliedItem: '단백질 바', status: '사용', standardTime: '60분', department: '생산팀' },
  { code: 'PROC-4', name: '분쇄', order: '4', appliedItem: '헴프 음료', status: '사용', standardTime: '75분', department: '생산팀' },
  { code: 'PROC-5', name: '선별', order: '5', appliedItem: '씨드 그래놀라', status: '사용', standardTime: '90분', department: '생산팀' },
  { code: 'PROC-6', name: '포장', order: '6', appliedItem: '헴프 캡슐', status: '사용', standardTime: '105분', department: '생산팀' },
]

const PAGE_SIZE = 10

export function MasterProcessesPage() {
  const [filteredProcesses, setFilteredProcesses] = useState<ProcessRow[]>(dummyProcesses)
  const [modalProcess, setModalProcess] = useState<ProcessRow | null>(null)
  const [page, setPage] = useState(0)

  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const appliedItemRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '공정코드', ref: codeRef },
    { type: 'input', label: '공정명', ref: nameRef },
    { type: 'input', label: '적용품목', ref: appliedItemRef },
    { type: 'input', label: '사용여부', ref: statusRef },
  ]

  const handleSearch = () => {
    const code = codeRef.current?.value.trim() ?? ''
    const name = nameRef.current?.value.trim() ?? ''
    const appliedItem = appliedItemRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미공정에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredProcesses(
      dummyProcesses.filter(
        (process) =>
          (!code || process.code.includes(code)) &&
          (!name || process.name.includes(name)) &&
          (!appliedItem || process.appliedItem.includes(appliedItem)) &&
          (!status || process.status.includes(status)),
      ),
    )
  }

  const handleReset = () => {
    ;[codeRef, nameRef, appliedItemRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredProcesses(dummyProcesses)
  }

  const handleDelete = (process: ProcessRow) => {
    if (window.confirm(`${process.code} 공정을 삭제할까요?`)) {
      setFilteredProcesses((prev) => prev.filter((p) => p !== process))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredProcesses((prev) => prev.map((p) => (p === modalProcess ? ({ ...p, ...updated } as ProcessRow) : p)))
    setModalProcess(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredProcesses])

  const totalPages = Math.max(1, Math.ceil(filteredProcesses.length / PAGE_SIZE))
  const pagedProcesses = filteredProcesses.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<ProcessRow>[] = useMemo(
    () => [
      { accessorKey: 'code', header: '공정코드' },
      { accessorKey: 'name', header: '공정명' },
      { accessorKey: 'order', header: '공정순서' },
      { accessorKey: 'appliedItem', header: '적용품목' },
      {
        accessorKey: 'status',
        header: '사용여부',
        cell: ({ getValue }) => <Badge tone={getValue() === '사용' ? 'good' : 'muted'}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'standardTime', header: '표준시간' },
      { accessorKey: 'department', header: '담당부서' },
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
                setModalProcess(row.original)
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
    { label: '공정코드', key: 'code' },
    { label: '공정명', key: 'name' },
    { label: '공정순서', key: 'order' },
    { label: '적용품목', key: 'appliedItem' },
    { label: '사용여부', key: 'status' },
    { label: '표준시간', key: 'standardTime' },
    { label: '담당부서', key: 'department' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="공정관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
        <CusTable data={pagedProcesses} columns={columns} onRowClick={setModalProcess} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredProcesses.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalProcess !== null}
        onClose={() => setModalProcess(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalProcess ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
