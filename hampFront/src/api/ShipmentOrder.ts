import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';


export interface ShipmentSalesOrderLineResponse {
    salesOrderLineId: number;
    itemCode: string;
    itemNm: string;
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

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 출고지시서 관리 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseShipmentSalesOrderResponse = ApiResponse<ShipmentSalesOrderResponse>;

// ── 출고지시서 관리 API 함수 ────────────────────────────────────────────────────────

export const ShipmentOrderApi = {
    /** 출고지시서 등록 화면용 수주 조회 */
    getSalesOrderForShipment: async (orderCode: string): Promise<ApiResponseShipmentSalesOrderResponse> => {
        const res = await apiClient.get(`/shipment-orders/sales-orders/${encodeURIComponent(orderCode)}`);
        return res.data;
    },
}