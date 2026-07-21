import { apiClient } from "@/api/apiClient";

export interface AccessRequest {
  visitorName: string
  affiliation: string
  zone: string
  purpose: string
  approvalStatus: string
  scheduledAt: string
  category: string
}

export interface AccessRequestSearchParams {
  visitorName?: string
  category?: string
  zone?: string
  approvalStatus?: string
}

const dummyAccessRequests: AccessRequest[] = [
  { visitorName: '김민준', affiliation: '협력사', zone: 'A동 원료실', purpose: '정기점검', approvalStatus: '승인완료', scheduledAt: '2026-06-22 09:20', category: '작업자' },
  { visitorName: '이서연', affiliation: '생산팀', zone: 'B동 생산실', purpose: '원료납품', approvalStatus: '승인대기', scheduledAt: '2026-06-21 10:20', category: '방문자' },
  { visitorName: '박지훈', affiliation: '품질팀', zone: 'C동 포장실', purpose: '품질확인', approvalStatus: '반려', scheduledAt: '2026-06-20 11:20', category: '차량' },
  { visitorName: '최유진', affiliation: '운송사', zone: '품질검사실', purpose: '출하', approvalStatus: '승인완료', scheduledAt: '2026-06-19 12:20', category: '작업자' },
  { visitorName: '정도윤', affiliation: '협력사', zone: '저온창고', purpose: '정기점검', approvalStatus: '승인대기', scheduledAt: '2026-06-18 13:20', category: '방문자' },
  { visitorName: '한수아', affiliation: '생산팀', zone: '출하장', purpose: '원료납품', approvalStatus: '반려', scheduledAt: '2026-06-17 14:20', category: '차량' },
  { visitorName: '오현우', affiliation: '품질팀', zone: 'A동 원료실', purpose: '품질확인', approvalStatus: '승인완료', scheduledAt: '2026-06-16 15:20', category: '작업자' },
  { visitorName: '임하린', affiliation: '운송사', zone: 'B동 생산실', purpose: '출하', approvalStatus: '승인대기', scheduledAt: '2026-06-15 16:20', category: '방문자' },
]

export const fetchAccessRequest = async (params?: AccessRequestSearchParams): Promise<AccessRequest[]> => {
  // 백엔드가 없는 현재: 0.3초 딜레이 후 더미 데이터 필터링 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!params) return resolve(dummyAccessRequests)
      
      const filtered = dummyAccessRequests.filter(
        (user) =>
          (!params.visitorName || user.visitorName.includes(params.visitorName)) &&
          (!params.category || user.category.includes(params.category)) &&
          (!params.zone || user.zone.includes(params.zone)) &&
          (!params.approvalStatus || user.approvalStatus.includes(params.approvalStatus)),
      )
      resolve(filtered)
    }, 300)
  })

  /* 
   백엔드 완료 시 주석 해제할 실제 코드:
  const response = await apiClient.get<AccessRequest[]>('/facility/access-manage', { params })
  return response.data
  */
}

/** 사용자 삭제 */
export const deleteAccessRequest = async (visitorName: string): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.delete(`/facility/access-manage/${visitorName}`)
  return response.data
  */
}

/** 사용자 정보 수정 */
export const updateAccessRequest = async (visitorName: string, data: Partial<AccessRequest>): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.put(`/facility/access-manage/${visitorName}`, data)
  return response.data
  */
}


