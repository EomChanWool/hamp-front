import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 공정 등록 요청 */
export interface OperationCreateRequest {
  operCode: string;
  depCode: string;
  operNm?: string | null;
  stdTime?: string | null;
}

/** 공정 정보 수정 요청 */
export interface OperationUpdateRequest {
  depCode?: string | null;
  operNm?: string | null;
  stdTime?: string | null;
}

/** 공정 정보 응답 */
export interface OperationResponse {
  operCode: string;
  depCode: string;
  operNm: string;
  useYn: string;
  stdTime: string;
  createdAt: string;
  updatedAt: string;
}

/** 공정 옵션 조회 응답 */
export interface OperationOptionResponse {
  operCode: string;
  operNm: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 공정 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseOperationResponse = ApiResponse<OperationResponse>;

/** 공정 목록 페이징 데이터 타입 */
export type PageOperationResponse = PageResponse<OperationResponse>;

/** 공정 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageOperationResponse = ApiResponsePage<OperationResponse>;

/** 공정 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListOperationOptionResponse = ApiResponse<OperationOptionResponse[]>;

// ── 공정 관리 API 함수 ────────────────────────────────────────────────────────

export const OperationApi = {
  /** 공정 목록 조회 */
  getList: async (params?: {
    operCode?: string;
    depCode?: string;
    operNm?: string;
    useYn?: string;
    stdTime?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageOperationResponse> => {
    const res = await apiClient.get('/operations', { params });
    return res.data;
  },

  /** 공정 단건 상세 조회 */
  getDetail: (operCode: string): Promise<ApiResponseOperationResponse> =>
    apiClient.get(`/operations/${operCode}`),

  /** 공정 등록 */
  create: (data: OperationCreateRequest): Promise<ApiResponseOperationResponse> =>
    apiClient.post('/operations', data),

  /** 공정 수정 */
  update: (operCode: string, data: OperationUpdateRequest): Promise<ApiResponseOperationResponse> =>
    apiClient.put(`/operations/${operCode}`, data),

  /** 공정 비활성화 (소프트 삭제) */
  delete: (operCode: string): Promise<ApiResponse<string>> =>
    apiClient.delete(`/operations/${operCode}`),

  /** 공정 셀렉트 옵션 조회 */
  getOptions: async (): Promise<ApiResponseListOperationOptionResponse> => {
    const res = await apiClient.get('/operations/options');
    return res.data;
  },
};