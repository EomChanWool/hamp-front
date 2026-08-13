import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

/** 종류 (0: 정지, 1: 작동, 2: 고장) */
export type StatusType = 0 | 1 | 2;

/** 종류 매핑 라벨 (화면 표시용) */
export const STATUS_TYPE_LABEL: Record<StatusType, string> = {
    0: '정지',
    1: '작동',
    2: '고장'
} as const;

export const STATUS_TONE: Record<FacilityResponse['currentStatus'], 'good' | 'warn' | 'danger'> = {
  0: 'danger',
  1: 'good',
  2: 'warn',
}

/** 설비 등록 요청 */
export interface FacilityCreateRequest {
    fcltCode: string;
    eqCode?: string | null;
    facCode?: string | null;
    fcltNm?: string | null;
    currentStatus?: StatusType | null;
    useYn?: boolean | null;
}

/** 설비 정보 수정 요청 */
export interface FacilityUpdateRequest {
    eqCode?: string | null;
    facCode?: string | null;
    fcltNm?: string | null;
    currentStatus?: StatusType | null;
    useYn?: boolean | null;
}

/** 설비 정보 응답 */
export interface FacilityResponse {
    fcltCode: string;
    eqCode: string;
    facCode: string;
    fcltNm: string;
    currentStatus: StatusType;
    useYn: boolean;
    createdAt: string;
    updatedAt: string;
}

/** 설비 상세 정보 응답 */
export interface FacilityDetailRespons {
    fcltCode: string;
    eqCode: string;
    eqNm: string;
    eqType: string;
    facCode: string;
    facNm: string;
    location: string;
    fcltNm: string;
    currentStatus: StatusType;
    useYn: boolean;
    createdAt: string;
    updatedAt: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 설비 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseFacilityResponse = ApiResponse<FacilityResponse>;

/** 설비 상세 조회 API 최종 응답 타입 */
export type ApiResponseFacilityDetailResponse = ApiResponse<FacilityDetailRespons>;

/** 설비 목록 페이징 데이터 타입 */
export type PageFacilityResponse = PageResponse<FacilityResponse>;

/** 설비 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageFacilityResponse = ApiResponsePage<FacilityResponse>;