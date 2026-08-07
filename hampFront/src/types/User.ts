import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

/** 회원 등록(가입) 요청 */
export interface UserCreateRequest {
  userId: string;
  userNm: string;
  phone?: string | null;
  position?: string | null;
  authIds: string[];
}

/** 회원 정보 수정 요청 */
export interface UserUpdateRequest {
  userNm: string;
  phone?: string | null;
  position?: string | null;
  authIds: string[];
}

/** 회원 정보 응답 Data */
export interface UserResponse {
  userId: string;
  userNm: string;
  phone: string;
  position: string;
  use: boolean;
  passwordChanged: boolean;
  createdAt: string;
}

/** 배정된 권한 그룹 항목 (상세 조회용) */
export interface AuthGroupOptionResponse {
  authId: string;
  authNm: string;
}

/** 회원 상세 응답 데이터 타입 */
export interface UserDetailResponse {
  userId: string;
  userNm: string;
  phone: string;
  position: string;
  use: boolean;
  passwordChanged: boolean;
  createdAt: string;
  authGroups: AuthGroupOptionResponse[]; 
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 회원 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseUserResponse = ApiResponse<UserResponse>;

/** 회원 목록 페이징 데이터 타입 */
export type PageUserResponse = PageResponse<UserResponse>;

/** 회원 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageUserResponse = ApiResponsePage<UserResponse>;

/** 회원 상세 조회 API 최종 응답 타입 */
export type ApiResponseUserDetailResponse = ApiResponse<UserDetailResponse>;