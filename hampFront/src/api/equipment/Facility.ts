import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, AttachmentResponse, PageResponse } from '@/api/Common';

/** 종류 (0: 정지, 1: 작동, 2: 고장) */
export type StatusType = 0 | 1 | 2;

/** 종류 매핑 라벨 (화면 표시용) */
export const STATUS_TYPE_LABEL: Record<StatusType, string> = {
    0: '정지',
    1: '작동',
    2: '고장'
} as const;

export const STATUS_TONE: Record<StatusType, 'good' | 'warn' | 'danger'> = {
  0: 'danger',
  1: 'good',
  2: 'warn',
} as const;

/** 설비 등록 요청 */
export interface FacilityCreateRequest {
    fcltCode: string;
    eqCode?: string | null;
    facCode?: string | null;
    fcltNm?: string | null;
    currentStatus?: StatusType | null;
    useYn?: boolean | null;
}

/** 설비 정보 수정 요청 */
export interface FacilityUpdateRequest {
    eqCode?: string | null;
    facCode?: string | null;
    fcltNm?: string | null;
    currentStatus?: StatusType | null;
    useYn?: boolean | null;
}

/** 설비 정보 응답 */
export interface FacilityResponse {
    fcltCode: string;
    eqNm: string;
    facNm: string;
    fcltNm: string;
    currentStatus: StatusType;
    useYn: boolean;
    createdAt: string;
    updatedAt: string;
}

/** 설비 상세 정보 응답 */
export interface FacilityDetailRespons {
    fcltCode: string;
    eqCode: string;
    eqNm: string;
    eqType: string;
    facCode: string;
    facNm: string;
    location: string;
    fcltNm: string;
    currentStatus: StatusType;
    useYn: boolean;
    createdAt: string;
    updatedAt: string;
    attachments: AttachmentResponse[];
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 설비 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseFacilityResponse = ApiResponse<FacilityResponse>;

/** 설비 상세 조회 API 최종 응답 타입 */
export type ApiResponseFacilityDetailResponse = ApiResponse<FacilityDetailRespons>;

/** 설비 목록 페이징 데이터 타입 */
export type PageFacilityResponse = PageResponse<FacilityResponse>;

/** 설비 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageFacilityResponse = ApiResponsePage<FacilityResponse>;

// ── 설비 관리 API 함수 ────────────────────────────────────────────────────────

export const FacilityApi = {
  /** 설비 목록 조회 */
  getList: async (params?: {
    fcltNm?: string;
    eqCode?: string;
    currentStatus?: StatusType;
    facCode?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageFacilityResponse> => {
    const res = await apiClient.get('/facilities', { params });
    return res.data;
  },

  /** 설비 단건 상세 조회 */
  getDetail: async (fcltCode: string): Promise<ApiResponseFacilityDetailResponse> => {
    const res = await apiClient.get(`/facilities/${fcltCode}`)
    return res.data;
  },

  /** 설비 등록 */
  create: async (data: FacilityCreateRequest): Promise<ApiResponseFacilityResponse> => {
    const res = await apiClient.post('/facilities', data)
    return res.data;
  },

  /** 설비 수정 */
  update: async (fcltCode: string, data: FacilityUpdateRequest): Promise<ApiResponseFacilityResponse> => {
    const res = await apiClient.put(`/facilities/${fcltCode}`, data)
    return res.data;
  },

  /** 설비 삭제 */
  delete: async (fcltCode: string): Promise<ApiResponse<string>> => {
    const res = await apiClient.delete(`/facilities/${fcltCode}`)
    return res.data;
  }
};