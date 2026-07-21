import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

import { fetchInpiInventory, deleteInpiInventory, updateInpiInventory, type InpiInventoryTransaction, type InpiInventorySearchParam } from '@/services/inpi/InpiInventoryManagePage'

const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  입고: '#34d399',
  출고: '#fb7185',
  조정: '#94a3b8',
}

const PAGE_SIZE = 10

export function InpiInventoryManagePage() {
  const [inpiInventory, setInpiInventory] = useState<InpiInventoryTransaction[]>([])
  const [searchParams, setSearchParams] = useState<InpiInventorySearchParam>({})
  const [isLoading, setIsLoading] = useState(false)
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

  const loadInpiInventory = async (params: InpiInventorySearchParam) => {
    setIsLoading(true)
    try {
      const data = await fetchInpiInventory(params)
      setInpiInventory(data)
      setPage(0) // 검색 조건이 바뀌면 페이지를 첫 페이지로 초기화
    } catch (error) {
      console.error(error)
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInpiInventory(searchParams)
  }, [searchParams])

  const handleSearch = () => {
    const params: InpiInventorySearchParam = {
      start: processedStartRef.current?.value.trim(),
      end: processedEndRef.current?.value.trim(),
      transactionType: transactionTypeRef.current?.value.trim(),
      itemName: itemNameRef.current?.value.trim(),
    }
    setSearchParams(params)
  }

  const handleReset = () => {
    ;[processedStartRef, processedEndRef, transactionTypeRef, itemNameRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setSearchParams({})
  }

  const handleDelete = async (transaction: InpiInventoryTransaction) => {
    if (window.confirm(`${transaction.processedAt} ${transaction.itemName} 재고 처리 건을 삭제할까요?`)) {
      try {
        await deleteInpiInventory(transaction.itemName)
        window.alert('삭제되었습니다.')
        loadInpiInventory(searchParams) // 삭제 후 목록 리로드
      } catch (err) {
        window.alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalTransaction) return
    try {
      await updateInpiInventory(modalTransaction.itemName, updated)
      window.alert('저장되었습니다.')
      setModalTransaction(null)
      loadInpiInventory(searchParams)
    } catch (err) {
      window.alert('저장에 실패했습니다.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(inpiInventory.length / PAGE_SIZE))
  const pagedTransactions = inpiInventory.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

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
    [inpiInventory, searchParams],
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
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            <CusTable data={pagedTransactions} columns={columns} onRowClick={setModalTransaction} />
            <CusPagination page={page} totalPages={totalPages} totalCount={inpiInventory.length} onPageChange={setPage} />
          </>
        )}
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
