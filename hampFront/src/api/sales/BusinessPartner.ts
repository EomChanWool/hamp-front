import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 거래처 등록 요청 */
export interface BusinessPartnerCreateRequest {
    bpCode: string;
    bpNm?: string | null;
    ceoNm?: string | null;
    phone?: string | null;
    address?: string | null;
    managerNm?: string | null;
    managerPhone?: string | null;
}

/** 거래처 정보 수정 요청 */
export interface BusinessPartnerUpdateRequest {
    bpNm?: string | null;
    ceoNm?: string | null;
    phone?: string | null;
    address?: string | null;
    managerNm?: string | null;
    managerPhone?: string | null;
}

/** 거래처 목록 조회 아이템 응답 */
export interface BusinessPartnerResponse {
    bpCode: string;
    bpNm: string;
    ceoNm: string;
    phone: string;
    address: string;
    managerNm: string;
    managerPhone: string;
    createdAt: string;
    updatedAt: string;
}

/** 거래처 옵션 조회 응답 */
export interface BusinessPartnerOptionResponse {
    bpCode: string;
    bpNm: string;
}


// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 거래처 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseBusinessPartnerResponse = ApiResponse<BusinessPartnerResponse>;

/** 거래처 목록 페이징 데이터 타입 */
export type PageBusinessPartnerResponse = PageResponse<BusinessPartnerResponse>;

/** 거래처 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageBusinessPartnerResponse = ApiResponsePage<BusinessPartnerResponse>;

/** 거래처 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListBusinessPartnerOptionResponse = ApiResponse<BusinessPartnerOptionResponse[]>;

// ── 거래처 관리 API 함수 ────────────────────────────────────────────────────────

export const BusinessPartnerApi = {
    /** 거래처 목록 조회 */
    getList: async (params?: {
        bpCode?: string;
        bpNm?: string;
        ceoNm?: string;
        page?: number;
        size?: number;
        [key: string]: any;
    }): Promise<ApiResponsePageBusinessPartnerResponse> => {
        const res = await apiClient.get('/business-partners', { params });
        return res.data;
    },

    /** 거래처 단건 상세 조회 */
    getDetail: async (bpCode: string): Promise<ApiResponseBusinessPartnerResponse> => {
        const res = await apiClient.get(`/business-partners/${bpCode}`);
        return res.data;
    },

    /** 거래처 등록 */
    create: async (data: BusinessPartnerCreateRequest): Promise<ApiResponseBusinessPartnerResponse> => {
        const res = await apiClient.post('/business-partners', data);
        return res.data;
    },

    /** 거래처 수정 */
    update: async (bpCode: string, data: BusinessPartnerUpdateRequest): Promise<ApiResponseBusinessPartnerResponse> => {
        const res = await apiClient.put(`/business-partners/${bpCode}`, data);
        return res.data;
    },

    /** 거래처 삭제 */
    delete: async (bpCode: string): Promise<ApiResponse<string>> => {
        const res = await apiClient.delete(`/business-partners/${bpCode}`);
        return res.data;
    },

    /** 거래처 셀렉트 옵션 조회 */
    getOptions: async (): Promise<ApiResponseListBusinessPartnerOptionResponse> => {
        const res = await apiClient.get<ApiResponseListBusinessPartnerOptionResponse>('/business-partners/options');
        return res.data;
    },
};