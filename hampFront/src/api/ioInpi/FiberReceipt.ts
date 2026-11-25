import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 인피(섬유) 입고 등록 요청 */
export interface FiberReceiptCreateRequest {
  bpCode: string;
  orderCode?: string;
  rawItemCode: string;
  receiptQty: number;
  storId?: string;
  receivedAt: string;
  note?: string;
}

/** 인피(섬유) 입고 수정 요청 */
export type FiberReceiptUpdateRequest = FiberReceiptCreateRequest;

/** 인피(섬유) 입고 응답 */
export interface FiberReceiptResponse {
  receiptId: number;
  receiptLotCode: string;
  bpCode: string;
  bpNm: string | null;
  orderCode: string | null;
  rawItemCode: string;
  rawItemNm: string | null;
  unit: string | null;
  receiptQty: number;
  storId: string | null;
  receivedAt: string;
  receivedBy: string | null;
  labelPrinted: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 인피(섬유) 입고 목록 조회 파라미터 */
export interface FiberReceiptListParams {
  receiptLotCode?: string;
  bpCode?: string;
  orderCode?: string;
  rawItemCode?: string;
  labelPrinted?: boolean;
  receivedAtFrom?: string;
  receivedAtTo?: string;
  page?: number;
  size?: number;
  sort?: string | string[];
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

export type ApiResponseFiberReceiptResponse = ApiResponse<FiberReceiptResponse>;

export type PageFiberReceiptResponse = PageResponse<FiberReceiptResponse>;

export type ApiResponsePageFiberReceiptResponse = ApiResponsePage<FiberReceiptResponse>;

// ── 인피 입고 API 함수 ────────────────────────────────────────────────────────

export const FiberReceiptApi = {
  /** 인피 입고 목록 조회 */
  getList: async (params?: FiberReceiptListParams): Promise<ApiResponsePageFiberReceiptResponse> => {
    const res = await apiClient.get<ApiResponsePageFiberReceiptResponse>('/fiber-receipts', { params });
    return res.data;
  },

  /** 인피 입고 단건 조회 */
  getDetail: async (receiptId: number): Promise<ApiResponseFiberReceiptResponse> => {
    const res = await apiClient.get<ApiResponseFiberReceiptResponse>(`/fiber-receipts/${receiptId}`);
    return res.data;
  },

  /** 인피 입고 등록 */
  create: async (data: FiberReceiptCreateRequest): Promise<ApiResponseFiberReceiptResponse> => {
    const res = await apiClient.post<ApiResponseFiberReceiptResponse>('/fiber-receipts', data);
    return res.data;
  },

  /** 인피 입고 수정 */
  update: async (receiptId: number, data: FiberReceiptUpdateRequest): Promise<ApiResponseFiberReceiptResponse> => {
    const res = await apiClient.put<ApiResponseFiberReceiptResponse>(`/fiber-receipts/${receiptId}`, data);
    return res.data;
  },

  /** 인피 입고 삭제 */
  delete: async (receiptId: number): Promise<ApiResponse<void>> => {
    const res = await apiClient.delete<ApiResponse<void>>(`/fiber-receipts/${receiptId}`);
    return res.data;
  },

  /** 인피 입고 LOT 라벨 인쇄 완료 표시 */
  markPrinted: async (receiptIds: number[]): Promise<ApiResponse<void>> => {
    const res = await apiClient.post<ApiResponse<void>>('/fiber-receipts/mark-printed', receiptIds);
    return res.data;
  },
};
