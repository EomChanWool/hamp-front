// 1. 수주 데이터 타입
export interface OrderManageRow {
  id?: number | string
  client: string
  orderNo: string
  clientManager: string
  productItem: string
  quantity: string
  orderAmount: string
  dueDate: string
  status: string
  manager: string
  note: string
}

// 2. 검색 조건 타입
export interface OrderManageSearchParams {
  client?: string
  orderNo?: string
  clientManager?: string
  productItem?: string
  quantity?: string
  orderAmount?: string
  dueDate?: string
  status?: string
  manager?: string
  note?: string
}

// 3. 더미 데이터 (개발/테스트용)
export const mockOrderManage: OrderManageRow[] = [
  { id: 1, client: '(주)거래처A', orderNo: 'ORD-2026001', clientManager: '김영업', productItem: '헴프 오일 500ml', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { id: 2, client: '(주)거래처A', orderNo: 'ORD-2026002', clientManager: '김영업', productItem: '헴프 분말 1kg', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { id: 3, client: '(주)거래처A', orderNo: 'ORD-2026003', clientManager: '김영업', productItem: '프리미엄 단백질 바', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { id: 4, client: '(주)거래처A', orderNo: 'ORD-2026004', clientManager: '김영업', productItem: '유기농 헴프 음료', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-15', status: '진행중', manager: '이수주', note: '-' },
  { id: 5, client: '(주)거래처A', orderNo: 'ORD-2026005', clientManager: '김영업', productItem: '씨드 그래놀라 300g', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { id: 6, client: '(주)거래처A', orderNo: 'ORD-2026006', clientManager: '김영업', productItem: '고농축 헴프 캡슐', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
]