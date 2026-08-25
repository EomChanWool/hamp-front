import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';
import type { AuthGroupDetailResponse } from './auth/Auth';

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
  userNm?: string | null;
  phone?: string | null;
  position?: string | null;
  authIds?: string[] | null;
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
  authGroups: AuthGroupDetailResponse[];
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

// ── 회원 관리 API 함수 ────────────────────────────────────────────────────────

export const UserApi = {
  /** 회원 목록 조회 */
  getList: async (params?: {
    userId?: string;
    userNm?: string;
    userDep?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageUserResponse> => {
    const res = await apiClient.get<ApiResponsePageUserResponse>('/users', { params });
    return res.data;
  },

  /** 회원 단건 상세 조회 */
  getDetail: async (userId: string): Promise<ApiResponseUserDetailResponse> => {
    const res = await apiClient.get<ApiResponseUserDetailResponse>(`/users/${userId}`);
    return res.data;
  },

  /** 회원 생성 */
  create: async (data: UserCreateRequest): Promise<ApiResponseUserResponse> => {
    const res = await apiClient.post<ApiResponseUserResponse>('/users', data);
    return res.data;
  },

  /** 회원 정보 수정 */
  update: async (userId: string, data: UserUpdateRequest): Promise<ApiResponseUserResponse> => {
    const res = await apiClient.put<ApiResponseUserResponse>(`/users/${userId}`, data);
    return res.data;
  },

  /** 회원 비활성화 (소프트 삭제) */
  delete: async (userId: string): Promise<ApiResponse<string>> => {
    const res = await apiClient.delete<ApiResponse<string>>(`/users/${userId}`);
    return res.data;
  },
};