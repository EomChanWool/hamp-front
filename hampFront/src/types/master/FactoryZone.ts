import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

/** 공장 등록 요청 */
export interface FactoryZoneCreateRequest {
  facCode: string;
  facNm?: string | null;
  location?: string | null;
  note?: string | null;
}

/** 공장 정보 수정 요청 */
export interface FactoryZoneUpdateRequest {
  facNm?: string | null;
  location?: string | null;
  note?: string | null;
}

/** 공장 정보 응답 */
export interface FactoryZoneResponse {
  facCode: string;
  facNm: string;
  location: string;
  useYn: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 공장 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseFactoryZoneResponse = ApiResponse<FactoryZoneResponse>;

/** 공장 목록 페이징 데이터 타입 */
export type PageFactoryZoneResponse = PageResponse<FactoryZoneResponse>;

/** 공장 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageFactoryZoneResponse = ApiResponsePage<FactoryZoneResponse>;