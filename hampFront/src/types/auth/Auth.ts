import type { ApiResponse } from '@/types/Common';

/** 토큰 응답 데이터 */
export interface TokenResponse {
  accessToken: string;
}

/** 토큰 응답 API 최종 타입 */
export type ApiResponseTokenResponse = ApiResponse<TokenResponse>;

/** 로그인 요청 */
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
  createdAt: string;
}

/** 비밀번호 변경 요청 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** 권한 그룹 응답 */
export interface AuthGroupResponse {
  authId: string;
  authNm: string;
  authDesc: string;
}


/** 로그인 API 최종 응답 타입 */
export type ApiResponseLoginResponse = ApiResponse<LoginResponse>;

/** 권한 그룹 리스트 최종 응답 타입 */
export type ApiResponseListAuthGroupResponse = ApiResponse<AuthGroupResponse[]>;
