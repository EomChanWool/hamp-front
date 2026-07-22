import { apiClient } from "@/api/apiClient";

export interface InpiInventoryTransaction {
  processedAt: string
  transactionType: string
  itemName: string
  quantity: string
  unit: string
  warehouseLocation: string
  manager: string
  note: string
}

export interface InpiInventorySearchParam {
  start?: string
  end?: string
  transactionType?: string
  itemName?: string
}

const dummyInventoryTransactions: InpiInventoryTransaction[] = [
  { processedAt: '2026-06-14', transactionType: '입고', itemName: '인피 원면', quantity: '60', unit: 'kg', warehouseLocation: 'A동 원료실', manager: '김민준', note: 'mock 재고 처리' },
  { processedAt: '2026-06-15', transactionType: '출고', itemName: '인피 섬유', quantity: '78', unit: 'kg', warehouseLocation: 'B동 생산실', manager: '이서연', note: 'mock 재고 처리' },
  { processedAt: '2026-06-16', transactionType: '조정', itemName: '인피 매트', quantity: '96', unit: 'kg', warehouseLocation: 'C동 포장실', manager: '박지훈', note: 'mock 재고 처리' },
  { processedAt: '2026-06-17', transactionType: '입고', itemName: '인피 패드', quantity: '114', unit: 'kg', warehouseLocation: '품질검사실', manager: '최유진', note: 'mock 재고 처리' },
  { processedAt: '2026-06-18', transactionType: '출고', itemName: '인피 롤', quantity: '132', unit: 'kg', warehouseLocation: '저온창고', manager: '정도윤', note: 'mock 재고 처리' },
  { processedAt: '2026-06-19', transactionType: '조정', itemName: '인피 보드', quantity: '150', unit: 'kg', warehouseLocation: '출하장', manager: '한수아', note: 'mock 재고 처리' },
]

export const fetchInpiInventory = async (params?: InpiInventorySearchParam): Promise<InpiInventoryTransaction[]> => {
  // 백엔드가 없는 현재: 0.3초 딜레이 후 더미 데이터 필터링 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!params) return resolve(dummyInventoryTransactions)

      const filtered = dummyInventoryTransactions.filter(
        (inventory) =>
          (!params.start || inventory.processedAt >= params.start) &&
          (!params.end || inventory.processedAt <= params.end) &&
          (!params.transactionType || inventory.transactionType.includes(params.transactionType)) &&
          (!params.itemName || inventory.itemName.includes(params.itemName)),
      )
      resolve(filtered)
    }, 300)
  })

  /* 
   백엔드 완료 시 주석 해제할 실제 코드:
  const response = await apiClient.get<InpiInventoryTransaction[]>('/inpi/inv-manage', { params })
  return response.data
  */
}

/** 사용자 삭제 */
export const deleteInpiInventory = async (itemName: string): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.delete(`/inpi/inv-manage/${itemName}`)
  return response.data
  */
}

/** 사용자 정보 수정 */
export const updateInpiInventory = async (itemName: string, data: Partial<InpiInventoryTransaction>): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.put(`/inpi/inv-manage/${itemName}`, data)
  return response.data
  */
}