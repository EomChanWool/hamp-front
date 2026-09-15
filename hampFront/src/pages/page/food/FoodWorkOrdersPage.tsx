import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { useNavigate } from 'react-router-dom'

interface WorkOrderRow {
  workOrderNo: string
  subTitle: string
  orderCode: string // 연결 수주 코드 추가
  itemName: string // 대표 품목 (상세 연동용)
  items: string[]  // 여러 품목 배지용
  orderedQty: string
  unit: string
  workDate: string
  process: string
  manager: string
  status: '대기' | '진행중' | '완료' | '지연'
}

const dummyWorkOrders: WorkOrderRow[] = [
  { 
    workOrderNo: 'WO-20260908-01', 
    subTitle: '9월 2주차 CBD 원료 라인', 
    orderCode: 'SO-2026-0912',
    itemName: '헴프 원료(건조)', 
    items: ['헴프 원료(건조)', 'CBD 오일 원료'], 
    orderedQty: '600', 
    unit: 'KG', 
    workDate: '2026-09-08', 
    process: '원료투입', 
    manager: '전지윤',
    status: '완료' 
  },
  { 
    workOrderNo: 'WO-20260909-01', 
    subTitle: '반제품 정제 작업', 
    orderCode: 'SO-2026-0915',
    itemName: 'CBD 아이솔레이트 반제품', 
    items: ['CBD 아이솔레이트 반제품'], 
    orderedQty: '65', 
    unit: 'KG', 
    workDate: '2026-09-09', 
    process: '세척', 
    manager: '김도현',
    status: '완료' 
  },
  { 
    workOrderNo: 'WO-20260910-01', 
    subTitle: '반제품 → 오일 전환 공정', 
    orderCode: 'SO-2026-0918',
    itemName: '헴프 오일 반제품', 
    items: ['헴프 오일 반제품'], 
    orderedQty: '210', 
    unit: 'KG', 
    workDate: '2026-09-10', 
    process: '건조', 
    manager: '박서연',
    status: '진행중' 
  },
  { 
    workOrderNo: 'WO-20260911-01', 
    subTitle: '완제품 패키징 라인', 
    orderCode: 'SO-2026-0918',
    itemName: 'CBD 오일 30ml', 
    items: ['CBD 오일 30ml', '헴프 오일 반제품'], 
    orderedQty: '3,040', 
    unit: 'EA', 
    workDate: '2026-09-11', 
    process: '분쇄', 
    manager: '전지윤',
    status: '진행중' 
  },
  { 
    workOrderNo: 'WO-20260911-02', 
    subTitle: '완제품 라인 설비 점검으로 지연', 
    orderCode: 'SO-2026-0921',
    itemName: '헴프 그래놀 완제품', 
    items: ['헴프 그래놀 완제품'], 
    orderedQty: '900', 
    unit: 'BOX', 
    workDate: '2026-09-11', 
    process: '선별', 
    manager: '이하늘',
    status: '지연' 
  },
  { 
    workOrderNo: 'WO-20260912-01', 
    subTitle: '신규 캡슐 생산', 
    orderCode: 'SO-2026-0921',
    itemName: 'CBDA 캡슐 완제품', 
    items: ['CBDA 캡슐 완제품'], 
    orderedQty: '5,000', 
    unit: 'EA', 
    workDate: '2026-09-12', 
    process: '포장', 
    manager: '김도현',
    status: '대기' 
  },
  { 
    workOrderNo: 'WO-20260913-01', 
    subTitle: '원료 배합 작업', 
    orderCode: 'SO-2026-0925, SO-2026-0912',
    itemName: '헴프 원료(건조)', 
    items: ['헴프 원료(건조)', '헴프 원료(건조)'], 
    orderedQty: '840', 
    unit: 'KG', 
    workDate: '2026-09-13', 
    process: '추출', 
    manager: '박서연',
    status: '대기' 
  },
  { 
    workOrderNo: 'WO-20260913-02', 
    subTitle: '다음 주 CBD 캡슐 선반영', 
    orderCode: 'SO-2026-0921',
    itemName: 'CBDA 캡슐 완제품', 
    items: ['CBDA 캡슐 완제품'], 
    orderedQty: '2,200', 
    unit: 'EA', 
    workDate: '2026-09-13', 
    process: '성형', 
    manager: '전지윤',
    status: '대기' 
  },
  { 
    workOrderNo: 'WO-20260914-01', 
    subTitle: '긴급 출고용 오일 생산', 
    orderCode: 'SO-2026-0918',
    itemName: 'CBD 오일 30ml', 
    items: ['CBD 오일 30ml'], 
    orderedQty: '1,500', 
    unit: 'EA', 
    workDate: '2026-09-14', 
    process: '출하', 
    manager: '이하늘',
    status: '진행중' 
  },
]

const PAGE_SIZE = 10

export function FoodWorkOrdersPage() {
  const navigate = useNavigate()
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrderRow[]>(dummyWorkOrders)
  const [page, setPage] = useState(0)

  const workDateStartRef = useRef<HTMLInputElement>(null)
  const workDateEndRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '작업일자', startRef: workDateStartRef, endRef: workDateEndRef },
    { type: 'input', label: '품목명', ref: itemNameRef, name: 'itemName' },
    { type: 'input', label: '상태', ref: statusRef, name: 'status' },
  ]

  // KPI 집계 계산
  const kpiStats = useMemo(() => {
    const total = dummyWorkOrders.length
    const wait = dummyWorkOrders.filter((o) => o.status === '대기').length
    const progress = dummyWorkOrders.filter((o) => o.status === '진행중').length
    const done = dummyWorkOrders.filter((o) => o.status === '완료').length
    const delay = dummyWorkOrders.filter((o) => o.status === '지연').length
    return { total, wait, progress, done, delay }
  }, [])

  const handleSearch = () => {
    const workDateStart = workDateStartRef.current?.value ?? ''
    const workDateEnd = workDateEndRef.current?.value ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    setFilteredWorkOrders(
      dummyWorkOrders.filter(
        (order) =>
          (!workDateStart || order.workDate >= workDateStart) &&
          (!workDateEnd || order.workDate <= workDateEnd) &&
          (!itemName || order.itemName.includes(itemName) || order.subTitle.includes(itemName)) &&
          (!status || order.status.includes(status)),
      ),
    )
  }

  const handleReset = () => {
    ;[workDateStartRef, workDateEndRef, itemNameRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredWorkOrders(dummyWorkOrders)
  }

  useEffect(() => {
    setPage(0)
  }, [filteredWorkOrders])

  const totalPages = Math.max(1, Math.ceil(filteredWorkOrders.length / PAGE_SIZE))
  const pagedWorkOrders = filteredWorkOrders.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<WorkOrderRow>[] = useMemo(
    () => [
      {
        accessorKey: 'workOrderNo',
        header: '작업지시코드',
        cell: ({ row }) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 0' }}>
            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{row.original.workOrderNo}</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{row.original.subTitle}</span>
          </div>
        ),
      },
      { accessorKey: 'workDate', header: '작업일자' },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => {
          const value = getValue() as string
          const tone = value === '완료' ? 'good' : value === '진행중' ? 'info' : value === '지연' ? 'danger' : 'muted'
          return <Badge tone={tone}>{value}</Badge>
        },
      },
      {
        accessorKey: 'manager',
        header: '담당자',
        cell: ({ row }) => (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '22px', 
              height: '22px', 
              background: '#e2e8f0', 
              borderRadius: '50%', 
              fontSize: '11px', 
              fontWeight: 600, 
              color: '#475569' 
            }}>
              {row.original.manager.charAt(0)}
            </span>
            <span style={{ fontWeight: 500, color: '#334155' }}>{row.original.manager}</span>
          </div>
        ),
      },
      {
        accessorKey: 'orderCode',
        header: '연결 수주',
        cell: ({ row }) => (
          <span style={{ fontWeight: 500, fontSize: '13px' }}>
            {row.original.orderCode}
          </span>
        ),
      },
      {
        accessorKey: 'items',
        header: '대상 품목',
        cell: ({ row }) => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {row.original.items.map((it, idx) => (
              <span 
                key={idx} 
                style={{ 
                  background: '#f1f5f9', 
                  border: '1px solid #cbd5e1', 
                  color: '#334155', 
                  fontSize: '11px', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontWeight: 500
                }}
              >
                {it}
              </span>
            ))}
          </div>
        ),
      },
      {
        accessorKey: 'orderedQty',
        header: '지시수량 합계',
        cell: ({ row }) => (
          <div style={{ fontWeight: 700, color: '#0f172a' }}>
            {row.original.orderedQty} <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748b' }}>{row.original.unit}</span>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <section className="screenStack" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 이미지와 동일한 인라인 스타일 KPI 그리드 영역 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        {/* 전체 작업지시 */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>전체 작업지시</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
            {kpiStats.total}<span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px', color: '#0f172a' }}>건</span>
          </div>
        </div>

        {/* 대기 */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>대기</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
            {kpiStats.wait}<span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px', color: '#0f172a' }}>건</span>
          </div>
        </div>

        {/* 진행중 */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>진행중</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
            {kpiStats.progress}<span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px', color: '#0f172a' }}>건</span>
          </div>
        </div>

        {/* 완료 */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>완료</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
            {kpiStats.done}<span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px', color: '#0f172a' }}>건</span>
          </div>
        </div>

        {/* 지연 */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>지연</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
            {kpiStats.delay}<span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '2px', color: '#0f172a' }}>건</span>
          </div>
        </div>
      </div>

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel
        title="식품 작업지시관리 목록"
        action="등록"
        onAction={() => navigate('/food/work-order/create')}
      >
        <CusTable 
          data={pagedWorkOrders} 
          columns={columns} 
          onRowClick={(row) => navigate('/food/work-order/detail', { state: { orderData: row } })}
        />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredWorkOrders.length} onPageChange={setPage} />
      </Panel>
    </section>
  )
}