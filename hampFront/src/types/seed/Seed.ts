// 1. 씨드 재고 데이터 타입
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

// 3. 더미 데이터 (개발/테스트용)
export const mockSeedInventory: SeedInventoryRow[] = [
  { id: 1, processDate: '2026-06-14', processType: '입고', itemName: '헴프 오일', quantity: '80', unit: 'kg', manager: '김민준', note: 'mock 재고 처리' },
  { id: 2, processDate: '2026-06-15', processType: '출고', itemName: '헴프 분말', quantity: '95', unit: 'kg', manager: '이서연', note: 'mock 재고 처리' },
  { id: 3, processDate: '2026-06-16', processType: '조정', itemName: '단백질 바', quantity: '110', unit: 'kg', manager: '박지훈', note: 'mock 재고 처리' },
  { id: 4, processDate: '2026-06-17', processType: '입고', itemName: '헴프 음료', quantity: '125', unit: 'kg', manager: '최유진', note: 'mock 재고 처리' },
  { id: 5, processDate: '2026-06-18', processType: '출고', itemName: '씨드 그래놀라', quantity: '140', unit: 'kg', manager: '정도윤', note: 'mock 재고 처리' },
  { id: 6, processDate: '2026-06-19', processType: '조정', itemName: '헴프 캡슐', quantity: '155', unit: 'kg', manager: '한수아', note: 'mock 재고 처리' },
]