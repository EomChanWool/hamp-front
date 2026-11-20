import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';


// ── 수주 요청 / 응답 타입 ─────────────────────────────────────────────────────

/** 수주 등록 요청 */
export interface SalesOrderCreateRequest {
    /** 거래처 코드 (최대 30자) */
    bpCode: string;
    /** 납기일 (yyyy-MM-dd) */
    dueDate?: string | null;
    /** 비고 (최대 255자) */
    note?: string | null;
    /** 투입원료 품목 코드 (최대 30자, 예: HEMP_SEED_RAW) */
    itemCode?: string | null;
    /** 투입원료 수량 */
    orderQty?: number | null;
    /** 가공비 */
    orderAmount?: number | null;
    /** 투입원료 수량 오차범위(%) */
    toleranceRate?: number | null;
    /** 산출 라인 목록 */
    lines?: SalesOrderLineRequest[];
}

/** 수주 정보 수정 요청 */
export interface SalesOrderUpdateRequest {
    /** 거래처 코드 (최대 30자) */
    bpCode: string;
    /** 납기일 (yyyy-MM-dd) */
    dueDate?: string | null;
    /** 상태 (최대 30자, 예: OPEN) */
    status?: string | null;
    /** 비고 (최대 255자) */
    note?: string | null;
    /** 투입원료 품목 코드 (최대 30자) */
    itemCode?: string | null;
    /** 투입원료 수량 */
    orderQty?: number | null;
    /** 가공비 */
    orderAmount?: number | null;
    /** 투입원료 수량 오차범위(%) */
    toleranceRate?: number | null;
    /** 산출 라인 목록 */
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
    /** 수주 코드 */
    orderCode: string;
    /** 거래처 코드 */
    bpCode: string;
    /** 거래처명 */
    bpNm: string;
    /** 납기일 */
    dueDate: string;
    /** 상태 */
    status: string;
    /** 비고 */
    note: string;
    /** 투입원료 품목 코드 */
    itemCode: string | null;
    /** 투입원료 품목명 */
    itemNm: string | null;
    /** 투입원료 단위 */
    unit: string | null;
    /** 투입원료 수량 (계약) */
    orderQty: number | null;
    /** 투입원료 누적 입고수량 (실제) */
    receivedQty: number | null;
    /** 실제 누적 입고수량을 전처리(탈각) 수율로 환산한 탈피씨드 가능량 */
    receivedSemiSeedQty: number | null;
    /** 가공비 */
    orderAmount: number | null;
    /** 투입원료 수량 오차범위(%) */
    toleranceRate: number | null;
    createdAt: string;
    updatedAt: string;
    /** 산출 라인 목록 */
    lines: SalesOrderLineResponse[];
}

/** 배분 그룹 키 - 원물(탈피씨드) 분기는 RAW, 부산물(헴프박) 재투입 분기는 PARK */
export type SalesOrderAllocationGroup = 'RAW' | 'PARK';

/** 수주라인(산출 라인) 등록/수정 요청 */
export interface SalesOrderLineRequest {
    /** 수주 라인 ID (수정 시 기존 라인을 그대로 갱신하려면 지정, 신규 라인은 생략) */
    salesOrderLineId?: number;
    /** 산출 품목 코드 (최대 30자) */
    itemCode: string;
    /**
     * 배분 그룹 키 (최대 20자)
     * - 같은 투입 품목을 기준으로 나뉘는 분기를 묶는 키
     * - 예: 원물 분기는 'RAW', 부산물 재투입 분기는 'PARK'
     * - 서버는 string 으로 받으므로 string 도 허용 (SalesOrderAllocationGroup 권장)
     */
    allocationGroup?: SalesOrderAllocationGroup | string | null;
    /**
     * allocationGroup 내 배분 비율(%) (0~100)
     * - 같은 그룹 라인들의 합이 100이어야 함
     */
    allocationPercent?: number | null;
}

/** 수주라인(산출 라인) 응답 */
export interface SalesOrderLineResponse {
    /** 수주 라인 ID */
    salesOrderLineId: number;
    /** 수주 코드 */
    orderCode: string;
    /** 산출 품목 코드 */
    itemCode: string;
    /** 산출 품목명 */
    itemNm: string;
    /** 단위 */
    unit: string;
    /** 예정 산출수량 - 수율이 불확실한 분기는 null */
    planQty: number | null;
    /** 배분 그룹 키 (예: RAW, PARK) - 미사용 라인은 null */
    allocationGroup: string | null;
    /** allocationGroup 내 배분 비율(%) - 미사용 라인은 null */
    allocationPercent: number | null;
    /**
     * 배분된 투입량 - 미사용 라인은 null
     * (RAW 그룹 = 탈피씨드, PARK 그룹 = 건조헴프박 기준)
     */
    allocatedInputQty: number | null;
    /** 생산완료수량 (기존 produceQty 에서 이름 변경) */
    producedQty: number;
    /** 출고가능수량 (생산완료 중 아직 출고 안 된 LOT 수량 합) */
    availableQty: number;
    /** 기출고수량 (출고 확정된 LOT 수량 합) */
    shippedQty: number;
    /** 생산현황 (생산완료/일부생산/생산중) */
    productionStatus: string;
    createdAt: string;
    updatedAt: string;
}

// ── 작업지시 지시수량 미리보기 타입 ───────────────────────────────────────────
//
// GET /sales-orders/{orderCode}/instruct-qty-preview
//
// 투입량 계산 방식
//  - 방식① 원료 비율 유지   (ratioKept*)       : 입고량이 달라져도 배분 비율을 유지하고 투입량을 환산
//  - 방식② 목표 산출량 유지 (targetYieldKept*) : 목표 산출량을 맞추도록 투입량을 환산
//  - 방식③ 직접입력                            : 프론트가 outputYieldPercent 등 수율 값으로 직접 계산
//
// 계산은 항상 "실제 누적 입고수량" 기준이다. (계약 수량 기준 아님)

/**
 * 지시수량 미리보기 라인 (RAW/PARK 그룹 공통)
 * - "수율 확정 라인만, 그 외엔 null" 로 표기된 필드는 수율이 불확실한 분기에서 null
 */
export interface InstructQtyPreviewLineResponse {
    /** 수주 라인 ID */
    salesOrderLineId: number;
    /** 품목 코드 */
    itemCode: string;
    /** 품목명 */
    itemNm: string;
    /** 방식① 원료 비율 유지 - 투입량 */
    ratioKeptQty: number;
    /** 방식① 원료 비율 유지 - 예상 산출량 (수율 확정 라인만, 그 외엔 null) */
    ratioKeptOutputQty: number | null;
    /** 방식② 목표 산출량 유지 - 투입량 */
    targetYieldKeptQty: number;
    /** 방식② 목표 산출량 유지 - 예상 산출량 (수율 확정 라인만, 그 외엔 null) */
    targetYieldKeptOutputQty: number | null;
    /**
     * 투입량 대비 산출량 비율(%) - 수율 확정 라인만, 그 외엔 null
     * - 직접입력 시 프론트 계산: 예상 산출량 = 투입량 × outputYieldPercent ÷ 100
     */
    outputYieldPercent: number | null;
    /**
     * 투입량 대비 부산물(헴프박) 발생 비율(%) - 헴프오일 라인만, 그 외엔 null
     * - 직접입력 시 프론트 계산: 건조 전 헴프박 발생량 = 오일 투입량 × byproductYieldPercent ÷ 100
     * - 건조까지 거치려면 park.dryYieldPercent 를 한 번 더 곱한다
     */
    byproductYieldPercent: number | null;
}

/** 지시수량 미리보기 - RAW 그룹 (원물 → 오일/씨드) */
export interface InstructQtyPreviewRawGroupResponse {
    /** 실제 누적 입고수량 */
    receivedQty: number;
    /**
     * 실제 누적 입고수량을 전처리(탈각) 수율로 환산한 탈피씨드 가능량
     * - 투입원료가 HEMP_SEED 가 아니거나 입고가 없으면 null
     */
    receivedSemiSeedQty: number | null;
    /** 수주에 설정된 투입원료 수량 오차범위(%) - 미설정이면 null */
    toleranceRate: number | null;
    /**
     * 실제 누적 입고수량이 오차범위 안인지
     * - true  : 계량 오차 수준의 차이 → 투입량 계산 방식(①②③) 선택 UI를 숨기고 ①을 그대로 사용
     * - 계산 자체는 오차범위와 무관하게 항상 실제 입고량 기준이므로,
     *   ratioKeptQty/targetYieldKeptQty 가 계약값과 같다는 보장은 없음 (UI 노출 판단용 플래그)
     * - toleranceRate 미설정이면 항상 false
     */
    withinTolerance: boolean;
    /** RAW 그룹 라인 목록 (헴프오일/헴프씨드) */
    lines: InstructQtyPreviewLineResponse[];
}

/** 지시수량 미리보기 - PARK 그룹 (헴프박 → 파우더/농축) */
export interface InstructQtyPreviewParkGroupResponse {
    /** 방식① 원료 비율 유지 - 예상 헴프박 수량 (건조 전, 오일 부산물) */
    ratioKeptByproductQty: number;
    /** 방식① 원료 비율 유지 - 건조 후 수량 (= 이 방식에서 파우더/농축에 실제 배분 가능한 풀) */
    ratioKeptDryQty: number;
    /** 방식② 목표 산출량 유지 - 예상 헴프박 수량 (건조 전, 오일 부산물) */
    targetYieldKeptByproductQty: number;
    /** 방식② 목표 산출량 유지 - 건조 후 수량 (= 이 방식에서 파우더/농축에 실제 배분 가능한 풀) */
    targetYieldKeptDryQty: number;
    /**
     * 헴프박 → 건조헴프박 수율(%)
     * - 직접입력 시 프론트 계산: 건조 후 수량 = 헴프박 발생량 × dryYieldPercent ÷ 100
     */
    dryYieldPercent: number;
    /** PARK 그룹 라인 목록 (단백질파우더/헴프박농축액) */
    lines: InstructQtyPreviewLineResponse[];
}

/** 작업지시 지시수량 미리보기 응답 */
export interface InstructQtyPreviewResponse {
    /** RAW 그룹 (원물 → 오일/씨드) 정보 */
    raw: InstructQtyPreviewRawGroupResponse;
    /** PARK 그룹 (헴프박 → 파우더/농축) 정보 */
    park: InstructQtyPreviewParkGroupResponse;
}

// ── 수주현황 / 실적현황 타입 ──────────────────────────────────────────────────

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
export interface SalesOrderSimulationAllocationBase {
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

/** 작업지시 지시수량 미리보기 API 최종 응답 타입 */
export type ApiResponseInstructQtyPreviewResponse = ApiResponse<InstructQtyPreviewResponse>;

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

    /** 수주 단건 상세 조회 (산출 라인의 배분/생산/출고 정보 포함) */
    getDetail: async (orderCode: string): Promise<ApiResponseSalesOrderDetailResponse> => {
        const res = await apiClient.get(`/sales-orders/${orderCode}`);
        return res.data;
    },

    /**
     * 작업지시 지시수량 미리보기
     * - GET /sales-orders/{orderCode}/instruct-qty-preview
     * - 방식① 원료 비율 유지 / 방식② 목표 산출량 유지 기준의 투입량·예상 산출량을
     *   실제 누적 입고수량 기준으로 계산해서 반환 (RAW/PARK 그룹별)
     * - raw.withinTolerance 가 true 면 방식 선택 UI 없이 ① 을 그대로 사용
     */
    getInstructQtyPreview: async (orderCode: string): Promise<ApiResponseInstructQtyPreviewResponse> => {
        const res = await apiClient.get<ApiResponseInstructQtyPreviewResponse>(
            `/sales-orders/${orderCode}/instruct-qty-preview`,
        );
        return res.data;
    },

    /**
     * 수주 등록
     * - lines 의 같은 allocationGroup 내 allocationPercent 합은 100 이어야 한다.
     */
    create: async (data: SalesOrderCreateRequest): Promise<ApiResponseSalesOrderResponse> => {
        const res = await apiClient.post('/sales-orders', data);
        return res.data;
    },

    /**
     * 수주 수정
     * - 기존 라인을 갱신하려면 lines 에 salesOrderLineId 를 지정, 신규 라인은 생략
     */
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
