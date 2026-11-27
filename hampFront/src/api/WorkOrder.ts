import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';
import type { EquipmentOptionResponse } from '@/api/master/Equipment';
import type { ItemOptionResponse } from '@/api/master/Item';

// 도메인 상수 및 타입 (Literal Types)

/** 종류 (1: 식품동, 2: 섬유동) */
export type ZoneType = 1 | 2;

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
    bpCode: string;
    bpNm: string;
    dueDate: string;
    itemCode: string;
    itemNm: string;
    unit: string;
    instructQty: number;
    createdAt: string;
    updatedAt: string;
    barcode: string;
    routingSteps: WorkOrderRoutingStepResponse[];
}

/** 작업지시 목록 조회 아이템 응답 (요약 정보 포함) */
export interface WorkOrderResponse {
    workId: string;
    workDate: string;
    status: string;
    managerId: string;
    managerNm: string;
    orderCode: string; // 연결된 수주 코드
    itemNms: string[];
    totalInstructQty: number;
    instructQtySum?: number; // 이 수주에 입고된 원물 총량 - 전처리 입고라벨 누적 스캔 완료 판정 기준
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

/** 공정 자재 입출 구분 (IN: 투입자재, OUT: 산출자재) */
export type MaterialIoType = 'IN' | 'OUT';

/** 공정 실적에 기록된 자재 한 건 (자재마다 단위가 달라서 공정 합계 대신 이걸로 표시한다) */
export interface WorkOrderRoutingStepMaterialResponse {
    itemCode: string;
    itemNm: string;
    unit: string; // 자재 자체 단위 (예: G, KG, L) - 작업지시 품목 단위와 다를 수 있음
    ioType: MaterialIoType;
    qty: number;
}

/** 작업지시 라인의 공정순서도 단계 */
export interface WorkOrderRoutingStepResponse {
    operCode: string;
    operNm: string;
    operSeq: number;
    finalYn: string; // "Y" | "N" | "G" (Y: 전체공정 최종, N: 일반, G: 일반공정 최종/수율 확정 지점)
    done: boolean; // 이 작업지시라인에서 이미 종료 처리된 공정인지 (DB 기준)
    inProgress: boolean; // 이 작업지시라인에서 지금 진행 중인 공정인지 (시작O, 종료X) (DB 기준)
    inputQty: number | null; // 이 공정을 시작할 때 기록한 투입수량 (시작 전이면 null)
    outputQty: number | null;   // 이 공정을 끝낼 때 기록한 양품 산출수량 (종료 전이면 null)
    defectQty: number | null;   // 이 공정을 끝낼 때 기록한 불량수량 (종료 전이면 null)
    yieldRate: number | null;   // 이 공정의 양품률
    equipments: EquipmentOptionResponse[]; // 이 공정용으로 등록된 설비 목록 (실제 사용 설비가 아니라 매칭된 설비)
    /** 이 공정에 기록된 투입(IN)/산출(OUT) 자재 내역 - 구버전 응답 대비 optional 로 둔다 */
    materials?: WorkOrderRoutingStepMaterialResponse[];
}

/** 작업지시 라인 바코드 스캔 조회 응답 타입 (다른 스캔 화면에서 사용) */
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

/**
 * 공정 시작/종료 입력 준비 정보
 * - 태블릿에서 라인의 [투입 입력]/[실적 입력]을 누르면 조회한다
 * - START_READY: 시작 전 → requiredMaterials 는 투입자재 목록
 * - FINISH_READY: 진행 중 → requiredMaterials 는 산출자재 목록
 * - 실제 기록은 startPerformance / finishPerformance 로 확정해야 된다
 */
export interface WorkOrderPerformanceReadyResponse {
    action: 'START_READY' | 'FINISH_READY';
    workOrderLineId: number;
    operCode: string;
    operNm: string;
    operSeq: number;
    perfId: number | null;
    requiredMaterials?: ItemOptionResponse[];
}

/** @deprecated 설비 스캔 방식 제거 - WorkOrderPerformanceReadyResponse 를 사용 */
export type WorkOrderPerformanceScanResponse = WorkOrderPerformanceReadyResponse;

/** 공정 시작/종료 시 자재별 수량 */
export interface WorkOrderPerformanceMaterialQtyRequest {
    itemCode: string;
    qty: number;
}

/** 공정 종료 시 불량 수량 */
export interface WorkOrderPerformanceDefectRequest {
    defCode: string;
    qty: number;
}

/** 공정을 투입수량과 함께 시작 확정할 때 보내는 요청 */
export interface WorkOrderPerformanceStartRequest {
    zone: ZoneType;
    /** 스캔 대신 화면에서 라인을 직접 고르므로 어떤 라인인지 함께 보낸다 */
    workOrderLineId: number;
    operCode: string;
    materials: WorkOrderPerformanceMaterialQtyRequest[];
}

/** 공정을 종료 확정할 때 보내는 요청 */
export interface WorkOrderPerformanceFinishRequest {
    zone: ZoneType;
    /** 스캔 대신 화면에서 라인을 직접 고르므로 어떤 라인인지 함께 보낸다 */
    workOrderLineId: number;
    operCode: string;
    materials: WorkOrderPerformanceMaterialQtyRequest[];
    defects?: WorkOrderPerformanceDefectRequest[];
}

// ── 생산라인 현황(production-lines) 응답 모델 ──────────────────────────────────────
// GET /work-performances/{workId}/production-lines
// 태블릿 작업지시 상세에서 라인 카드를 그릴 때 쓰는 단순화된 상태

/**
 * 생산라인 단순화 상태
 * - LOCKED: 선행 라인이 끝나지 않아 잠김 (lockedReason 에 선행 라인명)
 * - READY: 투입 입력 가능 (작업 시작 전)
 * - PRODUCING: 생산 중 (실적 입력 대기)
 * - AWAITING_PACK: 생산실적 기록 완료, 포장 대기
 * - DONE: 완료 (finalQty 확정)
 */
export type ProductionLineStatus = 'LOCKED' | 'READY' | 'PRODUCING' | 'AWAITING_PACK' | 'DONE';

/** 생산라인에 기록된 산출 자재 한 건 */
export interface WorkOrderProductionLineMaterialResponse {
    itemCode: string;
    itemNm: string;
    unit: string;
    ioType: MaterialIoType;
    qty: number;
}

/** 작업지시 생산라인 현황 한 건 */
export interface WorkOrderProductionLineResponse {
    /** 화면 표시 순서 (전체 공정 중 이 라인의 개념적 단계 - 중간에 비어있는 번호가 있을 수 있음) */
    seq: number;
    /** 이 라인이 생산하는(또는 전처리의 경우 투입되는) 품목 코드 */
    itemCode: string;
    itemNm: string;
    /** 대표 공정명 (화면 배지용 - 예: 전처리/선별/착유) */
    operNm: string;
    status: ProductionLineStatus;
    /** LOCKED 일 때만: 잠긴 이유(선행 라인명) */
    lockedReason?: string | null;
    /** 투입량 (작업시작 시 기록한 값, 시작 전이면 null) */
    inputQty: number | null;
    /** 생산실적으로 기록된 산출 자재 목록 (포장 전 - 품목에 따라 1건 또는 2건) */
    outputs: WorkOrderProductionLineMaterialResponse[];
    /** 포장 후 최종 산출량 (완료 전이면 null, 포장 단계가 없는 라인도 null) */
    finalQty: number | null;
}

// ── 예상 투입원료(estimate) 요청/응답 모델 ──────────────────────────────────────────
// POST /work-orders/estimate-raw-material
// 작업지시 등록 시 산출수량 기준으로 예상 투입원료를 계산한다 (참고용 추정치)

/** 예상 투입원료 계산 - 작업지시 라인별 요청 */
export interface WorkOrderMaterialEstimateLineRequest {
    /** 산출 품목코드 (예: "HEMP_OIL") */
    itemCode: string;
    /** 산출수량 (미입력 시 이 라인은 추정에서 제외) */
    outputQty?: number | null;
}

/** 예상 투입원료 계산 요청 */
export interface WorkOrderMaterialEstimateRequest {
    /** 작업지시 라인별 산출 품목/산출수량 (1건 이상 필수) */
    lines: WorkOrderMaterialEstimateLineRequest[];
    /** 수주에 계약된 투입원료 수량(kg, 참고용) - 있으면 초과 여부(overRaw)를 함께 계산 */
    committedRawQty?: number | null;
}

/** 예상 투입원료 계산 - 라인별 부산물 추정 응답 */
export interface WorkOrderMaterialEstimateByproductResponse {
    /** 부산물 품목코드 */
    itemCode: string;
    /** 부산물 품목명 */
    itemNm: string;
    /** 부산물 품목단위 */
    unit: string;
    /** 부산물 추정량 (해당 품목 단위 기준, 올림) */
    qty: number;
}

/** 예상 투입원료 계산 - 라인별 추정 응답 (요청 순서 그대로) */
export interface WorkOrderMaterialEstimateLineResponse {
    /** 산출 품목코드 */
    itemCode: string;
    /**
     * 예상 투입 원료(kg)
     * - 연계생산 품목(parkDerived=true)은 그 생산 체인에서 멈춘 자재(예: 헴프박) 기준, 그 외는 원물 기준
     * - 산출수량 미입력/수율 미확정이면 null
     */
    rawNeeded: number | null;
    /** 다른 품목 공정의 부산물로 충당되는 자재 기반 연계생산 품목 여부 (원물을 따로 투입하지 않음) */
    parkDerived: boolean;
    /** 계산 가정/상태 설명 (참고용) */
    note: string | null;
    /** 이 라인을 생산하는 과정에서 함께 발생하는 부산물 품목별 추정량 (없으면 빈 배열) */
    byproducts: WorkOrderMaterialEstimateByproductResponse[];
}

/** 예상 투입원료 계산 - 전체 라인 합계/경고 판단용 요약 응답 */
export interface WorkOrderMaterialEstimateSummaryResponse {
    /** 독립 품목(헴프오일/헴프씨드 등)의 예상 원물 소요량 합계 (kg, 올림) */
    totalRawNeeded: number;
    /** 독립 품목 중 산출수량 미입력/수율 미확정으로 합계에서 제외된 라인이 있는지 여부 */
    hasUnknownRaw: boolean;
    /** 헴프오일 라인에서 발생하는 헴프박(부산물) 공급량 합계 (kg, 내림) */
    parkSupply: number;
    /** 헴프오일 라인 포함 여부 */
    hasOilLine: boolean;
    /** 헴프박 기반 연계생산 품목의 필요량 합계 (kg, 올림 - 산출수량 입력/수율 확정된 라인만) */
    parkDemand: number;
    /** 헴프박 기반 연계생산 품목(파우더/농축액 등) 포함 여부 */
    hasParkConsumer: boolean;
    /** 연계생산 품목 중 산출수량 미입력/수율 미확정으로 parkDemand에서 제외된 라인이 있는지 여부 */
    hasUnknownParkConsumer: boolean;
    /** 요청으로 받은 투입원료 계약 수량 (kg) - 미전달 시 null */
    committedRawQty: number | null;
    /** totalRawNeeded가 committedRawQty를 초과하는지 (committedRawQty가 없으면 false) */
    overRaw: boolean;
    /** parkDemand가 parkSupply를 초과하는지 (헴프박 부족) */
    parkShort: boolean;
}

/** 예상 투입원료 계산 응답 */
export interface WorkOrderMaterialEstimateResponse {
    /** 요청 순서 그대로의 라인별 추정 결과 */
    lines: WorkOrderMaterialEstimateLineResponse[];
    /** 전체 라인 합계/경고 판단용 요약 */
    summary: WorkOrderMaterialEstimateSummaryResponse;
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

/** 공정 시작/종료 입력 준비 정보 API 최종 응답 타입 */
export type ApiResponseWorkOrderPerformanceReadyResponse = ApiResponse<WorkOrderPerformanceReadyResponse>;

/** 작업지시 공정 시작 API 최종 응답 타입 (기본 ApiResponse 활용) */
export type ApiResponseWorkOrderPerformanceStartResponse = ApiResponse<string>;

/** 작업지시 생산라인 현황 조회 API 최종 응답 타입 */
export type ApiResponseListWorkOrderProductionLineResponse = ApiResponse<WorkOrderProductionLineResponse[]>;

/** 예상 투입원료 계산 API 최종 응답 타입 */
export type ApiResponseWorkOrderMaterialEstimateResponse = ApiResponse<WorkOrderMaterialEstimateResponse>;


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

    /**
     * 내 작업지시 목록 조회 (태블릿 화면용, 완료되지 않은 건 전체)
     * GET /work-performances/my
     * - 페이징 파라미터(page, size, sort)는 쿼리스트링으로 개별 전달한다 (예: sort: "workDate,desc")
     */
    getMyList: async (params?: {
        page?: number;
        size?: number;
        sort?: string;
    }): Promise<ApiResponsePageWorkOrderResponse> => {
        const res = await apiClient.get('/work-performances/my', { params });
        return res.data;
    },

    /** 작업지시 생산라인 현황 조회 (태블릿 화면용, 단순화된 상태) */
    getProductionLines: async (workId: string): Promise<ApiResponseListWorkOrderProductionLineResponse> => {
        const res = await apiClient.get(`/work-performances/${encodeURIComponent(workId)}/production-lines`);
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

    /**
     * 예상 투입원료 계산 (작업지시 등록 - 산출수량 기준, 참고용 추정치)
     * - 라인별 산출수량을 보내면 예상 투입원료, 부산물, 초과/부족 경고 요약을 돌려준다
     */
    estimateRawMaterial: async (data: WorkOrderMaterialEstimateRequest): Promise<ApiResponseWorkOrderMaterialEstimateResponse> => {
        const res = await apiClient.post('/work-orders/estimate-raw-material', data);
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

    /** 작업지시 라인 바코드 스캔 조회 (다른 스캔 화면에서 사용) */
    scan: async (code: string, zone: ZoneType): Promise<ApiResponseWorkOrderLineScanResponse> => {
        const res = await apiClient.get('/work-orders/scan', {
            params: { code, zone },
        });
        return res.data;
    },

    /**
     * 공정 시작/종료 입력 준비 정보 조회 (설비 스캔 대체)
     * GET /work-orders/performance/ready?zone=&workOrderLineId=&operCode=
     * - 시작이면 투입자재, 종료면 산출자재 목록을 requiredMaterials 로 돌려준다
     * - TODO(백엔드): 기존 설비 스캔 이벤트가 주던 값을 그대로 돌려주는 엔드포인트 필요
     */
    getPerformanceReady: async (params: {
        zone: ZoneType;
        workOrderLineId: number;
        operCode: string;
    }): Promise<ApiResponseWorkOrderPerformanceReadyResponse> => {
        const res = await apiClient.get('/work-orders/performance/ready', { params });
        return res.data;
    },

    /** 공정을 투입수량과 함께 시작 확정 */
    startPerformance: async (data: WorkOrderPerformanceStartRequest): Promise<ApiResponse<null>> => {
        const res = await apiClient.post('/work-orders/performance/start', data);
        return res.data;
    },

    /** 공정을 종료 확정 */
    finishPerformance: async (data: WorkOrderPerformanceFinishRequest): Promise<ApiResponse<null>> => {
        const res = await apiClient.post('/work-orders/performance/finish', data);
        return res.data;
    },
};
