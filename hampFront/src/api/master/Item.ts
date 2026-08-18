import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

// 도메인 상수 및 타입 (Literal Types)

/** 종류 (0: 식품, 1: 작물) */
export type ProductType = 0 | 1;

/** 품목 구분 (0: 원료, 1: 반제품, 2: 완제품) */
export type ItemCategory = 0 | 1 | 2;

/** 종류 매핑 라벨 (화면 표시용) */
export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  0: '식품',
  1: '작물',
} as const;

/** 품목 구분 매핑 라벨 (화면 표시용) */
export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  0: '원료',
  1: '반제품',
  2: '완제품',
} as const;

// Sub Models (공정 라우팅)

/** 공정 라우팅 요청 */
export interface ItemRoutingRequest {
  operCode?: string | null;
  operSeq?: number | null;  
  finalYn?: string | null;  
}

/** 공정 라우팅 응답 */
export interface ItemRoutingResponse {
  routingId: number;
  itemCode: string;
  operCode: string;
  operSeq: number;
  finalYn: string;
}

/** 품목 등록 요청 */
export interface ItemCreateRequest {
  itemCode: string;                 
  productType?: ProductType | null; // 종류 (0: 식품, 1: 작물)
  category?: ItemCategory | null;   // 품목 구분 (0: 원료, 1: 반제품, 2: 완제품)
  itemNm?: string | null;           
  unit?: string | null;             
  standard?: string | null;         
  routings?: ItemRoutingRequest[] | null; 
}

/** 품목 수정 요청 */
export interface ItemUpdateRequest {
  productType?: ProductType | null; // 종류 (0: 식품, 1: 작물)
  category?: ItemCategory | null;   // 품목 구분 (0: 원료, 1: 반제품, 2: 완제품)
  itemNm?: string | null;          
  unit?: string | null;            
  standard?: string | null;        
  routings?: ItemRoutingRequest[] | null;
}

/** 품목 목록 조회 아이템 응답 */
export interface ItemResponse {
  itemCode: string;
  productType: ProductType;
  category: ItemCategory;
  itemNm: string;
  unit: string;
  standard: string;
  useYn: string;
  createdAt: string; 
  updatedAt: string;
}

/** 품목 상세 조회 응답 */
export interface ItemDetailResponse {
  itemCode: string;
  productType: ProductType;
  category: ItemCategory;
  itemNm: string;
  unit: string;
  standard: string;
  useYn: string;
  createdAt: string;
  updatedAt: string;
  routings: ItemRoutingResponse[]; // 상세 조회 시 라우팅 정보 목록 포함
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 품목 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseItemResponse = ApiResponse<ItemResponse>;

/** 품목 상세 조회 API 최종 응답 타입 */
export type ApiResponseItemDetailResponse = ApiResponse<ItemDetailResponse>;

/** 품목 목록 페이징 데이터 타입 */
export type PageItemResponse = PageResponse<ItemResponse>;

/** 품목 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageItemResponse = ApiResponsePage<ItemResponse>;

/** 품목 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListItemOptionResponse = ApiResponse<Pick<ItemResponse, 'itemCode' | 'itemNm'>[]>;

// ── 품목 관리 API 함수 ────────────────────────────────────────────────────────

export const ItemApi = {
  /** 품목 목록 조회 */
  getList: async (params?: {
    itemCode?: string;
    productType?: ProductType;
    category?: ItemCategory;
    itemNm?: string;
    unit?: string;
    standard?: string;
    useYn?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageItemResponse> => {
    const res = await apiClient.get('/items', { params });
    return res.data;
  },

  /** 품목 단건 상세 조회 */
  getDetail: (itemCode: string): Promise<ApiResponseItemDetailResponse> =>
    apiClient.get(`/items/${itemCode}`),

  /** 품목 등록 */
  create: (data: ItemCreateRequest): Promise<ApiResponseItemResponse> =>
    apiClient.post('/items', data),

  /** 품목 수정 */
  update: (itemCode: string, data: ItemUpdateRequest): Promise<ApiResponseItemResponse> =>
    apiClient.put(`/items/${itemCode}`, data),

  /** 품목 비활성화 (소프트 삭제) */
  delete: (itemCode: string): Promise<ApiResponse<string>> =>
    apiClient.delete(`/items/${itemCode}`),
};