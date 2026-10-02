import { apiClient } from '@/api/apiClient';
import type { ApiResponsePage, PageResponse } from '@/api/Common';

export type UserLoginStatus =
  | 'SUCCESS'
  | 'FAIL'
  | 'LOGGED_OUT'
  | 'REPLACED';

/** 사용자 접속기록 정보 응답 Data */
export interface UserLoginResponse {
  loginId: number;
  userId: string;
  ip: string;
  browser: string;
  status?: UserLoginStatus;
  loginAt: string;
  logoutAt: string | null; // 로그아웃 일시 (세션이 아직 안 끝났으면 null)
  note: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 접속기록 목록 페이징 데이터 타입 */
export type PageUserResponse = PageResponse<UserLoginResponse>;

/** 접속기록 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageUserResponse = ApiResponsePage<UserLoginResponse>;

// ── 접속관리 관리 API 함수 ────────────────────────────────────────────────────────

export const UserLoginApi = {
  /** 접속기록 목록 조회 */
  getList: async (params?: {
    userId?: string;
    ip?: string;
    status?: string;
    loginAtFrom?: string;
    loginAtTo?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageUserResponse> => {
    const res = await apiClient.get<ApiResponsePageUserResponse>('/user-logins', { params });
    return res.data;
  }
}