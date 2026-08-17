import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

/** 불량 등록 요청 */
export interface DefectCreateRequest {
  defCode: string;          
  operCode?: string | null;  
  defNm?: string | null;     
  defType?: string | null;   
  severity?: string | null; 
}

/** 불량 정보 수정 요청 */
export interface DefectUpdateRequest {
  operCode?: string | null;  
  defNm?: string | null;     
  defType?: string | null;   
  severity?: string | null;  
}

/** 불량 목록 조회 아이템 응답 */
export interface DefectResponse {
  defCode: string;
  operCode: string;
  defNm: string;
  defType: string;
  severity: string;
  useYn: string;
  createdAt: string;
  updatedAt: string; 
}

/** 불량 상세 조회 응답 */
export interface DefectDetailResponse {
  defCode: string;
  operCode: string;
  operNm: string;
  depCode: string;
  taskDesc: string;
  head: string;
  defNm: string;
  defType: string;
  severity: string;
  useYn: string;
  createdAt: string; 
  updatedAt: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 불량 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseDefectResponse = ApiResponse<DefectResponse>;

/** 불량 상세 조회 API 최종 응답 타입 */
export type ApiResponseDefectDetailResponse = ApiResponse<DefectDetailResponse>;

/** 불량 목록 페이징 데이터 타입 */
export type PageDefectResponse = PageResponse<DefectResponse>;

/** 불량 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageDefectResponse = ApiResponsePage<DefectResponse>;

// ── 불량 관리 API 함수 ────────────────────────────────────────────────────────

export const DefectApi = {
  /** 불량 목록 조회 */
  getList: async (params?: {
    defCode?: string;
    operCode?: string;
    defNm?: string;
    defType?: string;
    severity?: string;
    useYn?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageDefectResponse> => {
    const res = await apiClient.get('/defects', { params });
    return res.data;
  },

  /** 불량 단건 상세 조회 */
  getDetail: (defCode: string): Promise<ApiResponseDefectDetailResponse> =>
    apiClient.get(`/defects/${defCode}`),

  /** 불량 등록 */
  create: (data: DefectCreateRequest): Promise<ApiResponseDefectResponse> =>
    apiClient.post('/defects', data),

  /** 불량 수정 */
  update: (defCode: string, data: DefectUpdateRequest): Promise<ApiResponseDefectResponse> =>
    apiClient.put(`/defects/${defCode}`, data),

  /** 불량 비활성화 (소프트 삭제) */
  delete: (defCode: string): Promise<ApiResponse<string>> =>
    apiClient.delete(`/defects/${defCode}`),
};