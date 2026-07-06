import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface EquipmentRow {
  code: string
  name: string
  type: string
  installProcess: string
  manufacturer: string
  status: '사용' | '미사용'
  calibrationDate: string
}

const dummyEquipment: EquipmentRow[] = [
  { code: 'EQ-100', name: '추출기-01', type: '생산설비', installProcess: '원료투입', manufacturer: 'HMP Tech', status: '사용', calibrationDate: '2026-04-10' },
  { code: 'EQ-101', name: '건조기-02', type: '검사설비', installProcess: '세척', manufacturer: 'MES Korea', status: '사용', calibrationDate: '2026-04-11' },
  { code: 'EQ-102', name: '세척기-03', type: '물류설비', installProcess: '건조', manufacturer: 'Green Fab', status: '사용', calibrationDate: '2026-04-12' },
  { code: 'EQ-103', name: '분쇄기-01', type: '생산설비', installProcess: '포장', manufacturer: 'HMP Tech', status: '사용', calibrationDate: '2026-04-13' },
  { code: 'EQ-104', name: '포장기-04', type: '검사설비', installProcess: '원료투입', manufacturer: 'MES Korea', status: '미사용', calibrationDate: '2026-04-14' },
  { code: 'EQ-105', name: '압축기-02', type: '물류설비', installProcess: '세척', manufacturer: 'Green Fab', status: '사용', calibrationDate: '2026-04-15' },
]

const PAGE_SIZE = 10

export function MasterEquipmentPage() {
  const [filteredEquipment, setFilteredEquipment] = useState<EquipmentRow[]>(dummyEquipment)
  const [modalEquipment, setModalEquipment] = useState<EquipmentRow | null>(null)
  const [page, setPage] = useState(0)

  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const typeRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '장비코드', ref: codeRef },
    { type: 'input', label: '장비명', ref: nameRef },
    { type: 'input', label: '장비유형', ref: typeRef },
    { type: 'input', label: '사용여부', ref: statusRef },
  ]

  const handleSearch = () => {
    const code = codeRef.current?.value.trim() ?? ''
    const name = nameRef.current?.value.trim() ?? ''
    const type = typeRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미장비에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredEquipment(
      dummyEquipment.filter(
        (equipment) =>
          (!code || equipment.code.includes(code)) &&
          (!name || equipment.name.includes(name)) &&
          (!type || equipment.type.includes(type)) &&
          (!status || equipment.status.includes(status)),
      ),
    )
  }

  const handleReset = () => {
    ;[codeRef, nameRef, typeRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredEquipment(dummyEquipment)
  }

  const handleDelete = (equipment: EquipmentRow) => {
    if (window.confirm(`${equipment.code} 장비를 삭제할까요?`)) {
      setFilteredEquipment((prev) => prev.filter((e) => e !== equipment))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredEquipment((prev) => prev.map((e) => (e === modalEquipment ? ({ ...e, ...updated } as EquipmentRow) : e)))
    setModalEquipment(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredEquipment])

  const totalPages = Math.max(1, Math.ceil(filteredEquipment.length / PAGE_SIZE))
  const pagedEquipment = filteredEquipment.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<EquipmentRow>[] = useMemo(
    () => [
      { accessorKey: 'code', header: '장비코드' },
      { accessorKey: 'name', header: '장비명' },
      { accessorKey: 'type', header: '장비유형' },
      { accessorKey: 'installProcess', header: '설치공정' },
      { accessorKey: 'manufacturer', header: '제조사' },
      {
        accessorKey: 'status',
        header: '사용여부',
        cell: ({ getValue }) => <Badge tone={getValue() === '사용' ? 'good' : 'muted'}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'calibrationDate', header: '검교정일' },
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
                setModalEquipment(row.original)
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
    { label: '장비코드', key: 'code' },
    { label: '장비명', key: 'name' },
    { label: '장비유형', key: 'type' },
    { label: '설치공정', key: 'installProcess' },
    { label: '제조사', key: 'manufacturer' },
    { label: '사용여부', key: 'status' },
    { label: '검교정일', key: 'calibrationDate' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="장비관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
        <CusTable data={pagedEquipment} columns={columns} onRowClick={setModalEquipment} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredEquipment.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalEquipment !== null}
        onClose={() => setModalEquipment(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalEquipment ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
