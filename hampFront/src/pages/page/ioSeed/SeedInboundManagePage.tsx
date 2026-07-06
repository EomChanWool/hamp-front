import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { DashboardCharts } from '@components/chart/InOutChart'

interface SeedInboundRow {
  inboundNo: string
  itemName: string
  inboundQty: string
  defectQty: string
  goodQty: string
  manager: string
  supplier: string
  inboundTime: string
  registeredAt: string
}

const dummySeedInbound: SeedInboundRow[] = [
  { inboundNo: 'IN-5000', itemName: '헴프 오일', inboundQty: '100 kg', defectQty: '0 kg', goodQty: '100 kg', manager: '김민준', supplier: '씨드유통(주)', inboundTime: '10:30:00', registeredAt: '2026-06-22 15:20' },
  { inboundNo: 'IN-5001', itemName: '헴프 분말', inboundQty: '120 kg', defectQty: '5 kg', goodQty: '115 kg', manager: '이서연', supplier: '씨드유통(주)', inboundTime: '10:31:00', registeredAt: '2026-06-21 16:20' },
  { inboundNo: 'IN-5002', itemName: '단백질 바', inboundQty: '140 kg', defectQty: '0 kg', goodQty: '140 kg', manager: '박지훈', supplier: '씨드유통(주)', inboundTime: '10:32:00', registeredAt: '2026-06-20 17:20' },
  { inboundNo: 'IN-5003', itemName: '헴프 음료', inboundQty: '160 kg', defectQty: '0 kg', goodQty: '160 kg', manager: '최유진', supplier: '씨드유통(주)', inboundTime: '10:33:00', registeredAt: '2026-06-19 18:20' },
  { inboundNo: 'IN-5004', itemName: '씨드 그래놀라', inboundQty: '180 kg', defectQty: '0 kg', goodQty: '180 kg', manager: '정도윤', supplier: '씨드유통(주)', inboundTime: '10:34:00', registeredAt: '2026-06-18 19:20' },
  { inboundNo: 'IN-5005', itemName: '헴프 캡슐', inboundQty: '200 kg', defectQty: '0 kg', goodQty: '200 kg', manager: '한수아', supplier: '씨드유통(주)', inboundTime: '10:35:00', registeredAt: '2026-06-17 20:20' },
]

const PAGE_SIZE = 10

export function SeedInboundManagePage() {
  const [filteredSeedInbound, setFilteredSeedInbound] = useState<SeedInboundRow[]>(dummySeedInbound)
  const [modalRow, setModalRow] = useState<SeedInboundRow | null>(null)
  const [page, setPage] = useState(0)

  const inboundNoRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)
  const managerRef = useRef<HTMLInputElement>(null)
  const supplierRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '입고번호', ref: inboundNoRef },
    { type: 'input', label: '품명', ref: itemNameRef },
    { type: 'input', label: '담당자', ref: managerRef },
    { type: 'input', label: '입고처', ref: supplierRef },
  ]

  const handleSearch = () => {
    const inboundNo = inboundNoRef.current?.value.trim() ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const manager = managerRef.current?.value.trim() ?? ''
    const supplier = supplierRef.current?.value.trim() ?? ''

    // 현재는 더미입고에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredSeedInbound(
      dummySeedInbound.filter(
        (row) =>
          (!inboundNo || row.inboundNo.includes(inboundNo)) &&
          (!itemName || row.itemName.includes(itemName)) &&
          (!manager || row.manager.includes(manager)) &&
          (!supplier || row.supplier.includes(supplier)),
      ),
    )
  }

  const handleReset = () => {
    ;[inboundNoRef, itemNameRef, managerRef, supplierRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredSeedInbound(dummySeedInbound)
  }

  const handleDelete = (row: SeedInboundRow) => {
    if (window.confirm(`${row.inboundNo} 항목을 삭제할까요?`)) {
      setFilteredSeedInbound((prev) => prev.filter((r) => r !== row))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredSeedInbound((prev) => prev.map((r) => (r === modalRow ? ({ ...r, ...updated } as SeedInboundRow) : r)))
    setModalRow(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredSeedInbound])

  const totalPages = Math.max(1, Math.ceil(filteredSeedInbound.length / PAGE_SIZE))
  const pagedSeedInbound = filteredSeedInbound.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<SeedInboundRow>[] = useMemo(
    () => [
      { accessorKey: 'inboundNo', header: '입고번호' },
      { accessorKey: 'itemName', header: '품명' },
      { accessorKey: 'inboundQty', header: '입고수량' },
      { accessorKey: 'defectQty', header: '불량수량' },
      { accessorKey: 'goodQty', header: '양품수량' },
      { accessorKey: 'manager', header: '담당자' },
      { accessorKey: 'supplier', header: '입고처' },
      { accessorKey: 'inboundTime', header: '입고시간' },
      { accessorKey: 'registeredAt', header: '등록일시' },
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
                setModalRow(row.original)
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
    { label: '입고번호', key: 'inboundNo' },
    { label: '품명', key: 'itemName' },
    { label: '입고수량', key: 'inboundQty' },
    { label: '불량수량', key: 'defectQty' },
    { label: '양품수량', key: 'goodQty' },
    { label: '담당자', key: 'manager' },
    { label: '입고처', key: 'supplier' },
    { label: '입고시간', key: 'inboundTime' },
    { label: '등록일시', key: 'registeredAt' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />
      <DashboardCharts pageType="seedInbound" />
      <Panel title="씨드 입고관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedSeedInbound} columns={columns} onRowClick={setModalRow} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredSeedInbound.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalRow !== null}
        onClose={() => setModalRow(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalRow ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
