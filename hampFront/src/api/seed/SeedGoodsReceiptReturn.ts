import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 씨드 신고처리 수정 요청 */
export interface SeedGoodsReceiptReturnUpdateRequest {
    returnQty: number;
    reportDate: string;
    returnDueDate: string;
    processStatus: number;
}

/** 씨드 신고처리 전체 목록 조회 아이템 응답 (itemCode, itemNm 포함) */
export interface SeedGoodsReceiptReturnItemResponse {
    returnId: number;
    receiptId: number;
    itemCode: string;
    itemNm: string;
    returnQty: number;
    reportDate: string;
    returnDueDate: string;
    processStatus: number;
    createdAt: string;
    updatedAt: string;
}

/** 씨드 신고처리 단건 응답 (수정 등) */
export interface SeedGoodsReceiptReturnResponse {
    returnId: number;
    receiptId: number;
    returnQty: number;
    reportDate: string;
    returnDueDate: string;
    processStatus: number;
    createdAt: string;
    updatedAt: string;
}


// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 씨드 신고처리 단건 응답 API 최종 응답 타입 */
export type ApiResponseSeedGoodsReceiptReturnResponse = ApiResponse<SeedGoodsReceiptReturnResponse>;

/** 씨드 신고처리 목록 페이징 데이터 타입 */
export type PageSeedGoodsReceiptReturnResponse = PageResponse<SeedGoodsReceiptReturnItemResponse>;

/** 씨드 신고처리 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageSeedGoodsReceiptReturnResponse = ApiResponsePage<SeedGoodsReceiptReturnItemResponse>;


// ── 씨드 신고 관리 API 함수 ──────────────────────────────────────────────────

export const SeedGoodsReceiptReturnApi = {
    /** 씨드 신고처리 전체 목록 조회 (페이징 및 검색) */
    getList: async (params?: {
        itemCode?: string;
        processStatus?: number;
        [key: string]: any;
    }): Promise<ApiResponsePageSeedGoodsReceiptReturnResponse> => {
        const res = await apiClient.get('/seed-goods-receipt-returns', { params });
        return res.data;
    },

    /** 씨드 신고처리 수정 */
    update: async (
        returnId: number, 
        data: SeedGoodsReceiptReturnUpdateRequest
    ): Promise<ApiResponseSeedGoodsReceiptReturnResponse> => {
        const res = await apiClient.put(`/seed-goods-receipt-returns/${returnId}`, data);
        return res.data;
    },

    /** 씨드 신고처리 삭제 */
    delete: async (returnId: number): Promise<ApiResponse<string>> => {
        const res = await apiClient.delete(`/seed-goods-receipt-returns/${returnId}`);
        return res.data;
    },
};