import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 재고 조정 등록 요청 */
export interface StockAdjustmentRequest {
    productType: number;                // 씨드: 0, 인피: 1
    itemCode: string;
    direction: 'INCREASE' | 'DECREASE'; // 증감구분
    qty: number;                        // 조정 수량 (>= 0.01)
    note?: string | null;               // 비고 (조정 사유)
}

/** 재고이력 정보 응답 아이템 */
export interface StockHistoryResponse {
    sthiId: number; // 재고이력 ID
    itemCode: string;
    itemNm: string; 
    category: number; // 구분 (0: 원료, 1: 반제품, 2: 완제품)
    ioType: string; // 처리구분 (예: 신고입고/신고입고취소/조정)
    increaseQty: number;
    decreaseQty: number;
    processedDate: string;
    note: string;
    createdAt: string;
}


// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 재고 조정 단건 응답 API 최종 응답 타입 */
export type ApiResponseStockHistoryResponse = ApiResponse<StockHistoryResponse>;

/** 재고이력 목록 페이징 데이터 타입 */
export type PageStockHistoryResponse = PageResponse<StockHistoryResponse>;

/** 재고이력 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageStockHistoryResponse = ApiResponsePage<StockHistoryResponse>;


// ── 재고이력 관리 API 함수 ─────────────────────────────────────────────────────

export const StockHistoryApi = {
    /** 재고 조정 등록 */
    adjust: async (data: StockAdjustmentRequest): Promise<ApiResponseStockHistoryResponse> => {
        const res = await apiClient.post('/stock-histories/adjustments', data);
        return res.data;
    },

    /** 재고이력 목록 조회 */
    getList: async (params?: {
        productType?: number;
        category?: number;
        itemCode?: string;
        ioType?: string;
        [key: string]: any;
    }): Promise<ApiResponsePageStockHistoryResponse> => {
        const res = await apiClient.get('/stock-histories', { params });
        return res.data;
    },
};