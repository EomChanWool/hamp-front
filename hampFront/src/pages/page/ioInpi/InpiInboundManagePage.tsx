import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { DashboardCharts } from '@components/chart/InOutChart'

interface InpiInboundRow {
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

const dummyInpiInbound: InpiInboundRow[] = [
  { inboundNo: 'IN-6000', itemName: '인피 원면', inboundQty: '150 kg', defectQty: '0 kg', goodQty: '150 kg', manager: '김민준', supplier: '(주)인피테크', inboundTime: '09:15:00', registeredAt: '2026-06-22 15:20' },
  { inboundNo: 'IN-6001', itemName: '인피 섬유', inboundQty: '180 kg', defectQty: '8 kg', goodQty: '172 kg', manager: '이서연', supplier: '(주)인피테크', inboundTime: '09:16:00', registeredAt: '2026-06-21 16:20' },
  { inboundNo: 'IN-6002', itemName: '인피 매트', inboundQty: '210 kg', defectQty: '0 kg', goodQty: '210 kg', manager: '박지훈', supplier: '(주)인피테크', inboundTime: '09:17:00', registeredAt: '2026-06-20 17:20' },
  { inboundNo: 'IN-6003', itemName: '인피 패드', inboundQty: '240 kg', defectQty: '0 kg', goodQty: '240 kg', manager: '최유진', supplier: '(주)인피테크', inboundTime: '09:18:00', registeredAt: '2026-06-19 18:20' },
  { inboundNo: 'IN-6004', itemName: '인피 롤', inboundQty: '270 kg', defectQty: '0 kg', goodQty: '270 kg', manager: '정도윤', supplier: '(주)인피테크', inboundTime: '09:19:00', registeredAt: '2026-06-18 19:20' },
  { inboundNo: 'IN-6005', itemName: '인피 보드', inboundQty: '300 kg', defectQty: '8 kg', goodQty: '292 kg', manager: '한수아', supplier: '(주)인피테크', inboundTime: '09:20:00', registeredAt: '2026-06-17 20:20' },
]

const PAGE_SIZE = 10

export function InpiInboundManagePage() {
  const [filteredInpiInbound, setFilteredInpiInbound] = useState<InpiInboundRow[]>(dummyInpiInbound)
  const [modalRow, setModalRow] = useState<InpiInboundRow | null>(null)
  const [page, setPage] = useState(0)

  const inboundNoRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)
  const managerRef = useRef<HTMLInputElement>(null)
  const supplierRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '입고번호', ref: inboundNoRef, name: "equipmentName" },
    { type: 'input', label: '품명', ref: itemNameRef, name: "equipmentName" },
    { type: 'input', label: '담당자', ref: managerRef, name: "equipmentName" },
    { type: 'input', label: '입고처', ref: supplierRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const inboundNo = inboundNoRef.current?.value.trim() ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const manager = managerRef.current?.value.trim() ?? ''
    const supplier = supplierRef.current?.value.trim() ?? ''

    // 현재는 더미인피입고에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredInpiInbound(
      dummyInpiInbound.filter(
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
    setFilteredInpiInbound(dummyInpiInbound)
  }

  const handleDelete = (row: InpiInboundRow) => {
    if (window.confirm(`${row.inboundNo} 항목을 삭제할까요?`)) {
      setFilteredInpiInbound((prev) => prev.filter((r) => r !== row))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredInpiInbound((prev) => prev.map((r) => (r === modalRow ? ({ ...r, ...updated } as InpiInboundRow) : r)))
    setModalRow(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredInpiInbound])

  const totalPages = Math.max(1, Math.ceil(filteredInpiInbound.length / PAGE_SIZE))
  const pagedInpiInbound = filteredInpiInbound.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<InpiInboundRow>[] = useMemo(
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
      <DashboardCharts pageType="inpiInbound" />
      <Panel title="인피 입고관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedInpiInbound} columns={columns} onRowClick={setModalRow} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredInpiInbound.length} onPageChange={setPage} />
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
