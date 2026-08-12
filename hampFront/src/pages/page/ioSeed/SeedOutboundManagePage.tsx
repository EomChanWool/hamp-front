import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { DashboardCharts } from '@components/chart/InOutChart'

interface SeedOutboundRow {
  outboundNo: string
  itemName: string
  lotNo: string
  outboundQty: string
  destination: string
  manager: string
  outboundTime: string
  registeredAt: string
}

const dummySeedOutbound: SeedOutboundRow[] = [
  { outboundNo: 'OUT-5000', itemName: '헴프 오일', lotNo: 'LOT-SEED-202606-10', outboundQty: '80 kg', destination: '제 1 가공라인', manager: '김민준', outboundTime: '14:10:00', registeredAt: '2026-06-22 15:20' },
  { outboundNo: 'OUT-5001', itemName: '헴프 분말', lotNo: 'LOT-SEED-202606-11', outboundQty: '95 kg', destination: '제 1 가공라인', manager: '이서연', outboundTime: '14:11:00', registeredAt: '2026-06-21 16:20' },
  { outboundNo: 'OUT-5002', itemName: '단백질 바', lotNo: 'LOT-SEED-202606-12', outboundQty: '110 kg', destination: '제 1 가공라인', manager: '박지훈', outboundTime: '14:12:00', registeredAt: '2026-06-20 17:20' },
  { outboundNo: 'OUT-5003', itemName: '헴프 음료', lotNo: 'LOT-SEED-202606-13', outboundQty: '125 kg', destination: '제 1 가공라인', manager: '최유진', outboundTime: '14:13:00', registeredAt: '2026-06-19 18:20' },
  { outboundNo: 'OUT-5004', itemName: '씨드 그래놀라', lotNo: 'LOT-SEED-202606-14', outboundQty: '140 kg', destination: '제 1 가공라인', manager: '정도윤', outboundTime: '14:14:00', registeredAt: '2026-06-18 19:20' },
  { outboundNo: 'OUT-5005', itemName: '헴프 캡슐', lotNo: 'LOT-SEED-202606-15', outboundQty: '155 kg', destination: '제 1 가공라인', manager: '한수아', outboundTime: '14:15:00', registeredAt: '2026-06-17 20:20' },
]

const PAGE_SIZE = 10

export function SeedOutboundManagePage() {
  const [filteredSeedOutbound, setFilteredSeedOutbound] = useState<SeedOutboundRow[]>(dummySeedOutbound)
  const [modalRow, setModalRow] = useState<SeedOutboundRow | null>(null)
  const [page, setPage] = useState(0)

  const outboundNoRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)
  const lotNoRef = useRef<HTMLInputElement>(null)
  const managerRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '출고번호', ref: outboundNoRef, name: "equipmentName" },
    { type: 'input', label: '품명', ref: itemNameRef, name: "equipmentName" },
    { type: 'input', label: 'Lot번호', ref: lotNoRef, name: "equipmentName" },
    { type: 'input', label: '담당자', ref: managerRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const outboundNo = outboundNoRef.current?.value.trim() ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const lotNo = lotNoRef.current?.value.trim() ?? ''
    const manager = managerRef.current?.value.trim() ?? ''

    // 현재는 더미출고에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredSeedOutbound(
      dummySeedOutbound.filter(
        (row) =>
          (!outboundNo || row.outboundNo.includes(outboundNo)) &&
          (!itemName || row.itemName.includes(itemName)) &&
          (!lotNo || row.lotNo.includes(lotNo)) &&
          (!manager || row.manager.includes(manager)),
      ),
    )
  }

  const handleReset = () => {
    ;[outboundNoRef, itemNameRef, lotNoRef, managerRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredSeedOutbound(dummySeedOutbound)
  }

  const handleDelete = (row: SeedOutboundRow) => {
    if (window.confirm(`${row.outboundNo} 항목을 삭제할까요?`)) {
      setFilteredSeedOutbound((prev) => prev.filter((r) => r !== row))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredSeedOutbound((prev) => prev.map((r) => (r === modalRow ? ({ ...r, ...updated } as SeedOutboundRow) : r)))
    setModalRow(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredSeedOutbound])

  const totalPages = Math.max(1, Math.ceil(filteredSeedOutbound.length / PAGE_SIZE))
  const pagedSeedOutbound = filteredSeedOutbound.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<SeedOutboundRow>[] = useMemo(
    () => [
      { accessorKey: 'outboundNo', header: '출고번호' },
      { accessorKey: 'itemName', header: '품명' },
      { accessorKey: 'lotNo', header: 'Lot번호' },
      { accessorKey: 'outboundQty', header: '출고량' },
      { accessorKey: 'destination', header: '출고목적지' },
      { accessorKey: 'manager', header: '담당자' },
      { accessorKey: 'outboundTime', header: '출고시간' },
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
    { label: '출고번호', key: 'outboundNo' },
    { label: '품명', key: 'itemName' },
    { label: 'Lot번호', key: 'lotNo' },
    { label: '출고량', key: 'outboundQty' },
    { label: '출고목적지', key: 'destination' },
    { label: '담당자', key: 'manager' },
    { label: '출고시간', key: 'outboundTime' },
    { label: '등록일시', key: 'registeredAt' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />
      <DashboardCharts pageType="seedOutbound" />
      <Panel title="씨드 출고관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedSeedOutbound} columns={columns} onRowClick={setModalRow} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredSeedOutbound.length} onPageChange={setPage} />
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
