import { apiClient } from "@/api/apiClient"

// 백엔드가 요청받는 데이터 타입
export interface LoginRequest {
  userId: string
  password: string
}

// 백엔드가 응답해 주는 데이터 타입
export interface LoginResponse {
  accessToken?: string
  token?: string
  // 백엔드에서 반환하는 추가 정보가 있다면 자유롭게 추가 (예: name, role 등)
}

// 로그인 API 호출 함수
export const loginApi = async (credentials: LoginRequest) => {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
  return response.data
}