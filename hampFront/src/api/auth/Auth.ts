import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';
import type { MenuPermissionRequest, MenuPermissionResponse } from '@/api/Menu';

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

/** 권한 그룹 응답 (리스트용 및 생성/수정 응답) */
export interface AuthGroupResponse {
  authId: string;
  authNm: string;
  authDesc: string;
  userCount: number;
}

/** 권한 그룹 옵션 응답 데이터 */
export interface AuthGroupOptionResponse {
  authId: string;
  authNm: string;
}

/** 권한 그룹 생성 요청 */
export interface AuthGroupCreateRequest {
  authId: string;
  authNm: string;
  authDesc?: string;
  menuPermissions: MenuPermissionRequest[];
}

/** 권한 그룹 수정 요청 */
export interface AuthGroupUpdateRequest {
  authNm: string;
  authDesc?: string;
  menuPermissions: MenuPermissionRequest[];
}

/** 권한 그룹 상세 응답 데이터 */
export interface AuthGroupDetailResponse {
  authId: string;
  authNm: string;
  authDesc: string;
  menuPermissions: MenuPermissionResponse[];
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 로그인 API 최종 응답 타입 */
export type ApiResponseLoginResponse = ApiResponse<LoginResponse>;

/** 권한 그룹 단건 응답 타입 */
export type ApiResponseAuthGroupResponse = ApiResponse<AuthGroupResponse>;

/** 권한 그룹 리스트 최종 응답 타입 */
export type ApiResponseListAuthGroupResponse = ApiResponse<AuthGroupResponse[]>;

/** 권한 그룹 옵션 리스트 최종 응답 타입 */
export type ApiResponseListAuthGroupOptionResponse = ApiResponse<AuthGroupOptionResponse[]>;

/** 권한 그룹 상세 응답 타입 */
export type ApiResponseAuthGroupDetailResponse = ApiResponse<AuthGroupDetailResponse>;

// ── 인증 및 권한 그룹 관리 API 함수 ──────────────────────────────────────────

export const AuthApi = {
  /** 로그인 */
  login: async (data: LoginRequest): Promise<ApiResponseLoginResponse> => {
    const res = await apiClient.post('/auth/login', data);
    return res.data;
  },

  /** 로그아웃 */
  logout: async (): Promise<ApiResponse<string>> => {
    const res = await apiClient.post('/auth/logout');
    return res.data;
  },

  /** 토큰 재발급 */
  refresh: async (): Promise<ApiResponseTokenResponse> => {
    const res = await apiClient.post('/auth/refresh');
    return res.data;
  },

  /** 비밀번호 변경 */
  changePassword: async (data: ChangePasswordRequest): Promise<ApiResponseTokenResponse> => {
    const res = await apiClient.post('/auth/change-password', data);
    return res.data;
  },
};

export const AuthGroupApi = {
  /** 권한 그룹 목록 조회 */
  getList: async (params?: {
    authId?: string;
    authNm?: string;
    [key: string]: any;
  }): Promise<ApiResponseListAuthGroupResponse> => {
    const res = await apiClient.get('/auth-groups', { params });
    return res.data;
  },

  /** 권한 그룹 단건 상세 조회 */
  getDetail: async (authId: string): Promise<ApiResponseAuthGroupDetailResponse> => {
    const res = await apiClient.get(`/auth-groups/${authId}`);
    return res.data;
  },

  /** 권한 그룹 생성 */
  create: async (data: AuthGroupCreateRequest): Promise<ApiResponseAuthGroupResponse> => {
    const res = await apiClient.post('/auth-groups', data);
    return res.data;
  },

  /** 권한 그룹 수정 */
  update: async (authId: string, data: AuthGroupUpdateRequest): Promise<ApiResponseAuthGroupResponse> => {
    const res = await apiClient.put(`/auth-groups/${authId}`, data);
    return res.data;
  },

  /** 권한 그룹 삭제 */
  delete: async (authId: string): Promise<ApiResponse<string>> => {
    const res = await apiClient.delete(`/auth-groups/${authId}`);
    return res.data;
  },

  /** 권한 그룹 셀렉트 옵션 조회 */
  getOptions: async (): Promise<ApiResponseListAuthGroupOptionResponse> => {
    const res = await apiClient.get('/auth-groups/options');
    return res.data;
  },
};