import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 수주 등록 요청 */
export interface SalesOrderCreateRequest {
    bpCode: string;
    dueDate?: string | null;
    note?: string | null;
    itemCode?: string | null;
    orderQty?: number | null;
    orderAmount?: number | null;
    lines?: SalesOrderLineRequest[];
}

/** 수주 정보 수정 요청 */
export interface SalesOrderUpdateRequest {
    bpCode: string;
    dueDate?: string | null;
    status?: string | null;
    note?: string | null;
    itemCode?: string | null;
    orderQty?: number | null;
    orderAmount?: number | null;
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
    itemCode: string | null;
    itemNm: string | null;
    unit: string | null;
    orderQty: number | null;
    orderAmount: number | null;
    createdAt: string;
    updatedAt: string;
    lines: SalesOrderLineResponse[];
}

/** 배분 그룹 키 - 원물(탈피씨드) 분기는 RAW, 부산물(헴프박) 재투입 분기는 PARK */
export type SalesOrderAllocationGroup = 'RAW' | 'PARK';

/** 수주라인 등록 요청 */
export interface SalesOrderLineRequest {
    salesOrderLineId?: number;
    itemCode: string;
    allocationGroup: SalesOrderAllocationGroup;
    /** 그룹 내 배분 비율(%, 0~100) - 같은 그룹 라인들의 합이 100이어야 함 */
    allocationPercent: number;
}

/** 수주라인 등록 응답 */
export interface SalesOrderLineResponse {
    salesOrderLineId: number;
    orderCode: string;
    itemCode: string;
    itemNm: string;
    unit: string;
    orderQty: number;
    orderAmount: number;
    /** 예정 산출수량 - 수율이 불확실한 분기는 null */
    planQty: number | null;
    /** 미사용 라인은 null */
    allocationGroup: SalesOrderAllocationGroup | null;
    allocationPercent: number | null;
    /** 배분된 투입량 (RAW=탈피씨드, PARK=건조헴프박 기준) */
    allocatedInputQty: number | null;
    produceQty: number;
    availableQty: number;
    shippedQty: number;
    productionStatus: string;
    createdAt: string;
    updatedAt: string;
}

/** 수주현황 조회 아이템 응답 */
export interface SalesOrderStatusLineResponse {
    salesOrderLineId: number;
    orderCode: string;
    itemCode: string;
    itemNm: string;
    unit: string;
    orderQty: number;
    orderAmount: number;
    producedQty: number;
    progressRate: number;
}

/** 수주현황 그룹별 생산 진행률 응답 */
export interface SalesOrderStatusGroupResponse {
    groupKey: string;
    groupLabel: string;
    lineCount: number;
    totalOrderQty: number;
    totalOrderAmount: number;
    totalProducedQty: number;
    progressRate: number;
}

/** 수주실적현황 기간별 추이 데이터 포인트 응답 */
export interface SalesOrderPerformanceTrendPointResponse {
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    totalOrderQty: number;
    totalProducedQty: number;
    progressRate: number;
}

/** 수주실적현황 기간별 추이 시리즈 응답 */
export interface SalesOrderPerformanceTrendSeriesResponse {
    groupKey: string;
    groupLabel: string;
    points: SalesOrderPerformanceTrendPointResponse[];
}

/** 수주실적현황 KPI 응답 */
export interface SalesOrderPerformanceKpiResponse {
    period: string;
    periodStart: string;
    periodEnd: string;
    totalLineCount: number;
    totalOrderQty: number;
    totalOrderAmount: number;
    totalProducedQty: number;
    progressRate: number;
    completedLineCount: number;
}

/** 수주 옵션 조회 응답 */
export interface SalesOrderOptionResponse {
    orderCode: string;
    bpNm: string;
}

/**
 * 수주 옵션 조회 요청 파라미터
 * - GET /sales-orders/options 의 쿼리 파라미터
 */
export interface SalesOrderOptionParams {
    /**
     * 미배정 수주만 조회할지 여부
     * - true  : 미배정 수주만 조회
     * - false : 전체 수주 조회 (서버 기본값)
     */
    unassignedOnly?: boolean;
}

/** 시뮬레이션 부산물 추정량 */
export interface SalesOrderSimulationByproduct {
    itemCode: string;
    itemNm: string;
    unit: string;
    qty: number | null;
}

/** 시뮬레이션 공통 구간(분기 전) 생산 가능량 */
export interface SalesOrderSimulationCapacity {
    itemCode: string | null;
    itemNm: string | null;
    unit: string | null;
    qty: number | null;
    byproducts: SalesOrderSimulationByproduct[];
    note: string | null;
}

/** 시뮬레이션 분기별 배분 결과 (수율 불확실 분기는 qty가 항상 null) */
interface SalesOrderSimulationAllocationBase {
    percent: number;
    itemCode: string;
    itemNm: string;
    unit: string;
    qty: number | null;
    byproducts: SalesOrderSimulationByproduct[];
    note: string | null;
}

export interface SalesOrderSemiSeedAllocation extends SalesOrderSimulationAllocationBase {
    /** 이 분기에 배분된 탈피씨드 투입량 */
    semiSeedQty: number | null;
}

export interface SalesOrderParkAllocation extends SalesOrderSimulationAllocationBase {
    /** 이 분기에 배분된 건조 헴프박 투입량 */
    dryParkQty: number | null;
}

/** 원물 투입 시뮬레이션 요청 */
export interface SalesOrderRawMaterialSimulationRequest {
    rawWeight: number;
    oilPercent: number;
}

/** 원물 투입 시뮬레이션 응답 */
export interface SalesOrderRawMaterialSimulationResponse {
    rawItemCode: string;
    rawItemNm: string;
    rawUnit: string;
    rawWeight: number;
    semiSeedCapacity: SalesOrderSimulationCapacity;
    oilCapacity: SalesOrderSemiSeedAllocation;
    seedCapacity: SalesOrderSemiSeedAllocation;
}

/** 부산물(헴프박) 재투입 시뮬레이션 요청 */
export interface SalesOrderByproductSimulationRequest {
    parkWeight: number;
    powderPercent: number;
}

/** 부산물(헴프박) 재투입 시뮬레이션 응답 */
export interface SalesOrderByproductSimulationResponse {
    parkItemCode: string;
    parkItemNm: string;
    parkUnit: string;
    parkWeight: number;
    dryParkCapacity: SalesOrderSimulationCapacity;
    powderCapacity: SalesOrderParkAllocation;
    concCapacity: SalesOrderParkAllocation;
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

/** 수주현황 목록 페이징 데이터 타입 */
export type PageSalesOrderStatusLineResponse = PageResponse<SalesOrderStatusLineResponse>;

/** 수주현황 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageSalesOrderStatusLineResponse = ApiResponsePage<SalesOrderStatusLineResponse>;

/** 수주현황 그룹별 생산 진행률 목록 API 최종 응답 타입 */
export type ApiResponseListSalesOrderStatusGroupResponse = ApiResponse<SalesOrderStatusGroupResponse[]>;

/** 수주실적현황 기간별 추이 API 최종 응답 타입 */
export type ApiResponseListSalesOrderPerformanceTrendSeriesResponse = ApiResponse<SalesOrderPerformanceTrendSeriesResponse[]>;

/** 수주실적현황 KPI API 최종 응답 타입 */
export type ApiResponseSalesOrderPerformanceKpiResponse = ApiResponse<SalesOrderPerformanceKpiResponse>;

/** 수주 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListSalesOrderOptionResponse = ApiResponse<SalesOrderOptionResponse[]>;

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
    },

    /** 원물 투입 시뮬레이션 (RAW 그룹 배분 미리보기) */
    simulateRawMaterial: async (
        data: SalesOrderRawMaterialSimulationRequest,
    ): Promise<ApiResponse<SalesOrderRawMaterialSimulationResponse>> => {
        const res = await apiClient.post('/sales-orders/simulate-raw-material', data);
        return res.data;
    },

    /** 부산물(헴프박) 재투입 시뮬레이션 (PARK 그룹 배분 미리보기) */
    simulateByproduct: async (
        data: SalesOrderByproductSimulationRequest,
    ): Promise<ApiResponse<SalesOrderByproductSimulationResponse>> => {
        const res = await apiClient.post('/sales-orders/simulate-byproduct', data);
        return res.data;
    },

    /** 수주현황 조회 */
    getStatusList: async (params?: {
        orderCode?: string;
        bpCode?: string;
        itemCode?: string;
        page?: number;
        size?: number;
        [key: string]: any;
    }): Promise<ApiResponsePageSalesOrderStatusLineResponse> => {
        const res = await apiClient.get('/sales-orders/status', { params });
        return res.data;
    },

    /** 수주현황 그룹별 생산 진행률 조회 */
    getStatusSummary: async (params: {
        orderCode?: string;
        bpCode?: string;
        itemCode?: string;
        groupBy: string;
        [key: string]: any;
    }): Promise<ApiResponseListSalesOrderStatusGroupResponse> => {
        const res = await apiClient.get('/sales-orders/status/summary', { params });
        return res.data;
    },

    /** 수주실적현황 기간별 추이 조회 */
    getPerformanceTrend: async (params: {
        groupBy: string;
        period: string;
        orderCode?: string;
        bpCode?: string;
        itemCode?: string;
        [key: string]: any;
    }): Promise<ApiResponseListSalesOrderPerformanceTrendSeriesResponse> => {
        const res = await apiClient.get('/sales-orders/performance/trend', { params });
        return res.data;
    },

    /** 수주실적현황 KPI 조회 */
    getPerformanceKpi: async (params: {
        period: string;
        orderCode?: string;
        bpCode?: string;
        itemCode?: string;
        [key: string]: any;
    }): Promise<ApiResponseSalesOrderPerformanceKpiResponse> => {
        const res = await apiClient.get('/sales-orders/performance/kpi', { params });
        return res.data;
    },

    /**
     * 수주 셀렉트 옵션 조회
     * @param params.unassignedOnly 미배정 수주만 조회할지 여부 (기본값 false, 생략 시 전체 조회)
     */
    getOptions: async (params?: SalesOrderOptionParams): Promise<ApiResponseListSalesOrderOptionResponse> => {
        const res = await apiClient.get<ApiResponseListSalesOrderOptionResponse>('/sales-orders/options', {
            // 파라미터를 생략하면 서버 기본값(false)이 적용된다
            params: { unassignedOnly: params?.unassignedOnly ?? false },
        });
        return res.data;
    },
};
