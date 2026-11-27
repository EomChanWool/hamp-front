import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';
import type { ItemOptionResponse } from '@/api/master/Item';
import type { ApiResponsePageWorkOrderResponse, MaterialIoType } from '@/api/WorkOrder';

/**
 * 생산 실적 API (WorkPerformance)
 * - 태블릿 작업자 화면에서 쓰는 /work-performances/** 엔드포인트 모음
 * - 작업지시 자체(등록/수정/조회/집계/스캔)는 WorkOrder.ts 에서 관리한다
 */

// ── 공정 시작/종료 요청 모델 ────────────────────────────────────────────────────────
// POST /work-performances/performance/start
// POST /work-performances/performance/finish

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

/** 공정 시작 확정 요청 (투입수량 등록) */
export interface WorkOrderPerformanceStartRequest {
    /** 화면에서 라인을 직접 고르므로 어떤 라인인지 함께 보낸다 */
    workOrderLineId: number;
    operCode: string;
    materials: WorkOrderPerformanceMaterialQtyRequest[];
}

/** 공정 종료 확정 요청 */
export interface WorkOrderPerformanceFinishRequest {
    /** 화면에서 라인을 직접 고르므로 어떤 라인인지 함께 보낸다 */
    workOrderLineId: number;
    operCode: string;
    materials: WorkOrderPerformanceMaterialQtyRequest[];
    defects?: WorkOrderPerformanceDefectRequest[];
}

/**
 * 공정 시작/종료 입력 준비 정보 (화면 내부 모델)
 * - 백엔드 엔드포인트는 없고, 화면에서 작업지시 상세 데이터로 만들어 쓴다
 * - START_READY: 시작 전 → requiredMaterials 는 투입자재 목록
 * - FINISH_READY: 진행 중 → requiredMaterials 는 산출자재 목록
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

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 작업지시 생산라인 현황 조회 API 최종 응답 타입 */
export type ApiResponseListWorkOrderProductionLineResponse = ApiResponse<WorkOrderProductionLineResponse[]>;

/** 공정 시작/종료 확정 API 최종 응답 타입 (data 없음) */
export type ApiResponseVoid = ApiResponse<null>;

// ── 생산 실적 API 함수 ────────────────────────────────────────────────────────

export const WorkPerformanceApi = {
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

    /**
     * 작업지시 생산라인 현황 조회 (태블릿 화면용, 단순화된 상태)
     * GET /work-performances/{workId}/production-lines
     */
    getProductionLines: async (workId: string): Promise<ApiResponseListWorkOrderProductionLineResponse> => {
        const res = await apiClient.get(`/work-performances/${encodeURIComponent(workId)}/production-lines`);
        return res.data;
    },

    /**
     * 공정 시작 확정 (투입수량 등록)
     * POST /work-performances/performance/start
     */
    startPerformance: async (data: WorkOrderPerformanceStartRequest): Promise<ApiResponseVoid> => {
        const res = await apiClient.post('/work-performances/performance/start', data);
        return res.data;
    },

    /**
     * 공정 종료 확정
     * POST /work-performances/performance/finish
     */
    finishPerformance: async (data: WorkOrderPerformanceFinishRequest): Promise<ApiResponseVoid> => {
        const res = await apiClient.post('/work-performances/performance/finish', data);
        return res.data;
    },
};
