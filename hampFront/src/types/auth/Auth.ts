/** 공통 API 응답 래퍼 인터페이스 */
export interface ApiResponse<T = unknown> {
  status: string;
  code: string;
  message: string;
  data: T;
}

/** 데이터가 없는 공통 API 응답 타입 */
export type ApiResponseVoid = ApiResponse<any>;

/** 토큰 응답 데이터 */
export interface TokenResponse {
  accessToken: string;
}

/** 토큰 응답 API 최종 타입 */
export type ApiResponseTokenResponse = ApiResponse<TokenResponse>;

/** 로그인 요청 Payload */
export interface LoginRequest {
  userId: string;
  password: string;
}

/** 로그인 성공 유저 정보 및 토큰 데이터 */
export interface LoginResponse {
  accessToken: string;
  userId: string;
  userNm: string;
  phone: string;
  position: string;
  use: boolean;
  createdAt: string | Date;
}

/** 로그인 API 최종 응답 타입 */
export type ApiResponseLoginResponse = ApiResponse<LoginResponse>;