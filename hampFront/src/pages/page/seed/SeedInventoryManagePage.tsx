import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface SeedInventoryRow {
  processDate: string
  processType: string
  itemName: string
  quantity: string
  unit: string
  manager: string
  note: string
}

const PROCESS_TYPE_COLORS: Record<string, string> = {
  입고: '#34d399',
  출고: '#fb7185',
  조정: '#94a3b8',
}

const dummySeedInventory: SeedInventoryRow[] = [
  { processDate: '2026-06-14', processType: '입고', itemName: '헴프 오일', quantity: '80', unit: 'kg', manager: '김민준', note: 'mock 재고 처리' },
  { processDate: '2026-06-15', processType: '출고', itemName: '헴프 분말', quantity: '95', unit: 'kg', manager: '이서연', note: 'mock 재고 처리' },
  { processDate: '2026-06-16', processType: '조정', itemName: '단백질 바', quantity: '110', unit: 'kg', manager: '박지훈', note: 'mock 재고 처리' },
  { processDate: '2026-06-17', processType: '입고', itemName: '헴프 음료', quantity: '125', unit: 'kg', manager: '최유진', note: 'mock 재고 처리' },
  { processDate: '2026-06-18', processType: '출고', itemName: '씨드 그래놀라', quantity: '140', unit: 'kg', manager: '정도윤', note: 'mock 재고 처리' },
  { processDate: '2026-06-19', processType: '조정', itemName: '헴프 캡슐', quantity: '155', unit: 'kg', manager: '한수아', note: 'mock 재고 처리' },
]

const PAGE_SIZE = 10

export function SeedInventoryManagePage() {
  const [filteredSeedInventory, setFilteredSeedInventory] = useState<SeedInventoryRow[]>(dummySeedInventory)
  const [modalSeedInventory, setModalSeedInventory] = useState<SeedInventoryRow | null>(null)
  const [page, setPage] = useState(0)

  const processStartRef = useRef<HTMLInputElement>(null)
  const processEndRef = useRef<HTMLInputElement>(null)
  const processTypeRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '처리', startRef: processStartRef, endRef: processEndRef },
    { type: 'input', label: '처리구분', ref: processTypeRef },
    { type: 'input', label: '품목명', ref: itemNameRef },
  ]

  const handleSearch = () => {
    const start = processStartRef.current?.value ?? ''
    const end = processEndRef.current?.value ?? ''
    const processType = processTypeRef.current?.value.trim() ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''

    // 현재는 더미씨드재고에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredSeedInventory(
      dummySeedInventory.filter(
        (item) =>
          (!start || item.processDate >= start) &&
          (!end || item.processDate <= end) &&
          (!processType || item.processType.includes(processType)) &&
          (!itemName || item.itemName.includes(itemName)),
      ),
    )
  }

  const handleReset = () => {
    if (processStartRef.current) processStartRef.current.value = ''
    if (processEndRef.current) processEndRef.current.value = ''
    ;[processTypeRef, itemNameRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredSeedInventory(dummySeedInventory)
  }

  const handleDelete = (item: SeedInventoryRow) => {
    if (window.confirm(`${item.processDate} 처리 내역을 삭제할까요?`)) {
      setFilteredSeedInventory((prev) => prev.filter((i) => i !== item))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredSeedInventory((prev) => prev.map((i) => (i === modalSeedInventory ? ({ ...i, ...updated } as SeedInventoryRow) : i)))
    setModalSeedInventory(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredSeedInventory])

  const totalPages = Math.max(1, Math.ceil(filteredSeedInventory.length / PAGE_SIZE))
  const pagedSeedInventory = filteredSeedInventory.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<SeedInventoryRow>[] = useMemo(
    () => [
      { accessorKey: 'processDate', header: '처리일자' },
      {
        accessorKey: 'processType',
        header: '처리구분',
        cell: ({ getValue }) => {
          const value = getValue() as string
          const color = PROCESS_TYPE_COLORS[value]
          return color ? <span style={{ color, fontWeight: 600 }}>{value}</span> : value
        },
      },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'quantity', header: '수량' },
      { accessorKey: 'unit', header: '단위' },
      { accessorKey: 'manager', header: '담당자' },
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
                setModalSeedInventory(row.original)
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
    { label: '처리일자', key: 'processDate' },
    { label: '처리구분', key: 'processType' },
    { label: '품목명', key: 'itemName' },
    { label: '수량', key: 'quantity' },
    { label: '단위', key: 'unit' },
    { label: '담당자', key: 'manager' },
    { label: '비고', key: 'note' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="씨드 재고관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedSeedInventory} columns={columns} onRowClick={setModalSeedInventory} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredSeedInventory.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalSeedInventory !== null}
        onClose={() => setModalSeedInventory(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalSeedInventory ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
