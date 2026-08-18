import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 부서 등록 요청 */
export interface DepartmentCreateRequest {
  depCode: string;
  taskDesc?: string | null;
  head?: string | null;
  headPhone?: string | null;
}

/** 부서 정보 수정 요청 */
export interface DepartmentUpdateRequest {
  taskDesc?: string | null;
  head?: string | null;
  headPhone?: string | null;
}

/** 부서 정보 응답 */
export interface DepartmentResponse {
  depCode: string;
  taskDesc: string;
  head: string;
  headPhone: string;
  createdAt: string;
  updatedAt: string;
}

/** 부서 옵션 조회 응답 */
export interface DepartmentOptionResponse {
  depCode: string;
  taskDesc: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 부서 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseDepartmentResponse = ApiResponse<DepartmentResponse>;

/** 부서 목록 페이징 데이터 타입 */
export type PageDepartmentResponse = PageResponse<DepartmentResponse>;

/** 부서 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageDepartmentResponse = ApiResponsePage<DepartmentResponse>;

/** 부서 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListDepartmentOptionResponse = ApiResponse<DepartmentOptionResponse[]>;

// ── 부서 관리 API 함수 ────────────────────────────────────────────────────────

export const DepartmentApi = {
  /** 부서 목록 조회 */
  getList: async (params?: {
    depCode?: string;
    taskDesc?: string;
    head?: string;
    headPhone?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageDepartmentResponse> => {
    const res = await apiClient.get<ApiResponsePageDepartmentResponse>('/departments', { params });
    return res.data;
  },

  /** 부서 단건 상세 조회 */
  getDetail: async (depCode: string): Promise<ApiResponseDepartmentResponse> => {
    const res = await apiClient.get<ApiResponseDepartmentResponse>(`/departments/${depCode}`);
    return res.data;
  },

  /** 부서 등록 */
  create: async (data: DepartmentCreateRequest): Promise<ApiResponseDepartmentResponse> => {
    const res = await apiClient.post<ApiResponseDepartmentResponse>('/departments', data);
    return res.data;
  },

  /** 부서 수정 */
  update: async (depCode: string, data: DepartmentUpdateRequest): Promise<ApiResponseDepartmentResponse> => {
    const res = await apiClient.put<ApiResponseDepartmentResponse>(`/departments/${depCode}`, data);
    return res.data;
  },

  /** 부서 삭제 */
  delete: async (depCode: string): Promise<ApiResponse<string>> => {
    const res = await apiClient.delete<ApiResponse<string>>(`/departments/${depCode}`);
    return res.data;
  },

  /** 부서 셀렉트 옵션 조회 */
  getOptions: async (): Promise<ApiResponseListDepartmentOptionResponse> => {
    const res = await apiClient.get<ApiResponseListDepartmentOptionResponse>('/departments/options');
    return res.data;
  },
};