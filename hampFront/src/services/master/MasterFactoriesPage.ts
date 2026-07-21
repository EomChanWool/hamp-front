import { apiClient } from "@/api/apiClient";

export interface FactoryRow {
  code: string
  name: string
  location: string
  manager: string
  status: '사용' | '미사용'
  registeredAt: string
  note: string
}

export interface FactorySearchParams {
    code?: string
    name?: string
    manager?: string
    status?: string
}

const dummyFactories: FactoryRow[] = [
  { code: 'FAC-1', name: 'A동 원료실', location: '충북 음성 1구역', manager: '김민준', status: '사용', registeredAt: '2026-01-10', note: '생산/보관 구역' },
  { code: 'FAC-2', name: 'B동 생산실', location: '충북 음성 2구역', manager: '이서연', status: '사용', registeredAt: '2026-01-11', note: '생산/보관 구역' },
  { code: 'FAC-3', name: 'C동 포장실', location: '충북 음성 3구역', manager: '박지훈', status: '사용', registeredAt: '2026-01-12', note: '생산/보관 구역' },
  { code: 'FAC-4', name: '품질검사실', location: '충북 음성 4구역', manager: '최유진', status: '사용', registeredAt: '2026-01-13', note: '생산/보관 구역' },
  { code: 'FAC-5', name: '저온창고', location: '충북 음성 5구역', manager: '정도윤', status: '사용', registeredAt: '2026-01-14', note: '생산/보관 구역' },
  { code: 'FAC-6', name: '출하장', location: '충북 음성 6구역', manager: '한수아', status: '미사용', registeredAt: '2026-01-15', note: '생산/보관 구역' },
]


export const fetchFactories = async (params?: FactorySearchParams): Promise<FactoryRow[]> => {
  // 백엔드가 없는 현재: 0.3초 딜레이 후 더미 데이터 필터링 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!params) return resolve(dummyFactories)
      
      const filtered = dummyFactories.filter(
        (factories) =>
          (!params.code || factories.code.includes(params.code)) &&
          (!params.name || factories.name.includes(params.name)) &&
          (!params.manager || factories.manager.includes(params.manager)) &&
          (!params.status || factories.status.includes(params.status)),
      )
      resolve(filtered)
    }, 300)
  })

  /* 
   백엔드 완료 시 주석 해제할 실제 코드:
  const response = await apiClient.get<FactoryRow[]>('/master/factories', { params })
  return response.data
  */
}

/** 사용자 삭제 */
export const deleteFactories = async (code: string): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.delete(`/master/factories/${code}`)
  return response.data
  */
}

/** 사용자 정보 수정 */
export const updateFactories = async (code: string, data: Partial<FactoryRow>): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.put(`/master/factories/${code}`, data)
  return response.data
  */
}