import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

/** 공장 등록 요청 */
export interface FactoryZoneCreateRequest {
  facCode: string;
  facNm?: string | null;
  location?: string | null;
  note?: string | null;
}

/** 공장 정보 수정 요청 */
export interface FactoryZoneUpdateRequest {
  facNm?: string | null;
  location?: string | null;
  note?: string | null;
}

/** 공장 정보 응답 */
export interface FactoryZoneResponse {
  facCode: string;
  facNm: string;
  location: string;
  useYn: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** 공장 옵션 조회 응답 */
export interface FactoryZoneOptionResponse {
  facCode: string;
  facNm: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 공장 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseFactoryZoneResponse = ApiResponse<FactoryZoneResponse>;

/** 공장 목록 페이징 데이터 타입 */
export type PageFactoryZoneResponse = PageResponse<FactoryZoneResponse>;

/** 공장 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageFactoryZoneResponse = ApiResponsePage<FactoryZoneResponse>;

/** 공장 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListFactoryZoneOptionResponse = ApiResponse<FactoryZoneOptionResponse[]>;

// ── 공장동 관리 API 함수 ────────────────────────────────────────────────────────

export const FactoryZoneApi = {
  /** 공장동 목록 조회 */
  getList: async (params?: {
    facCode?: string;
    facNm?: string;
    location?: string;
    useYn?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageFactoryZoneResponse> => {
    const res = await apiClient.get('/factory-zones', { params });
    return res.data;
  },

  /** 공장동 단건 상세 조회 */
  getDetail: (facCode: string): Promise<ApiResponseFactoryZoneResponse> =>
    apiClient.get(`/factory-zones/${facCode}`),

  /** 공장동 등록 */
  create: (data: FactoryZoneCreateRequest): Promise<ApiResponseFactoryZoneResponse> =>
    apiClient.post('/factory-zones', data),

  /** 공장동 수정 */
  update: (facCode: string, data: FactoryZoneUpdateRequest): Promise<ApiResponseFactoryZoneResponse> =>
    apiClient.put(`/factory-zones/${facCode}`, data),

  /** 공장동 비활성화 (소프트 삭제) */
  delete: (facCode: string): Promise<ApiResponse<string>> =>
    apiClient.delete(`/factory-zones/${facCode}`),

  /** 공장동 셀렉트 옵션 조회 */
  getOptions: (): Promise<ApiResponseListFactoryZoneOptionResponse> =>
    apiClient.get('/factory-zones/options'),
};