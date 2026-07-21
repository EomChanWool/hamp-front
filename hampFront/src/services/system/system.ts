// src/api/system.ts
import { apiClient } from '@/api/apiClient'

// 1. 타입 정의
export interface SystemUser {
  userId: string
  name: string
  department: string
  position: string
  role: string
  status: '사용' | '미사용'
  lastLoginAt: string
}

// 2. 검색 조건 타입
export interface UserSearchParams {
  userId?: string
  name?: string
  role?: string
  status?: string
}

const mockUsers: SystemUser[] = [
  { userId: 'user001', name: '김민준', department: '생산팀', position: '팀장', role: '시스템관리자', status: '사용', lastLoginAt: '2026-06-22 08:20' },
  { userId: 'user002', name: '이서연', department: '품질팀', position: '매니저', role: '생산관리자', status: '사용', lastLoginAt: '2026-06-21 09:20' },
  { userId: 'user003', name: '박지훈', department: '설비팀', position: '작업자', role: '품질관리자', status: '사용', lastLoginAt: '2026-06-20 10:20' },
  { userId: 'user004', name: '최유진', department: '시스템팀', position: '관리자', role: '설비관리자', status: '사용', lastLoginAt: '2026-06-19 11:20' },
  { userId: 'user005', name: '정도윤', department: '생산팀', position: '팀장', role: '일반작업자', status: '사용', lastLoginAt: '2026-06-18 12:20' },
  { userId: 'user006', name: '한수아', department: '품질팀', position: '매니저', role: '시스템관리자', status: '사용', lastLoginAt: '2026-06-17 13:20' },
  { userId: 'user007', name: '오현우', department: '설비팀', position: '작업자', role: '생산관리자', status: '사용', lastLoginAt: '2026-06-16 14:20' },
  { userId: 'user008', name: '임하린', department: '시스템팀', position: '관리자', role: '품질관리자', status: '사용', lastLoginAt: '2026-06-15 15:20' },
  { userId: 'user009', name: '강태오', department: '생산팀', position: '팀장', role: '설비관리자', status: '미사용', lastLoginAt: '2026-06-14 16:20' },
  { userId: 'user010', name: '윤지아', department: '품질팀', position: '매니저', role: '일반작업자', status: '사용', lastLoginAt: '2026-06-22 08:20' },
  { userId: 'user011', name: '서준호', department: '설비팀', position: '작업자', role: '시스템관리자', status: '사용', lastLoginAt: '2026-06-21 09:20' },
  { userId: 'user012', name: '문채원', department: '시스템팀', position: '관리자', role: '생산관리자', status: '사용', lastLoginAt: '2026-06-20 10:20' },
]

// 3. API 요청 함수들 (백엔드 완성 시 즉시 교체 가능하도록 설계)

/** 사용자 목록 조회 (검색 조건 포함) */
export const fetchSystemUsers = async (params?: UserSearchParams): Promise<SystemUser[]> => {
  // 백엔드가 없는 현재: 0.3초 딜레이 후 더미 데이터 필터링 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!params) return resolve(mockUsers)
      
      const filtered = mockUsers.filter(
        (user) =>
          (!params.userId || user.userId.includes(params.userId)) &&
          (!params.name || user.name.includes(params.name)) &&
          (!params.role || user.role.includes(params.role)) &&
          (!params.status || user.status.includes(params.status)),
      )
      resolve(filtered)
    }, 300)
  })

  /* 
   백엔드 완료 시 주석 해제할 실제 코드:
  const response = await apiClient.get<SystemUser[]>('/system/users', { params })
  return response.data
  */
}

/** 사용자 삭제 */
export const deleteSystemUser = async (userId: string): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.delete(`/system/users/${userId}`)
  return response.data
  */
}

/** 사용자 정보 수정 */
export const updateSystemUser = async (userId: string, data: Partial<SystemUser>): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300))
  /* 
  const response = await apiClient.put(`/system/users/${userId}`, data)
  return response.data
  */
}