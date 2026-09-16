import { useState, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { CusTable } from '@/components/table/CusTable'
import { Badge } from '@components/common/Badge'
import '@/components/modal/SalesOrderModal.css'

interface SalesOrderLine {
  id: string
  orderCode: string
  customer: string
  dueDate: string
  itemName: string
  orderQty: number
  remainQty: number
  unit: string
  isClosed: boolean
}

interface SalesOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (line: SalesOrderLine) => void
}

const dummySalesOrderLines: SalesOrderLine[] = [
  { id: '1', orderCode: 'SO-2026-0912', customer: '그린테라 농협', dueDate: '2026-09-20', itemName: '헴프 원료(건조)', orderQty: 800, remainQty: 120, unit: 'KG', isClosed: false },
  { id: '2', orderCode: 'SO-2026-0912', customer: '그린테라 농협', dueDate: '2026-09-20', itemName: 'CBD 오일 원료', orderQty: 150, remainQty: 30, unit: 'KG', isClosed: false },
  { id: '3', orderCode: 'SO-2026-0915', customer: '네이처바이오', dueDate: '2026-09-25', itemName: 'CBD 아이솔레이트 반제품', orderQty: 65, remainQty: 0, unit: 'KG', isClosed: true },
  { id: '4', orderCode: 'SO-2026-0918', customer: '헴프코리아', dueDate: '2026-09-28', itemName: '헴프 오일 반제품', orderQty: 300, remainQty: 50, unit: 'L', isClosed: false },
  { id: '5', orderCode: 'SO-2026-0918', customer: '헴프코리아', dueDate: '2026-09-28', itemName: 'CBD 오일 30ml', orderQty: 5000, remainQty: 500, unit: 'EA', isClosed: false },
  { id: '6', orderCode: 'SO-2026-0921', customer: '오가닉웰니스', dueDate: '2026-10-02', itemName: '헴프 그래놀 완제품', orderQty: 1200, remainQty: 300, unit: 'KG', isClosed: false },
  { id: '7', orderCode: 'SO-2026-0921', customer: '오가닉웰니스', dueDate: '2026-10-02', itemName: 'CBDA 캡슐 완제품', orderQty: 8000, remainQty: 800, unit: 'EA', isClosed: false },
  { id: '8', orderCode: 'SO-2026-0925', customer: '그린테라 농협', dueDate: '2026-10-05', itemName: '헴프 원료(건조)', orderQty: 1000, remainQty: 360, unit: 'KG', isClosed: false },
]

export function SalesOrderModal({ isOpen, onClose, onSelect }: SalesOrderModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredLines = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return dummySalesOrderLines
    return dummySalesOrderLines.filter(
      (item) =>
        item.orderCode.toLowerCase().includes(term) ||
        item.customer.toLowerCase().includes(term) ||
        item.itemName.toLowerCase().includes(term)
    )
  }, [searchTerm])

  const columns = useMemo<ColumnDef<SalesOrderLine>[]>(
    () => [
      {
        accessorKey: 'orderCode',
        header: '수주코드',
        cell: ({ row }) => <span className="sales-order-order-code">{row.original.orderCode}</span>,
      },
      {
        accessorKey: 'customer',
        header: '거래처',
        cell: ({ row }) => <span>{row.original.customer}</span>,
      },
      {
        accessorKey: 'dueDate',
        header: '납기일',
        cell: ({ row }) => <span>{row.original.dueDate}</span>,
      },
      {
        accessorKey: 'itemName',
        header: '품목',
        cell: ({ row }) => <span className="sales-order-item-name">{row.original.itemName}</span>,
      },
      {
        accessorKey: 'orderQty',
        header: '주문수량',
        cell: ({ row }) => (
          <div className="sales-order-qty-cell">
            {row.original.orderQty.toLocaleString()} <span className="sales-order-unit">{row.original.unit}</span>
          </div>
        ),
      },
      {
        accessorKey: 'remainQty',
        header: '잔여수량',
        cell: ({ row }) => (
          <div className="sales-order-qty-cell bold">
            {row.original.isClosed ? (
              <Badge tone="danger">마감</Badge>
            ) : (
              <>
                {row.original.remainQty.toLocaleString()} <span className="sales-order-unit">{row.original.unit}</span>
              </>
            )}
          </div>
        ),
      },
      {
        id: 'action',
        header: '관리',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="sales-order-action-cell">
            {!row.original.isClosed ? (
              <button
                type="button"
                className="sales-order-select-btn"
                onClick={() => {
                  onSelect(row.original)
                  onClose()
                }}
              >
                선택
              </button>
            ) : (
              <span className="sales-order-closed-dash">-</span>
            )}
          </div>
        ),
        meta: { width: '80px' },
      },
    ],
    [onSelect, onClose]
  )

  if (!isOpen) return null

  return (
    <div className="sales-order-modal-overlay">
      <div className="sales-order-modal-container">
        {/* 헤더 영역 */}
        <div className="sales-order-modal-header">
          <div>
            <h2 className="sales-order-modal-title">수주라인 선택</h2>
            <p className="sales-order-modal-subtitle">수주코드·거래처·품목명으로 검색할 수 있어요. 잔여수량이 없는 라인은 선택할 수 없습니다.</p>
          </div>
          <button type="button" onClick={onClose} className="sales-order-modal-close-btn">
            ✕
          </button>
        </div>

        {/* 검색 인풋 영역 */}
        <div className="sales-order-search-wrapper">
          <input
            type="text"
            placeholder="예: SO-2026-0918, 헴프코리아, CBD 오일"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sales-order-search-input"
          />
        </div>

        {/* 테이블 영역 */}
        <div className="sales-order-table-container">
          <CusTable
            data={filteredLines}
            columns={columns}
            noDataMessage="검색 결과가 없습니다."
            onRowClick={(row) => {
              if (!row.isClosed) {
                onSelect(row)
                onClose()
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}