import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';


// ── 섬유 임가공 수주 상태 ─────────────────────────────────────────────────────

/**
 * 섬유 수주 상태
 * - RECEIVED    : 접수
 * - IN_PROGRESS : 진행중
 * - COMPLETED   : 완료
 * - CANCELLED   : 취소
 */
export type FiberSalesOrderStatus = 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';


// ── 수주 요청 / 응답 타입 ─────────────────────────────────────────────────────

/**
 * 섬유 수주 라인(제품별 원물 배분) 등록/수정 요청
 * - 같은 수주 내 모든 라인의 allocatedInputQty 합계는 requestInputQty 와 같아야 한다.
 */
export interface FiberSalesOrderLineRequest {
    /** 라인 ID (수정 시 기존 라인이면 입력, 신규면 생략) */
    fiberSalesOrderLineId?: number | null;
    /** 가공 요청 제품 품목코드 (최대 30자, 예: FIBER_COTTON) */
    productItemCode: string;
    /** 이 제품에 배분할 원물 중량(kg, 0 이상) */
    allocatedInputQty: number;
}

/** 섬유 수주 등록 요청 */
export interface FiberSalesOrderCreateRequest {
    /** 원물 소유자 거래처코드 (최대 30자, 예: BP-0003) */
    bpCode: string;
    /** 투입원료(인피) 품목코드 (최대 30자, 예: HEMP_BAST) */
    rawItemCode: string;
    /** 투입원료 총량(kg, 0 이상) */
    requestInputQty: number;
    /** 제품별 원물 배분 (1건 이상, 배분량 합계 = 투입원료 총량) */
    lines: FiberSalesOrderLineRequest[];
    /** 약정 총 가공비(원, 선택) */
    processingFee?: number | null;
    /** 요청 제품 규격 및 포장 조건 (최대 255자, 선택) */
    requestSpec?: string | null;
    /** 수주일 (yyyy-MM-dd) */
    orderDate: string;
    /** 납기일 (yyyy-MM-dd, 선택) */
    dueDate?: string | null;
    /** 비고 (최대 255자) */
    note?: string | null;
}

/** 섬유 수주 수정 요청 */
export interface FiberSalesOrderUpdateRequest {
    /** 원물 소유자 거래처코드 (최대 30자) */
    bpCode: string;
    /** 투입원료(인피) 품목코드 (최대 30자) */
    rawItemCode: string;
    /** 투입원료 총량(kg, 0 이상) */
    requestInputQty: number;
    /** 제품별 원물 배분 (1건 이상, 기존 라인은 fiberSalesOrderLineId 지정, 신규 라인은 생략) */
    lines: FiberSalesOrderLineRequest[];
    /** 약정 총 가공비(원, 선택) */
    processingFee?: number | null;
    /** 요청 제품 규격 및 포장 조건 (최대 255자, 선택) */
    requestSpec?: string | null;
    /** 수주일 (yyyy-MM-dd) */
    orderDate: string;
    /** 납기일 (yyyy-MM-dd, 선택) */
    dueDate?: string | null;
    /** 수주 상태 (RECEIVED/IN_PROGRESS/COMPLETED/CANCELLED) - 수정 시 필수 */
    status: FiberSalesOrderStatus | string;
    /** 비고 (최대 255자) */
    note?: string | null;
}

/** 섬유 수주 목록 조회 아이템 응답 */
export interface FiberSalesOrderResponse {
    /** 수주번호 */
    orderCode: string;
    /** 거래처 코드 */
    bpCode: string;
    /** 거래처명 */
    bpNm: string;
    /** 투입원료 품목코드 */
    rawItemCode: string;
    /** 투입원료명 */
    rawItemNm: string;
    /** 투입원료 총량(kg) */
    requestInputQty: number;
    /** 약정 총 가공비(원) */
    processingFee: number | null;
    /** 요청 규격 및 포장 조건 */
    requestSpec: string | null;
    /** 수주일 */
    orderDate: string;
    /** 납기일 */
    dueDate: string | null;
    /** 수주 상태 */
    status: FiberSalesOrderStatus | string;
    /** 제품별 원물 배분 */
    lines: FiberSalesOrderLineResponse[];
    /** 비고 */
    note: string | null;
    /** 생성 일시 */
    createdAt: string;
    /** 수정 일시 */
    updatedAt: string;
}

/** 섬유 수주 라인(제품별 원물 배분) 응답 */
export interface FiberSalesOrderLineResponse {
    /** 라인 ID */
    fiberSalesOrderLineId: number;
    /** 제품 품목코드 */
    productItemCode: string;
    /** 제품명 */
    productItemNm: string;
    /** 제품 단위 */
    productUnit: string;
    /** 배분한 원물 중량(kg) */
    allocatedInputQty: number;
    /** 투입원료 총량 대비 배분 비율(%) - 표시용 계산값, 총량이 없으면 null */
    allocationPercent: number | null;
}

/** 섬유 수주 상세 조회 응답 */
export interface FiberSalesOrderDetailResponse {
    /** 수주번호 */
    orderCode: string;
    /** 거래처 코드 */
    bpCode: string;
    /** 거래처명 */
    bpNm: string;
    /** 투입원료 품목코드 */
    rawItemCode: string;
    /** 투입원료명 */
    rawItemNm: string;
    /** 투입원료 단위 */
    rawUnit: string;
    /** 투입원료 총량(kg) */
    requestInputQty: number;
    /** 제품별 원물 배분 */
    lines: FiberSalesOrderLineResponse[];
    /** 약정 총 가공비(원) */
    processingFee: number | null;
    /** 요청 규격 및 포장 조건 */
    requestSpec: string | null;
    /** 수주일 */
    orderDate: string;
    /** 납기일 */
    dueDate: string | null;
    /** 수주 상태 */
    status: FiberSalesOrderStatus | string;
    /** 비고 */
    note: string | null;
    /** 실제 누적 입고 중량(kg) - 입고가 없으면 0 */
    receivedQty: number;
    /** 연결된 입고 건수 */
    receiptCount: number;
    /** 생성 일시 */
    createdAt: string;
    /** 수정 일시 */
    updatedAt: string;
}

/** 섬유 수주 옵션 조회 응답 (셀렉트박스용) */
export interface FiberSalesOrderOptionResponse {
    /** 수주번호 */
    orderCode: string;
    /** 거래처 코드 */
    bpCode: string;
    /** 거래처명 */
    bpNm: string;
    /** 투입원료 품목코드 */
    rawItemCode: string;
    /** 투입원료명 */
    rawItemNm: string;
    /** 수주 상태 */
    status: FiberSalesOrderStatus | string;
}

/**
 * 섬유 수주 목록 조회 요청 파라미터
 * - GET /fiber-sales-orders 의 쿼리 파라미터
 */
export interface FiberSalesOrderListParams {
    /** 수주번호 */
    orderCode?: string;
    /** 거래처 코드 */
    bpCode?: string;
    /** 투입원료 품목코드 */
    rawItemCode?: string;
    /** 수주 상태 */
    status?: FiberSalesOrderStatus | string;
    /** 수주일 시작 (yyyy-MM-dd) */
    orderDateFrom?: string;
    /** 수주일 종료 (yyyy-MM-dd) */
    orderDateTo?: string;
    /** 페이지 번호 (0부터 시작) */
    page?: number;
    /** 페이지 크기 */
    size?: number;
    /** 정렬 조건 (예: 'orderDate,desc') */
    sort?: string | string[];
    [key: string]: any;
}

/**
 * 섬유 수주 옵션 조회 요청 파라미터
 * - GET /fiber-sales-orders/options 의 쿼리 파라미터
 */
export interface FiberSalesOrderOptionParams {
    /** 거래처 코드 - 지정하면 해당 거래처의 수주만 조회, 생략 시 전체 */
    bpCode?: string;
}


// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 섬유 수주 등록/수정/상세 조회 API 최종 응답 타입 */
export type ApiResponseFiberSalesOrderDetailResponse = ApiResponse<FiberSalesOrderDetailResponse>;

/** 섬유 수주 목록 페이징 데이터 타입 */
export type PageFiberSalesOrderResponse = PageResponse<FiberSalesOrderResponse>;

/** 섬유 수주 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageFiberSalesOrderResponse = ApiResponsePage<FiberSalesOrderResponse>;

/** 섬유 수주 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListFiberSalesOrderOptionResponse = ApiResponse<FiberSalesOrderOptionResponse[]>;


// ── 섬유 수주 관리 API 함수 ───────────────────────────────────────────────────

export const FiberSalesOrderApi = {
    /** 섬유 수주 목록 조회 */
    getList: async (params?: FiberSalesOrderListParams): Promise<ApiResponsePageFiberSalesOrderResponse> => {
        const res = await apiClient.get('/fiber-sales-orders', { params });
        return res.data;
    },

    /** 섬유 수주 단건 상세 조회 (제품별 원물 배분 및 입고 현황 포함) */
    getDetail: async (orderCode: string): Promise<ApiResponseFiberSalesOrderDetailResponse> => {
        const res = await apiClient.get(`/fiber-sales-orders/${orderCode}`);
        return res.data;
    },

    /**
     * 섬유 수주 등록
     * - lines 의 allocatedInputQty 합계는 requestInputQty 와 같아야 한다.
     */
    create: async (data: FiberSalesOrderCreateRequest): Promise<ApiResponseFiberSalesOrderDetailResponse> => {
        const res = await apiClient.post('/fiber-sales-orders', data);
        return res.data;
    },

    /**
     * 섬유 수주 수정
     * - 기존 라인을 갱신하려면 lines 에 fiberSalesOrderLineId 를 지정, 신규 라인은 생략
     * - status 는 필수 (RECEIVED/IN_PROGRESS/COMPLETED/CANCELLED)
     */
    update: async (
        orderCode: string,
        data: FiberSalesOrderUpdateRequest,
    ): Promise<ApiResponseFiberSalesOrderDetailResponse> => {
        const res = await apiClient.put(`/fiber-sales-orders/${orderCode}`, data);
        return res.data;
    },

    /** 섬유 수주 삭제 */
    delete: async (orderCode: string): Promise<ApiResponse<string>> => {
        const res = await apiClient.delete(`/fiber-sales-orders/${orderCode}`);
        return res.data;
    },

    /**
     * 섬유 수주 셀렉트 옵션 조회
     * @param params.bpCode 거래처 코드 (생략 시 전체 조회)
     */
    getOptions: async (params?: FiberSalesOrderOptionParams): Promise<ApiResponseListFiberSalesOrderOptionResponse> => {
        const res = await apiClient.get<ApiResponseListFiberSalesOrderOptionResponse>('/fiber-sales-orders/options', {
            params,
        });
        return res.data;
    },
};
