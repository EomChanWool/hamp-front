import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 씨드 입고 등록 요청 (품목은 수주의 투입원료로 서버가 정함) */
export interface SeedGoodsReceiptCreateRequest {
  orderCode: string;
  receiptQty: number;
  boxQty: number;
  receivedAt: string;
  note?: string;
}

/** 씨드 입고 수정 요청 */
export interface SeedGoodsReceiptUpdateRequest {
  orderCode: string;
  receiptQty: number;
  boxQty: number;
  receivedAt: string;
  note?: string;
}

/** 씨드 입고 응답 */
export interface SeedGoodsReceiptResponse {
  receiptId: number;
  itemCode: string;
  itemNm: string | null;
  unit: string | null;
  barcode: string;
  orderCode: string | null;
  bpNm: string | null;
  receiptQty: number;
  boxQty: number | null;
  labelPrinted: boolean;
  note: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** 수주별 원료 입고 현황 집계 응답 */
export interface SeedGoodsReceiptOrderSummaryResponse {
  orderCode: string;
  bpNm: string | null;
  itemCode: string | null;
  itemNm: string | null;
  unit: string | null;
  orderQty: number | null;
  receivedQty: number;
  receiptCount: number;
  orderStatus: string | null;
  status: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 씨드 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseSeedGoodsReceiptResponse = ApiResponse<SeedGoodsReceiptResponse>;

/** 씨드 목록 페이징 데이터 타입 */
export type PageSeedGoodsReceiptResponse = PageResponse<SeedGoodsReceiptResponse>;

/** 씨드 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageSeedGoodsReceiptResponse = ApiResponsePage<SeedGoodsReceiptResponse>;

/** 수주별 원료 입고 현황 API 최종 응답 타입 */
export type ApiResponseListSeedGoodsReceiptOrderSummaryResponse = ApiResponse<SeedGoodsReceiptOrderSummaryResponse[]>;

// ── 씨드 관리 API 함수 ────────────────────────────────────────────────────────

export const SeedGoodsReceiptApi = {
  /** 씨드 입고 목록 조회 */
  getList: async (params?: {
    itemCode?: string;
    orderCode?: string;
    receivedAtFrom?: string;
    receivedAtTo?: string;
    page?: number;
    size?: number;
    sort?: string | string[];
  }): Promise<ApiResponsePageSeedGoodsReceiptResponse> => {
    const res = await apiClient.get<ApiResponsePageSeedGoodsReceiptResponse>('/seed-goods-receipts', { params });
    return res.data;
  },

  /** 수주별 원료 입고 현황 집계 조회 */
  getOrderSummary: async (params?: {
    orderCode?: string;
    status?: string;
  }): Promise<ApiResponseListSeedGoodsReceiptOrderSummaryResponse> => {
    const res = await apiClient.get<ApiResponseListSeedGoodsReceiptOrderSummaryResponse>(
      '/seed-goods-receipts/order-summary',
      { params },
    );
    return res.data;
  },

  /** 씨드 입고 라벨 인쇄 완료 표시 */
  markPrinted: async (receiptIds: number[]): Promise<ApiResponse<void>> => {
    const res = await apiClient.post('/seed-goods-receipts/mark-printed', receiptIds);
    return res.data;
  },

  /** 씨드 입고 단건 조회 */
  getDetail: async (receiptId: number): Promise<ApiResponseSeedGoodsReceiptResponse> => {
    const res = await apiClient.get<ApiResponseSeedGoodsReceiptResponse>(`/seed-goods-receipts/${receiptId}`);
    return res.data;
  },

  /** 씨드 입고 라벨 바코드 스캔 조회 */
  scan: async (code: string, zone: number): Promise<ApiResponseSeedGoodsReceiptResponse> => {
    const res = await apiClient.get<ApiResponseSeedGoodsReceiptResponse>('/seed-goods-receipts/scan', {
      params: { code, zone },
    });
    return res.data;
  },

  /** 씨드 입고 등록 */
  create: async (data: SeedGoodsReceiptCreateRequest): Promise<ApiResponseSeedGoodsReceiptResponse> => {
    const res = await apiClient.post('/seed-goods-receipts', data);
    return res.data;
  },

  /** 씨드 입고 수정 */
  update: async (receiptId: number, data: SeedGoodsReceiptUpdateRequest): Promise<ApiResponseSeedGoodsReceiptResponse> => {
    const res = await apiClient.put(`/seed-goods-receipts/${receiptId}`, data);
    return res.data;
  },

  /** 씨드 입고 삭제 */
  delete: async (receiptId: number): Promise<ApiResponse<string>> => {
    const res = await apiClient.delete(`/seed-goods-receipts/${receiptId}`);
    return res.data;
  }
};

// // ── 씨드 입고 스캔 스트림 (SSE) API ──────────────────────────────────────────────

// export const SeedGoodsReceiptStreamApi = {
//   /** 신고처리 스캔 결과 실시간 구독 (SSE) */
//   subscribeScanStream: (
//     onMessage: (event: MessageEvent) => void,
//     onError?: (error: Event) => void
//   ): EventSource => {
//     // API 베이스 URL이 있다면 조합해서 사용
//     const eventSource = new EventSource('/seed-goods-receipts/scan/stream');

//     eventSource.onmessage = (event) => {
//       onMessage(event);
//     };

//     eventSource.onerror = (error) => {
//       if (onError) onError(error);
//     };

//     return eventSource; // 컴포넌트 unmount 시 .close() 호출을 위해 반환
//   },
// };
