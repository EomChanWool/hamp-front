// 로그인 시 요청 데이터 타입
export interface LoginRequest {
  userId: string
  password: string
}

// Api 공통 응답 데이터 타입
export interface ApiResponseLoginResponse {
  status: string
  code: string
  message: string
  data: LoginResponse
}

// 로그인 시 응답 데이터 타입
export interface LoginResponse {
  accessToken: string
  userId: string
  userNm: string
  phone: string
  position: string
  use: boolean
  createdAt: string | Date
}
