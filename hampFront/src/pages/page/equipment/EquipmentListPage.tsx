import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface EquipmentRow {
  equipmentCode: string
  equipmentName: string
  equipmentType: string
  location: string
  status: '가동중' | '대기중' | '점검중' | '고장'
  operationRate: string
  manager: string
}

const dummyEquipment: EquipmentRow[] = [
  { equipmentCode: 'EQL-210', equipmentName: '추출기-01', equipmentType: '추출', location: 'A동 원료실', status: '가동중', operationRate: '91%', manager: '김민준' },
  { equipmentCode: 'EQL-211', equipmentName: '건조기-02', equipmentType: '건조', location: 'B동 생산실', status: '대기중', operationRate: '83%', manager: '이서연' },
  { equipmentCode: 'EQL-212', equipmentName: '세척기-03', equipmentType: '세척', location: 'C동 포장실', status: '점검중', operationRate: '75%', manager: '박지훈' },
  { equipmentCode: 'EQL-213', equipmentName: '분쇄기-01', equipmentType: '분쇄', location: '품질검사실', status: '고장', operationRate: '67%', manager: '최유진' },
  { equipmentCode: 'EQL-214', equipmentName: '포장기-04', equipmentType: '포장', location: '저온창고', status: '가동중', operationRate: '59%', manager: '정도윤' },
  { equipmentCode: 'EQL-215', equipmentName: '압축기-02', equipmentType: '추출', location: '출하장', status: '대기중', operationRate: '51%', manager: '한수아' },
]

const STATUS_TONE: Record<EquipmentRow['status'], 'good' | 'warn' | 'danger'> = {
  가동중: 'good',
  대기중: 'warn',
  점검중: 'warn',
  고장: 'danger',
}

const PAGE_SIZE = 10

export function EquipmentListPage() {
  const [filteredEquipment, setFilteredEquipment] = useState<EquipmentRow[]>(dummyEquipment)
  const [modalEquipment, setModalEquipment] = useState<EquipmentRow | null>(null)
  const [page, setPage] = useState(0)

  const equipmentNameRef = useRef<HTMLInputElement>(null)
  const equipmentTypeRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '설비명', ref: equipmentNameRef, name: "equipmentName" },
    { type: 'input', label: '설비유형', ref: equipmentTypeRef, name: "equipmentName" },
    { type: 'input', label: '현재상태', ref: statusRef, name: "equipmentName" },
    { type: 'input', label: '설치위치', ref: locationRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const equipmentName = equipmentNameRef.current?.value.trim() ?? ''
    const equipmentType = equipmentTypeRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''
    const location = locationRef.current?.value.trim() ?? ''

    // 현재는 더미설비에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredEquipment(
      dummyEquipment.filter(
        (eq) =>
          (!equipmentName || eq.equipmentName.includes(equipmentName)) &&
          (!equipmentType || eq.equipmentType.includes(equipmentType)) &&
          (!status || eq.status.includes(status)) &&
          (!location || eq.location.includes(location)),
      ),
    )
  }

  const handleReset = () => {
    ;[equipmentNameRef, equipmentTypeRef, statusRef, locationRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredEquipment(dummyEquipment)
  }

  const handleDelete = (eq: EquipmentRow) => {
    if (window.confirm(`${eq.equipmentName} 설비를 삭제할까요?`)) {
      setFilteredEquipment((prev) => prev.filter((e) => e !== eq))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredEquipment((prev) =>
      prev.map((e) => (e === modalEquipment ? ({ ...e, ...updated } as EquipmentRow) : e)),
    )
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
      { accessorKey: 'equipmentCode', header: '설비코드' },
      { accessorKey: 'equipmentName', header: '설비명' },
      { accessorKey: 'equipmentType', header: '설비유형' },
      { accessorKey: 'location', header: '설치위치' },
      {
        accessorKey: 'status',
        header: '현재상태',
        cell: ({ getValue }) => {
          const value = getValue() as EquipmentRow['status']
          return <Badge tone={STATUS_TONE[value]}>{value}</Badge>
        },
      },
      { accessorKey: 'operationRate', header: '가동률' },
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
    { label: '설비코드', key: 'equipmentCode' },
    { label: '설비명', key: 'equipmentName' },
    { label: '설비유형', key: 'equipmentType' },
    { label: '설치위치', key: 'location' },
    { label: '현재상태', key: 'status' },
    { label: '가동률', key: 'operationRate' },
    { label: '담당자', key: 'manager' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="설비목록 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
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
