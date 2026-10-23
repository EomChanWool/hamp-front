import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** LOT 목록 조회 아이템 응답 */
export interface LotResponse {
    lotCode: string;
    perfId: number;
    productionDate: string;
    productionQty: number;
    currentStatus: string;
    shipYn: number;
    labelPrintYn: number;
    createdAt: string;
}

/** LOT 라벨프린터 요청 */
export interface LotLabelPrintRequest {
    lotCodes: string[];
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** LOT 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseLotResponse = ApiResponse<LotResponse>;

/** LOT 목록 페이징 데이터 타입 */
export type PageLotResponse = PageResponse<LotResponse>;

/** LOT 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageLotResponse = ApiResponsePage<LotResponse>;

// ── LOT 관리 API 함수 ────────────────────────────────────────────────────────

export const LotApi = {
    /** LOT 목록 조회 (페이징 및 검색 조건) */
    getList: async (params?: {
        lotCode?: string;
        shipYn?: number;
        productionDateFrom?: string;
        productionDateTo?: string;
        page?: number;
        size?: number;
        sort?: string[];
        [key: string]: any;
    }): Promise<ApiResponsePageLotResponse> => {
        const res = await apiClient.get('/lots', { params });
        return res.data;
    },

    /** LOT 단건 조회 */
    getDetail: async (lotCode: string): Promise<ApiResponseLotResponse> => {
        const res = await apiClient.get(`/lots/${lotCode}`);
        return res.data;
    },

    /** 선택한 LOT 라벨 출력 처리 */
    putLabelPrint: async (data: LotLabelPrintRequest): Promise<ApiResponse<string>> => {
        const res = await apiClient.put('/lots/label-print', data);
        return res.data;
    },
}