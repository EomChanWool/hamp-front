import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface InpiInventoryTransaction {
  processedAt: string
  transactionType: string
  itemName: string
  quantity: string
  unit: string
  warehouseLocation: string
  manager: string
  note: string
}

const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  입고: '#34d399',
  출고: '#fb7185',
  조정: '#94a3b8',
}

const dummyInventoryTransactions: InpiInventoryTransaction[] = [
  { processedAt: '2026-06-14', transactionType: '입고', itemName: '인피 원면', quantity: '60', unit: 'kg', warehouseLocation: 'A동 원료실', manager: '김민준', note: 'mock 재고 처리' },
  { processedAt: '2026-06-15', transactionType: '출고', itemName: '인피 섬유', quantity: '78', unit: 'kg', warehouseLocation: 'B동 생산실', manager: '이서연', note: 'mock 재고 처리' },
  { processedAt: '2026-06-16', transactionType: '조정', itemName: '인피 매트', quantity: '96', unit: 'kg', warehouseLocation: 'C동 포장실', manager: '박지훈', note: 'mock 재고 처리' },
  { processedAt: '2026-06-17', transactionType: '입고', itemName: '인피 패드', quantity: '114', unit: 'kg', warehouseLocation: '품질검사실', manager: '최유진', note: 'mock 재고 처리' },
  { processedAt: '2026-06-18', transactionType: '출고', itemName: '인피 롤', quantity: '132', unit: 'kg', warehouseLocation: '저온창고', manager: '정도윤', note: 'mock 재고 처리' },
  { processedAt: '2026-06-19', transactionType: '조정', itemName: '인피 보드', quantity: '150', unit: 'kg', warehouseLocation: '출하장', manager: '한수아', note: 'mock 재고 처리' },
]

const PAGE_SIZE = 10

export function InpiInventoryManagePage() {
  const [filteredTransactions, setFilteredTransactions] = useState<InpiInventoryTransaction[]>(dummyInventoryTransactions)
  const [modalTransaction, setModalTransaction] = useState<InpiInventoryTransaction | null>(null)
  const [page, setPage] = useState(0)

  const processedStartRef = useRef<HTMLInputElement>(null)
  const processedEndRef = useRef<HTMLInputElement>(null)
  const transactionTypeRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '처리', startRef: processedStartRef, endRef: processedEndRef },
    { type: 'input', label: '처리구분', ref: transactionTypeRef },
    { type: 'input', label: '품목명', ref: itemNameRef },
  ]

  const handleSearch = () => {
    const start = processedStartRef.current?.value ?? ''
    const end = processedEndRef.current?.value ?? ''
    const transactionType = transactionTypeRef.current?.value.trim() ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''

    // 현재는 더미재고처리에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredTransactions(
      dummyInventoryTransactions.filter((transaction) => {
        const date = transaction.processedAt.slice(0, 10)
        return (
          (!start || date >= start) &&
          (!end || date <= end) &&
          (!transactionType || transaction.transactionType.includes(transactionType)) &&
          (!itemName || transaction.itemName.includes(itemName))
        )
      }),
    )
  }

  const handleReset = () => {
    ;[processedStartRef, processedEndRef, transactionTypeRef, itemNameRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredTransactions(dummyInventoryTransactions)
  }

  const handleDelete = (transaction: InpiInventoryTransaction) => {
    if (window.confirm(`${transaction.processedAt} ${transaction.itemName} 재고 처리 건을 삭제할까요?`)) {
      setFilteredTransactions((prev) => prev.filter((t) => t !== transaction))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredTransactions((prev) => prev.map((t) => (t === modalTransaction ? ({ ...t, ...updated } as InpiInventoryTransaction) : t)))
    setModalTransaction(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredTransactions])

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE))
  const pagedTransactions = filteredTransactions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<InpiInventoryTransaction>[] = useMemo(
    () => [
      { accessorKey: 'processedAt', header: '처리일자' },
      {
        accessorKey: 'transactionType',
        header: '처리구분',
        cell: ({ getValue }) => {
          const value = getValue() as string
          const color = TRANSACTION_TYPE_COLORS[value]
          return color ? <span style={{ color, fontWeight: 600 }}>{value}</span> : value
        },
      },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'quantity', header: '수량' },
      { accessorKey: 'unit', header: '단위' },
      { accessorKey: 'warehouseLocation', header: '창고위치' },
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
                setModalTransaction(row.original)
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
    { label: '처리일자', key: 'processedAt' },
    { label: '처리구분', key: 'transactionType' },
    { label: '품목명', key: 'itemName' },
    { label: '수량', key: 'quantity' },
    { label: '단위', key: 'unit' },
    { label: '창고위치', key: 'warehouseLocation' },
    { label: '담당자', key: 'manager' },
    { label: '비고', key: 'note' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="인피 재고관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedTransactions} columns={columns} onRowClick={setModalTransaction} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredTransactions.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalTransaction !== null}
        onClose={() => setModalTransaction(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalTransaction ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
