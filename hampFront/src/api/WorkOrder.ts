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

/** 작업지시 라인 바코드 스캔 조회 응답의 공정순서도 단계 */
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
    requiredMaterials?: ItemOptionResponse[];
}

/** 설비 스캔으로 받은 공정을 투입수량과 함께 시작 확정할 때 보내는 요청 */
export interface WorkOrderPerformanceStartRequest {
    zone: ZoneType;
    operCode: string;
    materials: WorkOrderPerformanceMaterialQtyRequest[];
}

/** 설비 스캔으로 받은 공정에 투입 자재와 산출자재를 보내는 요청 */
export interface WorkOrderPerformanceMaterialQtyRequest {
    itemCode: string;
    qty: number;
}

/** 설비 스캔으로 받은 공정을 종료 확정할 때 불량수량을 보내는 요청 */
export interface WorkOrderPerformanceDefectRequest {
    defCode: string;
    qty: number;
}

/** 설비 스캔으로 받은 공정을 종료 확정할 때 보내는 요청 */
export interface WorkOrderPerformanceFinishRequest {
    zone: ZoneType;
    operCode: string;
    materials: WorkOrderPerformanceMaterialQtyRequest[];
    defects?: WorkOrderPerformanceDefectRequest[];
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

/** 작업지시 공정 시작 API 최종 응답 타입 (기본 ApiResponse 활용) */
export type ApiResponseWorkOrderPerformanceStartResponse = ApiResponse<string>;

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

    /** 작업지시 라인 바코드 스캔 조회 */
    scan: async (code: string, zone: ZoneType): Promise<ApiResponseWorkOrderLineScanResponse> => {
        const res = await apiClient.get('/work-orders/scan', {
            params: { code, zone },
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
