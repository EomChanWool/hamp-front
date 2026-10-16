import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

export interface ShipmentOrderLineRequest {
    salesOrderLineId: number;
    instructQty: number;
}

export interface ShipmentOrderCreateRequest {
    orderCode: string;
    shipDate?: string;
    managerId?: string;
    lines: ShipmentOrderLineRequest[];
}

export interface ShipmentOrderLineResponse {
    shipOrderLineId: number;
    salesOrderLineId: number;
    itemCode: string;
    itemNm: string;
    unit: string;
    instructQty: number;
}

export interface ShipmentOrderResponse {
    shipId: string;
    orderCode: string;
    shipDate: string;
    status: string;
    managerId: string;
    managerNm: string;
    lines: ShipmentOrderLineResponse[];
    createdAt: string;
    updatedAt: string;
}

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

export interface ShipmentSalesOrderResponse {
    orderCode: string;
    bpNm: string;
    dueDate: string;
    status: string;
    lines: ShipmentSalesOrderLineResponse[];
    shipmentOrderCount: number;
}

// 바코드 스캔 응답 타입
export interface ShipmentOrderScanResponse {
    status: string;
    code: string;
    message?: string;
    data: ShipmentOrderResponse | string;
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
    scan: async (
        code: string,
        zone: number,
    ): Promise<ShipmentOrderScanResponse> => {
        const res = await apiClient.get<ShipmentOrderScanResponse>(
            '/shipment-orders/scan',
            {
                params: { code, zone },
            },
        );

        return res.data;
    },
}