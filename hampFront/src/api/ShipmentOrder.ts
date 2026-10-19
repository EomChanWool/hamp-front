import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

// ── 도메인 상수 및 타입 (Literal Types) ────────────────────────────────────────

/** 출고지시서 상태 (WAIT: 대기 / PROGRESS: 진행중 / DONE: 완료 / DELAY: 지연) */
export type ShipmentOrderStatus = 'WAIT' | 'PROGRESS' | 'DONE' | 'DELAY';

/** 출고지시서 상태 → 화면 표시 라벨 (태블릿/관리 화면 공용) */
export const SHIPMENT_STATUS_LABEL: Record<ShipmentOrderStatus, string> = {
    WAIT: '대기',
    PROGRESS: '진행중',
    DONE: '완료',
    DELAY: '지연',
};

/** 출고지시서 라인 요청 (등록 시) */
export interface ShipmentOrderLineRequest {
    salesOrderLineId: number;
    instructQty: number;
}

/** 출고지시서 등록 요청 */
export interface ShipmentOrderCreateRequest {
    orderCode: string;
    shipDate?: string; // 예: "2026-09-01"
    managerId?: string;
    lines: ShipmentOrderLineRequest[];
}

/** 출고지시서 스캔 등록 요청 */
export interface ShipmentOrderScanConfirmRequest {
    shipId: string;
    lotCodes: string[];
}

/** 출고지시서 라인 응답 */
export interface ShipmentOrderLineResponse {
    shipOrderLineId: number;
    salesOrderLineId: number;
    itemCode: string;
    itemNm: string;
    unit: string;
    instructQty: number;
    scannedQty: number;
    remainingQty: number;
}

/** 출고지시서 단건 응답 (lines 포함) - 태블릿 스캔 SSE 결과도 이 형태 그대로 내려옴 */
export interface ShipmentOrderResponse {
    shipId: string;
    orderCode: string;
    shipDate: string;
    status: string; // ShipmentOrderStatus 값이 오지만, 서버 값 확장에 대비해 string으로 받음
    managerId: string;
    managerNm: string;
    lines: ShipmentOrderLineResponse[];
    createdAt: string;
    updatedAt: string;
}

/** 출고지시서 목록 조회 아이템 응답 (요약 정보) */
export interface ShipmentOrderListResponse {
    shipId: string;
    orderCode: string;
    bpNm: string;
    shipDate: string;
    status: string;
    managerId: string;
    managerNm: string;
    lineCount: number;
    totalInstructQty: number;
    createdAt: string;
    updatedAt: string;
}

/** 출고지시서 등록 화면용 수주 라인 응답 */
export interface ShipmentSalesOrderLineResponse {
    salesOrderLineId: number;
    itemCode: string;
    itemNm: string;
    unit: string;
    orderQty: number;
    availableQty: number;
    shippedQty: number;
    productionStatus: string;
}

/** 출고지시서 등록 화면용 수주 응답 */
export interface ShipmentSalesOrderResponse {
    orderCode: string;
    bpNm: string;
    dueDate: string;
    status: string;
    lines: ShipmentSalesOrderLineResponse[];
    shipmentOrderCount: number;
}

/** 바코드 스캔 REST 응답 타입 (래퍼 형태) */
export interface ShipmentOrderScanResponse {
    status: string;
    code: string;
    message?: string;
    data: ShipmentOrderResponse | string;
}

/** 태블릿 SSE 스캔 실패 이벤트 - 성공 응답과 같은 "scan" 이벤트로 { status: "NG", code, message }가 내려옴 */
export interface ShipmentScanFailure {
    status: 'NG';
    code: string;
    message: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 출고지시서 수주라인 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseShipmentSalesOrderResponse = ApiResponse<ShipmentSalesOrderResponse>;

/** 출고지시서 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseShipmentOrderResponse = ApiResponse<ShipmentOrderResponse>;

/** 출고지시서 목록 페이징 데이터 타입 */
export type PageShipmentOrderListResponse = PageResponse<ShipmentOrderListResponse>;

/** 출고지시서 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageShipmentOrderListResponse = ApiResponsePage<ShipmentOrderListResponse>;

// ── 출고지시서 관리 API 함수 ────────────────────────────────────────────────────────

export const ShipmentOrderApi = {
    /** 출고지시서 등록 화면용 수주 조회 */
    getSalesOrderForShipment: async (orderCode: string): Promise<ApiResponseShipmentSalesOrderResponse> => {
        const res = await apiClient.get(`/shipment-orders/sales-orders/${encodeURIComponent(orderCode)}`);
        return res.data;
    },

    /** 출고지시서 등록 */
    create: async (data: ShipmentOrderCreateRequest): Promise<ApiResponseShipmentOrderResponse> => {
        const res = await apiClient.post<ApiResponseShipmentOrderResponse>('/shipment-orders', data);
        return res.data;
    },

    /** 출고지시서 목록 조회 */
    getList: async (params?: {
        orderCode?: string;
        status?: string;
        managerId?: string;
        shipDateFrom?: string;
        shipDateTo?: string;
        page?: number;
        size?: number;
        sort?: string | string[];
        [key: string]: any;
    }): Promise<ApiResponsePageShipmentOrderListResponse> => {
        const res = await apiClient.get('/shipment-orders', { params });
        return res.data;
    },

    /** 출고지시서 단건 조회 */
    getDetail: async (shipId: string): Promise<ApiResponseShipmentOrderResponse> => {
        const res = await apiClient.get(`/shipment-orders/${shipId}`);
        return res.data;
    },

    /** 출고지시서 바코드 직접 스캔 */
    scan: async (code: string, zone: number): Promise<ShipmentOrderScanResponse> => {
        const res = await apiClient.get<ShipmentOrderScanResponse>('/shipment-orders/scan', {
            params: { code, zone },
        });
        return res.data;
    },

    /** 출고지시서 스캔 확정 등록 */
    confirmScan: async (data: ShipmentOrderScanConfirmRequest): Promise<ApiResponseShipmentOrderResponse> => {
        const res = await apiClient.post<ApiResponseShipmentOrderResponse>('/shipment-orders/scan/confirm', data);
        return res.data;
    },
};
