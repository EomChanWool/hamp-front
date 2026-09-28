import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';
import type { EquipmentOptionResponse } from '@/api/master/Equipment';

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

/** 작업지시 라인 바코드 스캔 조회 응답의 공정순서도 단계 */
export interface WorkOrderRoutingStepResponse {
    operCode: string;
    operNm: string;
    operSeq: number;
    finalYn: string; // "Y" | "N"
    done: boolean; // 이 작업지시라인에서 이미 종료 처리된 공정인지 (DB 기준)
    inProgress: boolean; // 이 작업지시라인에서 지금 진행 중인 공정인지 (시작O, 종료X) (DB 기준)
    inputQty: number | null; // 이 공정을 시작할 때 기록한 투입수량 (시작 전이면 null)
    equipments: EquipmentOptionResponse[]; // 이 공정용으로 등록된 설비 목록 (실제 사용 설비가 아니라 매칭된 설비)
}

/** 작업지시 라인 바코드 스캔 조회 응답 타입 */
export interface WorkOrderLineScanResponse {
    workId: string;
    workDate: string; // "2026-09-16"
    status: string;
    managerId: string | null;
    managerNm: string | null;
    workOrderLineId: number;
    salesOrderLineId: number;
    orderCode: string;
    bpCode: string | null;
    bpNm: string | null;
    itemCode: string;
    itemNm: string;
    unit: string;
    instructQty: number;
    routingSteps: WorkOrderRoutingStepResponse[];
}

/** 설비 바코드 스캔 결과 - START_READY/FINISH_READY 둘 다 아직 아무것도 기록 안 된 "확인 대기"
 *  상태이고, 태블릿에서 사용자가 진행/종료를 확인해야 각각 startPerformance/finishPerformance로
 *  확정해야 실제로 기록된다 */
export interface WorkOrderPerformanceScanResponse {
    action: 'START_READY' | 'FINISH_READY';
    workOrderLineId: number;
    operCode: string;
    operNm: string;
    operSeq: number;
    perfId: number | null;
}

/** 설비 스캔으로 받은 공정을 투입수량과 함께 시작 확정할 때 보내는 요청 */
export interface WorkOrderPerformanceStartRequest {
    operCode: string;
    qty: number;
}

/** 설비 스캔으로 받은 공정을 종료 확정할 때 보내는 요청 */
export interface WorkOrderPerformanceFinishRequest {
    operCode: string;
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

/** 작업지시 라인 바코드 스캔 조회 API 최종 응답 타입 */
export type ApiResponseWorkOrderLineScanResponse = ApiResponse<WorkOrderLineScanResponse>;

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

    /** 작업지시 라인 바코드 스캔 조회 */
    scan: async (code: string): Promise<ApiResponseWorkOrderLineScanResponse> => {
        const res = await apiClient.get('/work-orders/scan', {
            params: { code },
        });
        return res.data;
    },

    /** 설비 스캔으로 받은 공정을 투입수량과 함께 시작 확정 */
    startPerformance: async (data: WorkOrderPerformanceStartRequest): Promise<ApiResponse<null>> => {
        const res = await apiClient.post('/work-orders/performance/start', data);
        return res.data;
    },

    /** 설비 스캔으로 받은 공정을 종료 확정 */
    finishPerformance: async (data: WorkOrderPerformanceFinishRequest): Promise<ApiResponse<null>> => {
        const res = await apiClient.post('/work-orders/performance/finish', data);
        return res.data;
    },
};