import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';

/** 품목 재고 현황 응답 아이템 */
export interface ItemStockResponse {
    itemCode: string;
    itemNm: string;
    category: number;
    unit: string;
    currentQty: number;
    lastUpdatedAt: string;
}

/** 품목별 재고 추이 포인트 */
export interface ItemStockTrendPoint {
    periodStart: string; // 구간 시작일
    qty: number;         // 그 구간 종료 시점의 재고량
}

/** 품목별 재고 추이 응답 */
export interface ItemStockTrendResponse {
    itemCode: string;
    itemNm: string;
    period: string; // 기간 단위 (month/quarter/year)
    points: ItemStockTrendPoint[];
}

/** 품목별 구분별 재고 요약 아이템 */
export interface ItemStockCategorySummary {
    category: number;        // 구분 (0: 원료, 1: 반제품, 2: 완제품)
    currentQty: number;      // 그 구분의 현재 재고량 합계
    todayIncreaseQty: number;// 그 구분의 금일 입고량 합계
    todayDecreaseQty: number;// 그 구분의 금일 출고량 합계
}

/** 재고 현황 구분별 요약 응답 */
export interface ItemStockSummaryResponse {
    grandTotalQty: number; // 전체 재고량 합계
    categories: ItemStockCategorySummary[];
}


// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 품목 재고 조회 API 최종 응답 타입 */
export type ApiResponseListItemStockResponse = ApiResponse<ItemStockResponse[]>;

/** 품목별 재고 추이 조회 API 최종 응답 타입 */
export type ApiResponseItemStockTrendResponse = ApiResponse<ItemStockTrendResponse>;

/** 재고 현황 구분별 요약 조회 API 최종 응답 타입 */
export type ApiResponseItemStockSummaryResponse = ApiResponse<ItemStockSummaryResponse>;


// ── 품목 재고현황 API 함수 ─────────────────────────────────────────────────────

export const ItemStockApi = {
    /** 품목별 현재 재고 조회 */
    getList: async (params?: {
        category?: number;
        [key: string]: any;
    }): Promise<ApiResponseListItemStockResponse> => {
        const res = await apiClient.get('/item-stocks', { params });
        return res.data;
    },

    /** 품목별 재고 추이 조회 */
    getTrend: async (
        itemCode: string,
        params?: {
            period?: string; // 기본값: 'month' 등
            [key: string]: any;
        }
    ): Promise<ApiResponseItemStockTrendResponse> => {
        const res = await apiClient.get(`/item-stocks/${itemCode}/trend`, { params });
        return res.data;
    },

    /** 재고 현황 구분별 요약 조회 */
    getSummary: async (params?: {
        productType?: number;
        [key: string]: any;
    }): Promise<ApiResponseItemStockSummaryResponse> => {
        const res = await apiClient.get('/item-stocks/summary', { params });
        return res.data;
    },
};