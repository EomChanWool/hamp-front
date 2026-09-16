import { useState, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { CusTable } from '@/components/table/CusTable'
import { Badge } from '@/components/common/Badge'
import { type SalesOrderStatusLineResponse } from '@/api/sales/SalesOrder'
import '@/components/modal/SalesOrderModal.css'

interface SalesOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (line: SalesOrderStatusLineResponse) => void
}

// 실제 SalesOrderStatusLineResponse 타입에 맞춘 목업 데이터
const dummySalesOrderLines: SalesOrderStatusLineResponse[] = [
  { salesOrderLineId: 1, orderCode: 'SO-2026-0912', itemCode: 'ITEM-001', itemNm: '헴프 원료(건조)', orderQty: 800, orderAmount: 800000, producedQty: 680, progressRate: 85 },
  { salesOrderLineId: 2, orderCode: 'SO-2026-0912', itemCode: 'ITEM-002', itemNm: 'CBD 오일 원료', orderQty: 150, orderAmount: 150000, producedQty: 120, progressRate: 80 },
  { salesOrderLineId: 3, orderCode: 'SO-2026-0915', itemCode: 'ITEM-003', itemNm: 'CBD 아이솔레이트 반제품', orderQty: 65, orderAmount: 650000, producedQty: 65, progressRate: 100 },
  { salesOrderLineId: 4, orderCode: 'SO-2026-0918', itemCode: 'ITEM-004', itemNm: '헴프 오일 반제품', orderQty: 300, orderAmount: 300000, producedQty: 250, progressRate: 83 },
  { salesOrderLineId: 5, orderCode: 'SO-2026-0918', itemCode: 'ITEM-005', itemNm: 'CBD 오일 30ml', orderQty: 5000, orderAmount: 5000000, producedQty: 4500, progressRate: 90 },
  { salesOrderLineId: 6, orderCode: 'SO-2026-0921', itemCode: 'ITEM-006', itemNm: '헴프 그래놀 완제품', orderQty: 1200, orderAmount: 1200000, producedQty: 900, progressRate: 75 },
  { salesOrderLineId: 7, orderCode: 'SO-2026-0921', itemCode: 'ITEM-007', itemNm: 'CBDA 캡슐 완제품', orderQty: 8000, orderAmount: 8000000, producedQty: 7200, progressRate: 90 },
  { salesOrderLineId: 8, orderCode: 'SO-2026-0925', itemCode: 'ITEM-001', itemNm: '헴프 원료(건조)', orderQty: 1000, orderAmount: 1000000, producedQty: 640, progressRate: 64 },
]

export function SalesOrderModal({ isOpen, onClose, onSelect }: SalesOrderModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredLines = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return dummySalesOrderLines
    return dummySalesOrderLines.filter(
      (item) =>
        item.orderCode?.toLowerCase().includes(term) ||
        item.itemCode?.toLowerCase().includes(term) ||
        item.itemNm?.toLowerCase().includes(term)
    )
  }, [searchTerm])

  const columns = useMemo<ColumnDef<SalesOrderStatusLineResponse>[]>(
    () => [
      {
        accessorKey: 'orderCode',
        header: '수주코드',
        cell: ({ row }) => <span className="sales-order-order-code">{row.original.orderCode}</span>,
      },
      {
        accessorKey: 'itemCode',
        header: '품목코드',
        cell: ({ row }) => <span>{row.original.itemCode}</span>,
      },
      {
        accessorKey: 'itemNm',
        header: '품목명',
        cell: ({ row }) => <span className="sales-order-item-name">{row.original.itemNm}</span>,
      },
      {
        accessorKey: 'orderQty',
        header: '주문수량',
        cell: ({ row }) => (
          <div className="sales-order-qty-cell">
            {row.original.orderQty?.toLocaleString()}
          </div>
        ),
      },
      {
        accessorKey: 'producedQty',
        header: '생산완료수량',
        cell: ({ row }) => (
          <div className="sales-order-qty-cell bold">
            {row.original.producedQty?.toLocaleString()}
          </div>
        ),
      },
      {
        accessorKey: 'progressRate',
        header: '진행률',
        cell: ({ row }) => (
          <div>
            {row.original.progressRate >= 100 ? (
              <Badge tone="good">완료 ({row.original.progressRate}%)</Badge>
            ) : (
              <Badge tone="info">{row.original.progressRate}%</Badge>
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
            <p className="sales-order-modal-subtitle">수주코드·품목코드·품목명으로 검색할 수 있어요.</p>
          </div>
          <button type="button" onClick={onClose} className="sales-order-modal-close-btn">
            ✕
          </button>
        </div>

        {/* 검색 인풋 영역 */}
        <div className="sales-order-search-wrapper">
          <input
            type="text"
            placeholder="예: SO-2026-0912, ITEM-001, 헴프 원료"
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
              onSelect(row)
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}