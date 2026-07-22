// 백엔드가 요청받는 데이터 타입
export interface LoginRequest {
  userId: string
  password: string
}

// 백엔드가 응답해 주는 데이터 타입
export interface LoginResponse {
  status: string
  message: string | null
  data: {
    accessToken: string
    // 유저 정보가 data 안에 더 들어온다면 여기에 추가
    // userId?: string
    // role?: string
  }
}