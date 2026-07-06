import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface InpiInspectionStandard {
  standardNo: string
  itemName: string
  inspectionType: string
  itemCount: string
  appliedDate: string
  isUsed: '사용' | '미사용'
  criteria: string
}

const dummyInspectionStandards: InpiInspectionStandard[] = [
  { standardNo: 'QS-I-100', itemName: '인피 원면', inspectionType: '입고검사', itemCount: '5개', appliedDate: '2026-05-10', isUsed: '사용', criteria: '기준값/단위/허용오차' },
  { standardNo: 'QS-I-101', itemName: '인피 섬유', inspectionType: '공정검사', itemCount: '6개', appliedDate: '2026-05-11', isUsed: '사용', criteria: '기준값/단위/허용오차' },
  { standardNo: 'QS-I-102', itemName: '인피 매트', inspectionType: '출하검사', itemCount: '7개', appliedDate: '2026-05-12', isUsed: '사용', criteria: '기준값/단위/허용오차' },
  { standardNo: 'QS-I-103', itemName: '인피 패드', inspectionType: '입고검사', itemCount: '8개', appliedDate: '2026-05-13', isUsed: '사용', criteria: '기준값/단위/허용오차' },
  { standardNo: 'QS-I-104', itemName: '인피 롤', inspectionType: '공정검사', itemCount: '9개', appliedDate: '2026-05-14', isUsed: '미사용', criteria: '기준값/단위/허용오차' },
  { standardNo: 'QS-I-105', itemName: '인피 보드', inspectionType: '출하검사', itemCount: '10개', appliedDate: '2026-05-15', isUsed: '사용', criteria: '기준값/단위/허용오차' },
]

const PAGE_SIZE = 10

export function InpiInspectionStandardsPage() {
  const [filteredStandards, setFilteredStandards] = useState<InpiInspectionStandard[]>(dummyInspectionStandards)
  const [modalStandard, setModalStandard] = useState<InpiInspectionStandard | null>(null)
  const [page, setPage] = useState(0)

  const itemNameRef = useRef<HTMLInputElement>(null)
  const inspectionTypeRef = useRef<HTMLInputElement>(null)
  const isUsedRef = useRef<HTMLInputElement>(null)
  const appliedDateRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '품목명', ref: itemNameRef },
    { type: 'input', label: '검사유형', ref: inspectionTypeRef },
    { type: 'input', label: '사용여부', ref: isUsedRef },
    { type: 'input', label: '적용 시작일', ref: appliedDateRef },
  ]

  const handleSearch = () => {
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const inspectionType = inspectionTypeRef.current?.value.trim() ?? ''
    const isUsed = isUsedRef.current?.value.trim() ?? ''
    const appliedDate = appliedDateRef.current?.value.trim() ?? ''

    // 현재는 더미검사기준에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredStandards(
      dummyInspectionStandards.filter(
        (standard) =>
          (!itemName || standard.itemName.includes(itemName)) &&
          (!inspectionType || standard.inspectionType.includes(inspectionType)) &&
          (!isUsed || standard.isUsed.includes(isUsed)) &&
          (!appliedDate || standard.appliedDate.includes(appliedDate)),
      ),
    )
  }

  const handleReset = () => {
    ;[itemNameRef, inspectionTypeRef, isUsedRef, appliedDateRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredStandards(dummyInspectionStandards)
  }

  const handleDelete = (standard: InpiInspectionStandard) => {
    if (window.confirm(`${standard.standardNo} 검사기준서를 삭제할까요?`)) {
      setFilteredStandards((prev) => prev.filter((s) => s !== standard))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredStandards((prev) => prev.map((s) => (s === modalStandard ? ({ ...s, ...updated } as InpiInspectionStandard) : s)))
    setModalStandard(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredStandards])

  const totalPages = Math.max(1, Math.ceil(filteredStandards.length / PAGE_SIZE))
  const pagedStandards = filteredStandards.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<InpiInspectionStandard>[] = useMemo(
    () => [
      { accessorKey: 'standardNo', header: '기준서번호' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'inspectionType', header: '검사유형' },
      { accessorKey: 'itemCount', header: '검사 항목 수' },
      { accessorKey: 'appliedDate', header: '적용일자' },
      {
        accessorKey: 'isUsed',
        header: '사용여부',
        cell: ({ getValue }) => <Badge tone={getValue() === '사용' ? 'good' : 'muted'}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'criteria', header: '판정기준' },
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
                setModalStandard(row.original)
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
    { label: '기준서번호', key: 'standardNo' },
    { label: '품목명', key: 'itemName' },
    { label: '검사유형', key: 'inspectionType' },
    { label: '검사 항목 수', key: 'itemCount' },
    { label: '적용일자', key: 'appliedDate' },
    { label: '사용여부', key: 'isUsed' },
    { label: '판정기준', key: 'criteria' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="인피 검사기준서 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedStandards} columns={columns} onRowClick={setModalStandard} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredStandards.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalStandard !== null}
        onClose={() => setModalStandard(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalStandard ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
