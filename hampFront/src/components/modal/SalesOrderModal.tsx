import React, { useState, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { CusTable } from '@/components/table/CusTable'
import { Badge } from '@components/common/Badge'

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

  // TanStack Table 컬럼 정의
  const columns = useMemo<ColumnDef<SalesOrderLine>[]>(
    () => [
      {
        accessorKey: 'orderCode',
        header: '수주코드',
        cell: ({ row }) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{row.original.orderCode}</span>,
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
        cell: ({ row }) => <span style={{ fontWeight: 500 }}>{row.original.itemName}</span>,
      },
      {
        accessorKey: 'orderQty',
        header: '주문수량',
        cell: ({ row }) => (
          <div style={{ textAlign: 'right' }}>
            {row.original.orderQty.toLocaleString()} <span style={{ fontSize: '11px', color: '#64748b' }}>{row.original.unit}</span>
          </div>
        ),
      },
      {
        accessorKey: 'remainQty',
        header: '잔여수량',
        cell: ({ row }) => (
          <div style={{ textAlign: 'right', fontWeight: 600 }}>
            {row.original.isClosed ? (
              <Badge tone="danger">마감</Badge>
            ) : (
              <>
                {row.original.remainQty.toLocaleString()} <span style={{ fontSize: '11px', color: '#64748b' }}>{row.original.unit}</span>
              </>
            )}
          </div>
        ),
      },
      {
        id: 'action',
        header: '관리',
        enableSorting: false, // 관리 컬럼은 정렬 제외
        cell: ({ row }) => (
          <div style={{ textAlign: 'center' }}>
            {!row.original.isClosed ? (
              <button
                type="button"
                style={modalStyles.selectButton}
                onClick={() => {
                  onSelect(row.original)
                  onClose()
                }}
              >
                선택
              </button>
            ) : (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
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
    <div style={modalStyles.overlay}>
      <div style={modalStyles.container}>
        {/* 헤더 영역 */}
        <div style={modalStyles.header}>
          <div>
            <h2 style={modalStyles.title}>수주라인 선택</h2>
            <p style={modalStyles.subtitle}>수주코드·거래처·품목명으로 검색할 수 있어요. 잔여수량이 없는 라인은 선택할 수 없습니다.</p>
          </div>
          <button type="button" onClick={onClose} style={modalStyles.closeButton}>
            ✕
          </button>
        </div>

        {/* 검색 인풋 영역 */}
        <div style={modalStyles.searchWrapper}>
          <input
            type="text"
            placeholder="예: SO-2026-0918, 헴프코리아, CBD 오일"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={modalStyles.searchInput}
          />
        </div>

        {/* CusTable 적용 영역 */}
        <div style={modalStyles.tableContainer}>
          <CusTable
            data={filteredLines}
            columns={columns}
            noDataMessage="검색 결과가 없습니다."
            onRowClick={(row) => {
              // 마감되지 않은 항목은 행 클릭 시에도 선택되도록 편의 기능 추가 (선택사항)
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

// 스타일 객체
const modalStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#ffffff',
    width: '900px',
    maxWidth: '95vw',
    maxHeight: '85vh',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px 16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #f1f5f9',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px',
  },
  searchWrapper: {
    padding: '16px 24px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #f1f5f9',
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#ffffff',
  },
  tableContainer: {
    padding: '16px 24px 24px 24px',
    overflowY: 'auto',
    maxHeight: '500px',
  },
  selectButton: {
    padding: '4px 12px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#334155',
    cursor: 'pointer',
  },
}