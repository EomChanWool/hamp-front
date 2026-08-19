import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 수주 등록 요청 */
export interface SalesOrderCreateRequest {
    orderCode: string;
    bpCode: string;
    dueDate?: string | null;
    status?: string | null;
    note?: string | null;
    lines?: SalesOrderLineRequest[];
}

/** 수주 정보 수정 요청 */
export interface SalesOrderUpdateRequest {
    bpCode: string;
    dueDate?: string | null;
    status?: string | null;
    note?: string | null;
    lines?: SalesOrderLineRequest[]; 
}

/** 수주 목록 조회 아이템 응답 */
export interface SalesOrderResponse {
    orderCode: string;
    bpCode: string;
    bpNm: string;
    dueDate: string;
    status: string;
    note: string;
    createdAt: string;
    updatedAt: string;
}

/** 수주 상세 조회 응답 */
export interface SalesOrderDetailResponse {
    orderCode: string;
    bpCode: string;
    bpNm: string;
    dueDate: string;
    status: string;
    note: string;
    createdAt: string;
    updatedAt: string;
    lines: SalesOrderLineResponse[];
}

/** 수주라인 등록 요청 */
export interface SalesOrderLineRequest {
    itemCode: string;
    orderQty: number;
    orderAmount: number;
}

/** 수주라인 등록 응답 */
export interface SalesOrderLineResponse {
    salesOrderLineId: number;
    orderCode: string;
    itemCode: string;
    itemNm: string;
    orderQty: number;
    orderAmount: number;
    createdAt: string;
    updatedAt: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 수주 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseSalesOrderResponse = ApiResponse<SalesOrderResponse>;

/** 수주 상세 조회 API 최종 응답 타입 */
export type ApiResponseSalesOrderDetailResponse = ApiResponse<SalesOrderDetailResponse>;

/** 수주 목록 페이징 데이터 타입 */
export type PageSalesOrderResponse = PageResponse<SalesOrderResponse>;

/** 수주 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageSalesOrderResponse = ApiResponsePage<SalesOrderResponse>;

// ── 수주 관리 API 함수 ────────────────────────────────────────────────────────

export const SalesOrderApi = {
    /** 수주 목록 조회 */
    getList: async (params?: {
        orderCode?: string;
        bpCode?: string;
        status?: string;
        dueDate?: string;
        page?: number;
        size?: number;
        [key: string]: any;
    }): Promise<ApiResponsePageSalesOrderResponse> => {
        const res = await apiClient.get('/sales-orders', { params });
        return res.data;
    },

    /** 수주 단건 상세 조회 */
    getDetail: async (orderCode: string): Promise<ApiResponseSalesOrderDetailResponse> => {
        const res = await apiClient.get(`/sales-orders/${orderCode}`);
        return res.data;
    },

    /** 수주 등록 */
    create: async (data: SalesOrderCreateRequest): Promise<ApiResponseSalesOrderResponse> => {
        const res = await apiClient.post('/sales-orders', data);
        return res.data;
    },

    /** 수주 수정 */
    update: async (orderCode: string, data: SalesOrderUpdateRequest): Promise<ApiResponseSalesOrderResponse> => {
        const res = await apiClient.put(`/sales-orders/${orderCode}`, data);
        return res.data;
    },

    /** 수주 삭제 */
    delete: async (orderCode: string): Promise<ApiResponse<string>> => {
        const res = await apiClient.delete(`/sales-orders/${orderCode}`);
        return res.data;
    }
};