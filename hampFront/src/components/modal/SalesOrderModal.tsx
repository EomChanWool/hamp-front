import { useState, useMemo, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { CusTable } from '@/components/table/CusTable'
import { Badge } from '@/components/common/Badge'
import { SalesOrderApi, type SalesOrderStatusLineResponse } from '@/api/sales/SalesOrder'
import '@/components/modal/SalesOrderModal.css'

interface SalesOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (line: SalesOrderStatusLineResponse) => void
}

export function SalesOrderModal({ isOpen, onClose, onSelect }: SalesOrderModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [data, setData] = useState<SalesOrderStatusLineResponse[]>([])
  const [loading, setLoading] = useState(false)

  // 1. 모달이 열릴 때 전체 데이터 조회 (검색어 변경과 무관하게 한 번만 로드)
  useEffect(() => {
    if (!isOpen) return

    const fetchSalesOrderLines = async () => {
      try {
        setLoading(true)
        // 파라미터 없이 전체 목록 조회
        const res = await SalesOrderApi.getStatusList()

        // ApiResponsePage 구조에 따라 데이터 추출 (res.data.content 등)
        if (res && res.data) {
          setData(res.data.content || [])
        }
      } catch (error) {
        console.error('수주라인 목록 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSalesOrderLines()
  }, [isOpen])

  // 2. 수주코드, 품목코드, 품목명 통합 클라이언트 필터링
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data

    const lowerKeyword = searchTerm.toLowerCase()
    return data.filter((item) => {
      const orderCode = item.orderCode?.toLowerCase() || ''
      const itemCode = item.itemCode?.toLowerCase() || ''
      const itemNm = item.itemNm?.toLowerCase() || ''

      return (
        orderCode.includes(lowerKeyword) ||
        itemCode.includes(lowerKeyword) ||
        itemNm.includes(lowerKeyword)
      )
    })
  }, [data, searchTerm])

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
              onClick={(e) => {
                // 이벤트 버블링 방지 (행 클릭 이벤트가 중복으로 실행되는 것을 막음)
                e.stopPropagation()
                
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

        {/* 테이블 영역 (filteredData 전달) */}
        <div className="sales-order-table-container">
          <CusTable
            data={filteredData}
            columns={columns}
            noDataMessage={loading ? "데이터를 불러오는 중..." : "검색 결과가 없습니다."}
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