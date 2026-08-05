import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

// ==========================================
// 1. 도메인 상수 및 타입 (Literal Types)
// ==========================================

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

// ==========================================
// 2. Sub Models (공정 라우팅)
// ==========================================

/** 공정 라우팅 요청 (ItemRoutingRequest) */
export interface ItemRoutingRequest {
  operCode?: string | null; // 공정 코드
  operSeq?: number | null;  // 공정 순서
  finalYn?: string | null;  // 최종 공정 여부
}

/** 공정 라우팅 응답 (ItemRoutingResponse) */
export interface ItemRoutingResponse {
  routingId: number;
  itemCode: string;
  operCode: string;
  operSeq: number;
  finalYn: string;
}

// ==========================================
// 3. Request DTOs
// ==========================================

/** 품목 등록 요청 (ItemCreateRequest) */
export interface ItemCreateRequest {
  itemCode: string;                 // 품목 코드 (필수, 최대 30자)
  productType?: ProductType | null; // 종류 (0: 식품, 1: 작물)
  category?: ItemCategory | null;   // 품목 구분 (0: 원료, 1: 반제품, 2: 완제품)
  itemNm?: string | null;           // 품목명
  unit?: string | null;             // 단위
  standard?: string | null;         // 규격
  routings?: ItemRoutingRequest[] | null; // 반제품·완제품 공정 라우팅
}

/** 품목 수정 요청 (ItemUpdateRequest) */
export interface ItemUpdateRequest {
  productType?: ProductType | null; // 종류 (0: 식품, 1: 작물)
  category?: ItemCategory | null;   // 품목 구분 (0: 원료, 1: 반제품, 2: 완제품)
  itemNm?: string | null;           // 품목명 (최대 100자)
  unit?: string | null;             // 단위 (최대 30자)
  standard?: string | null;         // 규격 (최대 100자)
  routings?: ItemRoutingRequest[] | null; // 반제품·완제품 공정 라우팅
}

// ==========================================
// 4. Response DTOs
// ==========================================

/** 품목 목록 조회 아이템 응답 (ItemResponse) */
export interface ItemResponse {
  itemCode: string;
  productType: ProductType;
  category: ItemCategory;
  itemNm: string;
  unit: string;
  standard: string;
  useYn: string;
  createdAt: string; // ISO date-time string
  updatedAt: string; // ISO date-time string
}

/** 품목 상세 조회 응답 (ItemDetailResponse) */
export interface ItemDetailResponse {
  itemCode: string;
  productType: ProductType;
  category: ItemCategory;
  itemNm: string;
  unit: string;
  standard: string;
  useYn: string;
  createdAt: string; // ISO date-time string
  updatedAt: string; // ISO date-time string
  routings: ItemRoutingResponse[]; // 상세 조회 시 라우팅 정보 목록 포함
}

// ==========================================
// 5. Final API Response Types
// ==========================================

/** 품목 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseItemResponse = ApiResponse<ItemResponse>;

/** 품목 상세 조회 API 최종 응답 타입 */
export type ApiResponseItemDetailResponse = ApiResponse<ItemDetailResponse>;

/** 품목 목록 페이징 데이터 타입 */
export type PageItemResponse = PageResponse<ItemResponse>;

/** 품목 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageItemResponse = ApiResponsePage<ItemResponse>;