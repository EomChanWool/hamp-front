import { apiClient } from '@/api/apiClient'

export interface OrderManage {
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

export interface OrderSearchParams {
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

const dummyOrders: OrderManage[] = [
  { client: '(주)거래처A', orderNo: 'ORD-2026001', clientManager: '김영업', productItem: '헴프 오일 500ml', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026002', clientManager: '김영업', productItem: '헴프 분말 1kg', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026003', clientManager: '김영업', productItem: '프리미엄 단백질 바', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026004', clientManager: '김영업', productItem: '유기농 헴프 음료', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-15', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026005', clientManager: '김영업', productItem: '씨드 그래놀라 300g', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026006', clientManager: '김영업', productItem: '고농축 헴프 캡슐', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
]


export const fetchOrders = async (params?: OrderSearchParams): Promise<OrderManage[]> => {
  // 백엔드가 없는 현재: 0.3초 딜레이 후 더미 데이터 필터링 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!params) return resolve(dummyOrders)
      
      const filtered = dummyOrders.filter(
        (order) =>
          (!params.client || order.client.includes(params.client)) &&
          (!params.orderNo || order.orderNo.includes(params.orderNo)) &&
          (!params.clientManager || order.clientManager.includes(params.clientManager)) &&
          (!params.productItem || order.productItem.includes(params.productItem)) &&
          (!params.quantity || order.quantity.includes(params.quantity)) &&
          (!params.orderAmount || order.orderAmount.includes(params.orderAmount)) &&
          (!params.dueDate || order.dueDate.includes(params.dueDate)) &&
          (!params.status || order.status.includes(params.status)) &&
          (!params.manager || order.manager.includes(params.manager)) &&
          (!params.note || order.note.includes(params.note)),

      )
      resolve(filtered)
    }, 300)
  })

  /* 
   백엔드 완료 시 주석 해제할 실제 코드:
  const response = await apiClient.get<OrderRow[]>('/sales/order-manage', { params })
  return response.data
  */
}

/** 수주 삭제 */
export const deleteOrders = async (client: string): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.delete(`/sales/order-manage/${client}`)
  return response.data
  */
}

/** 수주 정보 수정 */
export const updateOrders = async (client: string, data: Partial<OrderManage>): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.put(`/sales/order-manage/${client}`, data)
  return response.data
  */
}