import { apiClient } from '@/api/apiClient'

// 1. 타입 정의
export interface SeedInventoryRow {
  id?: number | string 
  processDate: string
  processType: string
  itemName: string
  quantity: string
  unit: string
  manager: string
  note: string
}

// 2. 검색 조건 타입
export interface SeedInventorySearchParams {
  startDate?: string
  endDate?: string
  processType?: string
  itemName?: string
}

// 3. 더미 데이터
const mockSeedInventory: SeedInventoryRow[] = [
  { id: 1, processDate: '2026-06-14', processType: '입고', itemName: '헴프 오일', quantity: '80', unit: 'kg', manager: '김민준', note: 'mock 재고 처리' },
  { id: 2, processDate: '2026-06-15', processType: '출고', itemName: '헴프 분말', quantity: '95', unit: 'kg', manager: '이서연', note: 'mock 재고 처리' },
  { id: 3, processDate: '2026-06-16', processType: '조정', itemName: '단백질 바', quantity: '110', unit: 'kg', manager: '박지훈', note: 'mock 재고 처리' },
  { id: 4, processDate: '2026-06-17', processType: '입고', itemName: '헴프 음료', quantity: '125', unit: 'kg', manager: '최유진', note: 'mock 재고 처리' },
  { id: 5, processDate: '2026-06-18', processType: '출고', itemName: '씨드 그래놀라', quantity: '140', unit: 'kg', manager: '정도윤', note: 'mock 재고 처리' },
  { id: 6, processDate: '2026-06-19', processType: '조정', itemName: '헴프 캡슐', quantity: '155', unit: 'kg', manager: '한수아', note: 'mock 재고 처리' },
]

// 4. API 서비스 함수

/** 씨드 재고 목록 조회 */
export const fetchSeedInventory = async (params?: SeedInventorySearchParams): Promise<SeedInventoryRow[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!params) return resolve(mockSeedInventory)

      const filtered = mockSeedInventory.filter(
        (item) =>
          (!params.startDate || item.processDate >= params.startDate) &&
          (!params.endDate || item.processDate <= params.endDate) &&
          (!params.processType || item.processType.includes(params.processType)) &&
          (!params.itemName || item.itemName.includes(params.itemName)),
      )
      resolve(filtered)
    }, 300)
  })

  /* 백엔드 연동 시:
  const response = await apiClient.get<SeedInventoryRow[]>('/seed/inventory', { params })
  return response.data
  */
}

/** 씨드 재고 내역 삭제 */
export const deleteSeedInventory = async (item: SeedInventoryRow): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 백엔드 연동 시:
  await apiClient.delete(`/seed/inventory/${item.id}`)
  */
}

/** 씨드 재고 내역 수정 */
export const updateSeedInventory = async (item: SeedInventoryRow, data: Partial<SeedInventoryRow>): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 백엔드 연동 시:
  await apiClient.put(`/seed/inventory/${item.id}`, data)
  */
}