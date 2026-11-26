import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

// 도메인 상수 및 타입 (Literal Types)

/** 섬유 작업지시 작업상태 */
export type FiberWorkOrderStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** 섬유 작업지시 등록 요청 (수주 1건당 작업지시 1개, 취소 건 제외) */
export interface FiberWorkOrderCreateRequest {
    orderCode: string; // 섬유 임가공 수주번호 (최대 30자) 예: "FSO-0001"
    workDate: string; // 예정 작업 시작일 (작업지시번호 날짜에도 쓰임) 예: "2026-11-26"
    managerId?: string | null; // 담당자 ID (선택, 최대 30자)
    note?: string | null; // 작업 지시사항 및 비고 (최대 255자)
}

/** 섬유 작업지시 수정 요청 */
export interface FiberWorkOrderUpdateRequest {
    workDate?: string | null; // 예정 작업 시작일
    managerId?: string | null; // 담당자 ID (선택, 최대 30자)
    note?: string | null; // 작업 지시사항 및 비고 (최대 255자)
}

/** 섬유 작업지시 작업 완료 요청 (숙성 기간/가습 여부 입력) */
export interface FiberWorkOrderCompleteRequest {
    endAt?: string | null; // 작업 종료일시 - 비워 두면 서버가 지금 시각 사용. 시작일시보다 빠르거나 미래일 수 없음
    agingDays: number; // 숙성 기간(일) 0~365, 숙성하지 않았으면 0
    humidified: boolean; // 가습 여부
}

/** 섬유 작업지시 응답 (목록 아이템 / 등록·수정·시작취소·완료취소·완료·취소 공통) */
export interface FiberWorkOrderResponse {
    workId: string; // 작업지시번호(작업지시서 바코드)
    orderCode: string; // 섬유 수주번호
    bpCode: string; // 거래처 코드
    bpNm: string; // 거래처명
    rawItemCode: string; // 투입원료(인피) 품목코드 - 수주 기준
    rawItemNm: string; // 투입원료명
    requestInputQty: number; // 수주 요청 원물 중량(kg) = 제품별 배분 합계
    dueDate: string; // 납기일
    workDate: string; // 예정 작업 시작일
    managerId: string | null; // 담당자 ID
    managerNm: string | null; // 담당자명
    status: FiberWorkOrderStatus | string; // 작업상태
    startAt: string | null; // 작업 시작일시 (현장 작업지시서 바코드 스캔 시점)
    endAt: string | null; // 작업 종료일시 (현장 PC에서 작업 완료 시 입력)
    agingDays: number | null; // 숙성 기간(일) - 작업 완료 시 입력
    humidified: boolean | null; // 가습 여부 - 작업 완료 시 입력
    performanceCount: number; // 실적 줄 수
    inputQty: number; // 실적 실제 투입 합계(kg)
    outputQty: number; // 실적 생산 합계(kg)
    note: string | null; // 작업 지시사항 및 비고
    createdAt: string;
    updatedAt: string;
}

/** 수주 제품별 배분 대비 실적 */
export interface FiberWorkOrderProductResponse {
    productItemCode: string; // 제품 품목코드
    productItemNm: string; // 제품명
    allocatedQty: number; // 수주에서 이 제품에 배분한 원물(kg) - 계획량
    inputQty: number; // 실적으로 투입한 원물 합계(kg)
    outputQty: number; // 실적 생산 합계(kg)
    remainingQty: number; // 남은 배분량(kg) = 배분 - 투입, 더 투입했으면 음수
}

/** 섬유 작업지시 단건 상세 조회 응답 */
export interface FiberWorkOrderDetailResponse {
    workOrder: FiberWorkOrderResponse; // 작업지시 헤더와 실적 합계
    products: FiberWorkOrderProductResponse[]; // 수주 제품별 배분 대비 실적
}

/** [바코드] 섬유동 작업지시서 스캔(= 작업 시작) 응답 */
export interface FiberWorkOrderScanResponse {
    message: string; // 작업자에게 보여주거나 읽어줄 한 줄 안내
    workId: string; // 작업지시번호
    status: FiberWorkOrderStatus | string; // 스캔 성공이면 IN_PROGRESS
    orderCode: string; // 섬유 수주번호
    bpNm: string; // 거래처명
    startAt: string; // 작업 시작일시
}

/** 실적에 투입할 수 있는 원물 LOT 응답 */
export interface FiberInputReceiptResponse {
    receiptId: number;
    receiptLotCode: string;
    rawItemCode: string;
    rawItemNm: string;
    receivedAt: string;
    receiptQty: number;
    usedQty: number;
    remainingQty: number;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 섬유 작업지시 단건/기본 API 최종 응답 타입 */
export type ApiResponseFiberWorkOrderResponse = ApiResponse<FiberWorkOrderResponse>;

/** 섬유 작업지시 상세 조회 API 최종 응답 타입 */
export type ApiResponseFiberWorkOrderDetailResponse = ApiResponse<FiberWorkOrderDetailResponse>;

/** 섬유 작업지시 목록 페이징 데이터 타입 */
export type PageFiberWorkOrderResponse = PageResponse<FiberWorkOrderResponse>;

/** 섬유 작업지시 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageFiberWorkOrderResponse = ApiResponsePage<FiberWorkOrderResponse>;

/** 섬유 작업지시서 스캔 API 최종 응답 타입 */
export type ApiResponseFiberWorkOrderScanResponse = ApiResponse<FiberWorkOrderScanResponse>;

/** 투입 가능 원물 LOT 목록 API 최종 응답 타입 */
export type ApiResponseFiberInputReceiptList = ApiResponse<FiberInputReceiptResponse[]>;

// ── 섬유 작업지시 관리 API 함수 ────────────────────────────────────────────────────

export const FiberWorkOrderApi = {
    /** 섬유 작업지시 목록 조회 (페이징 및 검색 조건) */
    getList: async (params?: {
        workId?: string;
        orderCode?: string;
        bpCode?: string;
        status?: string;
        managerId?: string;
        workDateFrom?: string;
        workDateTo?: string;
        page?: number;
        size?: number;
        sort?: string;
        [key: string]: any;
    }): Promise<ApiResponsePageFiberWorkOrderResponse> => {
        const res = await apiClient.get('/fiber-work-orders', { params });
        return res.data;
    },

    /** 섬유 작업지시 단건 상세 조회 */
    getDetail: async (workId: string): Promise<ApiResponseFiberWorkOrderDetailResponse> => {
        const res = await apiClient.get(`/fiber-work-orders/${workId}`);
        return res.data;
    },

    /** 섬유 작업지시 등록 */
    create: async (data: FiberWorkOrderCreateRequest): Promise<ApiResponseFiberWorkOrderResponse> => {
        const res = await apiClient.post('/fiber-work-orders', data);
        return res.data;
    },

    /** 섬유 작업지시 수정 */
    update: async (workId: string, data: FiberWorkOrderUpdateRequest): Promise<ApiResponseFiberWorkOrderResponse> => {
        const res = await apiClient.put(`/fiber-work-orders/${workId}`, data);
        return res.data;
    },

    /** 섬유 작업지시 삭제 */
    delete: async (workId: string): Promise<ApiResponse<string>> => {
        const res = await apiClient.delete(`/fiber-work-orders/${workId}`);
        return res.data;
    },

    /** [바코드] 섬유동 작업지시서 스캔 = 작업 시작 */
    scan: async (code: string): Promise<ApiResponseFiberWorkOrderScanResponse> => {
        const res = await apiClient.post('/fiber-work-orders/scan', null, {
            params: { code },
        });
        return res.data;
    },

    /** 섬유 작업지시 시작 취소 (잘못 스캔한 경우) */
    revertStart: async (workId: string): Promise<ApiResponseFiberWorkOrderResponse> => {
        const res = await apiClient.post(`/fiber-work-orders/${workId}/revert-start`);
        return res.data;
    },

    /** 섬유 작업지시 작업 완료 (숙성 기간/가습 여부 입력) */
    complete: async (workId: string, data: FiberWorkOrderCompleteRequest): Promise<ApiResponseFiberWorkOrderResponse> => {
        const res = await apiClient.post(`/fiber-work-orders/${workId}/complete`, data);
        return res.data;
    },

    /** 섬유 작업지시 완료 취소 (재개) */
    reopen: async (workId: string): Promise<ApiResponseFiberWorkOrderResponse> => {
        const res = await apiClient.post(`/fiber-work-orders/${workId}/reopen`);
        return res.data;
    },

    /** 섬유 작업지시 취소 */
    cancel: async (workId: string): Promise<ApiResponseFiberWorkOrderResponse> => {
        const res = await apiClient.post(`/fiber-work-orders/${workId}/cancel`);
        return res.data;
    },

    /** 실적에 투입할 수 있는 원물 LOT 목록 조회 */
    getInputReceipts: async (workId: string): Promise<ApiResponseFiberInputReceiptList> => {
        const res = await apiClient.get(`/fiber-work-orders/${workId}/input-receipts`);
        return res.data;
    },
};
