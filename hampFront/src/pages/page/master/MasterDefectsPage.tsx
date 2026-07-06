import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface DefectRow {
  code: string
  name: string
  type: string
  appliedProcess: string
  severity: string
  status: '사용' | '미사용'
  registeredAt: string
}

const dummyDefects: DefectRow[] = [
  { code: 'DEF-1', name: '이물혼입', type: '공정불량', appliedProcess: '세척', severity: '낮음', status: '사용', registeredAt: '2026-03-10' },
  { code: 'DEF-2', name: '중량미달', type: '검사불량', appliedProcess: '건조', severity: '보통', status: '사용', registeredAt: '2026-03-11' },
  { code: 'DEF-3', name: '외관불량', type: '출하불량', appliedProcess: '포장', severity: '높음', status: '사용', registeredAt: '2026-03-12' },
  { code: 'DEF-4', name: '포장불량', type: '공정불량', appliedProcess: '세척', severity: '낮음', status: '사용', registeredAt: '2026-03-13' },
  { code: 'DEF-5', name: '수분초과', type: '검사불량', appliedProcess: '건조', severity: '보통', status: '사용', registeredAt: '2026-03-14' },
  { code: 'DEF-6', name: '파손', type: '출하불량', appliedProcess: '포장', severity: '높음', status: '사용', registeredAt: '2026-03-15' },
]

const PAGE_SIZE = 10

export function MasterDefectsPage() {
  const [filteredDefects, setFilteredDefects] = useState<DefectRow[]>(dummyDefects)
  const [modalDefect, setModalDefect] = useState<DefectRow | null>(null)
  const [page, setPage] = useState(0)

  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const typeRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '불량코드', ref: codeRef },
    { type: 'input', label: '불량명', ref: nameRef },
    { type: 'input', label: '불량유형', ref: typeRef },
    { type: 'input', label: '사용여부', ref: statusRef },
  ]

  const handleSearch = () => {
    const code = codeRef.current?.value.trim() ?? ''
    const name = nameRef.current?.value.trim() ?? ''
    const type = typeRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미불량에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredDefects(
      dummyDefects.filter(
        (defect) =>
          (!code || defect.code.includes(code)) &&
          (!name || defect.name.includes(name)) &&
          (!type || defect.type.includes(type)) &&
          (!status || defect.status.includes(status)),
      ),
    )
  }

  const handleReset = () => {
    ;[codeRef, nameRef, typeRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredDefects(dummyDefects)
  }

  const handleDelete = (defect: DefectRow) => {
    if (window.confirm(`${defect.code} 불량항목을 삭제할까요?`)) {
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
      { accessorKey: 'code', header: '불량코드' },
      { accessorKey: 'name', header: '불량명' },
      { accessorKey: 'type', header: '불량유형' },
      { accessorKey: 'appliedProcess', header: '적용공정' },
      { accessorKey: 'severity', header: '심각도' },
      {
        accessorKey: 'status',
        header: '사용여부',
        cell: ({ getValue }) => <Badge tone={getValue() === '사용' ? 'good' : 'muted'}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'registeredAt', header: '등록일자' },
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
    { label: '불량코드', key: 'code' },
    { label: '불량명', key: 'name' },
    { label: '불량유형', key: 'type' },
    { label: '적용공정', key: 'appliedProcess' },
    { label: '심각도', key: 'severity' },
    { label: '사용여부', key: 'status' },
    { label: '등록일자', key: 'registeredAt' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="불량관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
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
