import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 작업지시 라인 요청 (등록/수정 시) */
export interface WorkOrderLineRequest {
    salesOrderLineId: number;
    instructQty: number;
}

/** 작업지시 등록 요청 */
export interface WorkOrderCreateRequest {
    workDate: string; // 예: "2026-09-01"
    status?: string | null; // "WAIT" | "PROGRESS" | "DONE" | "DELAY"
    managerId?: string | null;
    lines: WorkOrderLineRequest[];
}

/** 작업지시 정보 수정 요청 */
export interface WorkOrderUpdateRequest {
    workDate?: string | null;
    status?: string | null;
    managerId?: string | null;
    lines: WorkOrderLineRequest[];
}

/** 작업지시 라인 상세 응답 */
export interface WorkOrderLineResponse {
    workOrderLineId: number;
    workId: string;
    salesOrderLineId: number;
    orderCode: string;
    itemCode: string;
    itemNm: string;
    instructQty: number;
    createdAt: string;
    updatedAt: string;
}

/** 작업지시 목록 조회 아이템 응답 (요약 정보 포함) */
export interface WorkOrderResponse {
    workId: string;
    workDate: string;
    status: string;
    managerId: string;
    managerNm: string;
    orderCodes: string[];
    itemNms: string[];
    totalInstructQty: number;
    lineCount: number;
    createdAt: string;
    updatedAt: string;
}

/** 작업지시 단건 상세 조회 응답 (lines 포함) */
export interface WorkOrderDetailResponse {
    workId: string;
    workDate: string;
    status: string;
    managerId: string;
    managerNm: string;
    createdAt: string;
    updatedAt: string;
    lines: WorkOrderLineResponse[];
}

/** 작업지시 상태별 건수 아이템 타입 */
export interface WorkOrderStatusCount {
    status: string; // WAIT / PROGRESS / DONE / DELAY
    count: number;
}

/** 작업지시 상태별 건수 집계 응답 타입 */
export interface WorkOrderStatusSummaryResponse {
    total: number;
    byStatus: WorkOrderStatusCount[];
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 작업지시 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseWorkOrderResponse = ApiResponse<WorkOrderResponse>;

/** 작업지시 상세 조회 API 최종 응답 타입 */
export type ApiResponseWorkOrderDetailResponse = ApiResponse<WorkOrderDetailResponse>;

/** 작업지시 목록 페이징 데이터 타입 */
export type PageWorkOrderResponse = PageResponse<WorkOrderResponse>;

/** 작업지시 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageWorkOrderResponse = ApiResponsePage<WorkOrderResponse>;

/** 작업지시 상태별 건수 집계 API 최종 응답 타입 */
export type ApiResponseWorkOrderStatusSummaryResponse = ApiResponse<WorkOrderStatusSummaryResponse>;

// ── 작업지시 관리 API 함수 ────────────────────────────────────────────────────────

export const WorkOrderApi = {
    /** 작업지시 목록 조회 (페이징 및 검색 조건) */
    getList: async (params?: {
        workId?: string;
        status?: string;
        managerId?: string;
        workDateFrom?: string;
        workDateTo?: string;
        page?: number;
        size?: number;
        sort?: string;
        [key: string]: any;
    }): Promise<ApiResponsePageWorkOrderResponse> => {
        const res = await apiClient.get('/work-orders', { params });
        return res.data;
    },

    /** 작업지시 단건 상세 조회 */
    getDetail: async (workId: string): Promise<ApiResponseWorkOrderDetailResponse> => {
        const res = await apiClient.get(`/work-orders/${workId}`);
        return res.data;
    },

    /** 작업지시 등록 */
    create: async (data: WorkOrderCreateRequest): Promise<ApiResponseWorkOrderResponse> => {
        const res = await apiClient.post('/work-orders', data);
        return res.data;
    },

    /** 작업지시 수정 */
    update: async (workId: string, data: WorkOrderUpdateRequest): Promise<ApiResponseWorkOrderResponse> => {
        const res = await apiClient.put(`/work-orders/${workId}`, data);
        return res.data;
    },

    /** 작업지시 삭제 */
    delete: async (workId: string): Promise<ApiResponse<string>> => {
        const res = await apiClient.delete(`/work-orders/${workId}`);
        return res.data;
    },

    /** 작업지시 상태별 건수 집계 조회 */
    getSummary: async (params?: {
        workId?: string;
        managerId?: string;
        workDateFrom?: string;
        workDateTo?: string;
        [key: string]: any;
    }): Promise<ApiResponseWorkOrderStatusSummaryResponse> => {
        const res = await apiClient.get('/work-orders/summary', { params });
        return res.data;
    },
};