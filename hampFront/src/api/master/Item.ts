import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

// ══════════════════════════════════════════════════════════════════════════════
// 도메인 상수 및 타입 (Literal Types)
// ══════════════════════════════════════════════════════════════════════════════

/** 종류 (0: 식품, 1: 작물) */
export type ProductType = 0 | 1;

/** 품목 구분 (0: 원료, 1: 반제품, 2: 완제품) */
export type ItemCategory = 0 | 1 | 2;

/**
 * 단독생산 전용 여부 (0: 아니오, 1: 예)
 * 1이면 수주 산출라인에서 다른 품목과 조합 불가
 */
export type SoleProductionYn = 0 | 1;

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

/** 단독생산 전용 여부 매핑 라벨 (화면 표시용) */
export const SOLE_PRODUCTION_LABEL: Record<SoleProductionYn, string> = {
  0: '아니오',
  1: '예',
} as const;

/** 자재 입출 구분 (IN: 투입, OUT: 산출) */
export type MaterialIoType = 'IN' | 'OUT';

// ══════════════════════════════════════════════════════════════════════════════
// Sub Models (공정 라우팅)
// ══════════════════════════════════════════════════════════════════════════════

/** 공정 라우팅 투입산출 자재 요청 */
export interface RoutingMaterialRequest {
  itemCode: string;
  ioType: MaterialIoType;
  /**
   * 계획 수율(%) (0 ~ 100)
   * - 투입 자재 합 대비 이 산출자재의 예상 생산 비율
   * - 산출(OUT) 자재에만 입력 가능, 수율 데이터가 없으면 비워둘 수 있음
   */
  yieldRate?: number | null;
}

/** 공정 라우팅 요청 */
export interface ItemRoutingRequest {
  operCode?: string | null;
  operSeq?: number | null;
  /**
   * 최종 공정 여부 ('Y' | 'N' | 'G')
   * - Y: 전체공정 최종 (LOT·재고 트리거)
   * - N: 일반
   * - G: 일반공정 최종 (수율 확정 지점 - 포장 등 Y 이전에 수율이 이미 확정될 때 선택 사용)
   */
  finalYn?: string | null;
  materials?: RoutingMaterialRequest[] | null;
}

/** 공정 라우팅 투입산출 자재 응답 */
export interface RoutingMaterialResponse {
  routingMtrlId: number;
  itemCode: string;
  itemNm: string;
  unit: string;
  ioType: MaterialIoType;
  /**
   * 계획 수율(%)
   * - OUT 자재만 값이 있을 수 있음, 미확정이면 null
   */
  yieldRate: number | null;
}

/** 공정 라우팅 응답 */
export interface ItemRoutingResponse {
  routingId: number;
  itemCode: string;
  operCode: string;
  operNm: string;
  operSeq: number;
  /** 최종 공정 여부 (Y: 전체공정 최종, N: 일반, G: 일반공정 최종/수율 확정 지점) */
  finalYn: string;
  materials: RoutingMaterialResponse[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub Models (품목 생산 체인)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 품목 생산 체인 응답 (GET /items/{itemCode}/routing-chain)
 * - 품목의 공정 라우팅과, 그 라우팅의 투입(IN) 자재를 만드는 생산 공정까지 재귀적으로 포함
 * - inputChains 안의 각 요소가 다시 ItemRoutingChainResponse 구조 (트리 형태)
 */
export interface ItemRoutingChainResponse {
  itemCode: string;
  itemNm: string;
  unit: string;
  /**
   * 부산물 원천 품목 코드
   * - 다른 품목 공정의 부산물로 생산되는 경우 그 품목 코드
   * - 자기 자신의 라우팅으로 생산되거나, 라우팅 자체가 없는 원물이면 null
   */
  byproductOfItemCode: string | null;
  /**
   * 이 품목(부산물이면 byproductOfItemCode 품목)의 공정 라우팅 전체
   * - 등록된 라우팅이 없는 원물이면 빈 배열
   */
  routings: ItemRoutingResponse[];
  /**
   * 위 라우팅들에 등록된 투입(IN) 자재의 생산 체인 (재귀)
   * - 더 거슬러 올라갈 라우팅이 없으면 빈 배열
   */
  inputChains: ItemRoutingChainResponse[];
}

// ══════════════════════════════════════════════════════════════════════════════
// 요청 모델
// ══════════════════════════════════════════════════════════════════════════════

/** 품목 등록 요청 */
export interface ItemCreateRequest {
  itemCode: string;
  productType?: ProductType | null; // 종류 (0: 식품, 1: 작물)
  category?: ItemCategory | null;   // 품목 구분 (0: 원료, 1: 반제품, 2: 완제품)
  itemNm?: string | null;
  unit?: string | null;
  standard?: string | null;
  /** 단독생산 전용 여부 (미입력 시 서버에서 0 처리) */
  soleProductionYn?: SoleProductionYn | null;
  routings?: ItemRoutingRequest[] | null;
}

/** 품목 수정 요청 */
export interface ItemUpdateRequest {
  productType?: ProductType | null; // 종류 (0: 식품, 1: 작물)
  category?: ItemCategory | null;   // 품목 구분 (0: 원료, 1: 반제품, 2: 완제품)
  itemNm?: string | null;
  unit?: string | null;
  standard?: string | null;
  /** 단독생산 전용 여부 (미입력 시 서버에서 0 처리) */
  soleProductionYn?: SoleProductionYn | null;
  routings?: ItemRoutingRequest[] | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 응답 모델
// ══════════════════════════════════════════════════════════════════════════════

/** 품목 목록 조회 아이템 응답 */
export interface ItemResponse {
  itemCode: string;
  productType: ProductType;
  category: ItemCategory;
  itemNm: string;
  unit: string;
  standard: string;
  useYn: string;
  /** 단독생산 전용 여부 (0: 아니오, 1: 예) */
  soleProductionYn: SoleProductionYn;
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
  /** 단독생산 전용 여부 (0: 아니오, 1: 예) */
  soleProductionYn: SoleProductionYn;
  createdAt: string;
  updatedAt: string;
  routings: ItemRoutingResponse[]; // 상세 조회 시 라우팅 정보 목록 포함
}

/** 품목 옵션 조회 응답 */
export interface ItemOptionResponse {
  itemCode: string;
  itemNm: string;
  unit: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// API 최종 응답 타입
// ══════════════════════════════════════════════════════════════════════════════

/** 품목 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseItemResponse = ApiResponse<ItemResponse>;

/** 품목 상세 조회 API 최종 응답 타입 */
export type ApiResponseItemDetailResponse = ApiResponse<ItemDetailResponse>;

/** 품목 목록 페이징 데이터 타입 */
export type PageItemResponse = PageResponse<ItemResponse>;

/** 품목 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageItemResponse = ApiResponsePage<ItemResponse>;

/** 품목 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListItemOptionResponse = ApiResponse<ItemOptionResponse[]>;

/** 품목 생산 체인 조회 API 최종 응답 타입 */
export type ApiResponseItemRoutingChainResponse = ApiResponse<ItemRoutingChainResponse>;

// ══════════════════════════════════════════════════════════════════════════════
// 품목 관리 API 함수
// ══════════════════════════════════════════════════════════════════════════════

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
    [key: string]: any; // page, size, sort 등 pageable 파라미터
  }): Promise<ApiResponsePageItemResponse> => {
    const res = await apiClient.get<ApiResponsePageItemResponse>('/items', { params });
    return res.data;
  },

  /** 품목 단건 상세 조회 (라우팅/자재 포함) */
  getDetail: async (itemCode: string): Promise<ApiResponseItemDetailResponse> => {
    const res = await apiClient.get<ApiResponseItemDetailResponse>(`/items/${itemCode}`);
    return res.data;
  },

  /**
   * 품목 생산 체인 조회
   * - 투입 자재의 생산 공정까지 재귀적으로 포함 (수주 품목의 생산 흐름 표출용)
   * @param itemCode 품목 코드 (path)
   */
  getRoutingChain: async (itemCode: string): Promise<ApiResponseItemRoutingChainResponse> => {
    const res = await apiClient.get<ApiResponseItemRoutingChainResponse>(`/items/${itemCode}/routing-chain`);
    return res.data;
  },

  /** 품목 등록 */
  create: async (data: ItemCreateRequest): Promise<ApiResponseItemResponse> => {
    const res = await apiClient.post<ApiResponseItemResponse>('/items', data);
    return res.data;
  },

  /** 품목 수정 */
  update: async (itemCode: string, data: ItemUpdateRequest): Promise<ApiResponseItemResponse> => {
    const res = await apiClient.put<ApiResponseItemResponse>(`/items/${itemCode}`, data);
    return res.data;
  },

  /** 품목 비활성화 (소프트 삭제 - USE_YN='N') */
  delete: async (itemCode: string): Promise<ApiResponse<string>> => {
    const res = await apiClient.delete<ApiResponse<string>>(`/items/${itemCode}`);
    return res.data;
  },

  /** 품목 셀렉트 옵션 조회 */
  getOptions: async (params?: {
    productType?: ProductType; // 0: 식품, 1: 작물 (안 보내면 전체)
    category?: ItemCategory[]; // 0: 원료, 1: 반제품, 2: 완제품
    [key: string]: any;
  }): Promise<ApiResponseListItemOptionResponse> => {
    const res = await apiClient.get<ApiResponseListItemOptionResponse>('/items/options', { params });
    return res.data;
  },
};
