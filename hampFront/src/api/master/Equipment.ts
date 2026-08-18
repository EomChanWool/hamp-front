import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 장비 등록 요청 */
export interface EquipmentCreateRequest {
  eqCode: string;
  operCode?: string | null;
  eqNm?: string | null;
  eqType?: string | null;
  manufacturer?: string | null;
}

/** 장비 정보 수정 요청 */
export interface EquipmentUpdateRequest {
  operCode?: string | null;
  eqNm?: string | null;
  eqType?: string | null;
  manufacturer?: string | null;
}

/** 장비 정보 응답 */
export interface EquipmentResponse {
  eqCode: string;
  operCode: string;
  eqNm: string;
  eqType: string;
  manufacturer: string;
  createdAt: string;
  updatedAt: string;
}

/** 장비 상세 정보 응답 */
export interface EquipmentDetailResponse {
  eqCode: string;
  operCode: string;
  depCode: string;
  taskDesc: string;
  operNm: string;
  operUseYn: string;
  eqNm: string;
  eqType: string;
  manufacturer: string;
  createdAt: string;
  updatedAt: string;
}

/** 장비 옵션 조회 응답 */
export interface EquipmentOptionResponse {
  eqCode: string;
  eqNm: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 장비 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseEquipmentResponse = ApiResponse<EquipmentResponse>;

/** 장비 상세 조회 API 최종 응답 타입 */
export type ApiResponseEquipmentDetailResponse = ApiResponse<EquipmentDetailResponse>;

/** 장비 목록 페이징 데이터 타입 */
export type PageEquipmentResponse = PageResponse<EquipmentResponse>;

/** 장비 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageEquipmentResponse = ApiResponsePage<EquipmentResponse>;

/** 장비 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListEquipmentOptionResponse = ApiResponse<EquipmentOptionResponse[]>;

// ── 장비 관리 API 함수 ────────────────────────────────────────────────────────

export const EquipmentApi = {
  /** 장비 목록 조회 */
  getList: async (params?: {
    eqCode?: string;
    operCode?: string;
    eqNm?: string;
    eqType?: string;
    manufacturer?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageEquipmentResponse> => {
    const res = await apiClient.get('/equipment', { params });
    return res.data;
  },

  /** 장비 단건 상세 조회 */
  getDetail: (eqCode: string): Promise<ApiResponseEquipmentDetailResponse> => 
    apiClient.get(`/equipment/${eqCode}`),

  /** 장비 등록 */
  create: (data: EquipmentCreateRequest): Promise<ApiResponseEquipmentResponse> => 
    apiClient.post('/equipment', data),

  /** 장비 수정 */
  update: (eqCode: string, data: EquipmentUpdateRequest): Promise<ApiResponseEquipmentResponse> => 
    apiClient.put(`/equipment/${eqCode}`, data),

  /** 장비 삭제 */
  delete: (eqCode: string): Promise<ApiResponse<string>> => 
    apiClient.delete(`/equipment/${eqCode}`),

  /** 장비 셀렉트 옵션 조회 */
  getOptions: (): Promise<ApiResponseListEquipmentOptionResponse> => 
    apiClient.get('/equipment/options'),
};