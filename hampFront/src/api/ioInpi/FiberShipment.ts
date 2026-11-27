import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

// ── 도메인 상수 및 타입 (Literal Types) ────────────────────────────────────────

/** 섬유 출고지시서 상태 (WAITING: 대기 / SCANNED: 스캔됨 / SHIPPED: 출고완료 / CANCELLED: 취소) */
export type FiberShipmentStatus = 'WAITING' | 'SCANNED' | 'SHIPPED' | 'CANCELLED';

/** 섬유 출고지시서 상태 → 화면 표시 라벨 */
export const FIBER_SHIPMENT_STATUS_LABEL: Record<FiberShipmentStatus, string> = {
    WAITING: '대기',
    SCANNED: '스캔됨',
    SHIPPED: '출고완료',
    CANCELLED: '취소',
};

// ── 요청 타입 ────────────────────────────────────────────────────────────────

/** 섬유 출고지시서 라인 요청 (등록/수정 공용) */
export interface FiberShipmentLineRequest {
    /** 섬유 작업실적 ID - 제품 LOT(FP-) 1개 */
    perfId: number;
    /** 이 LOT에서 출고할 중량(kg) - LOT 일부만 나눠 출고 가능 */
    shipQty: number;
}

/** 섬유 출고지시서 등록 요청 */
export interface FiberShipmentCreateRequest {
    /** 섬유 수주번호 (최대 30자) - 작업지시가 완료된 수주만, 수주 1건에 지시서 여러 장 가능 */
    orderCode: string;
    /** 출고 예정일 (지시서 번호 날짜에도 쓰임) 예: "2026-11-28" */
    shipDate?: string;
    /** 고객이 지정한 인도 장소 (최대 255자) */
    shipDest?: string;
    /** 출고 담당자 ID (선택, 지시서 인쇄용 - 출고자는 PC에서 출고 확인을 누른 사람) */
    managerId?: string;
    /** 인수자 및 출고 특이사항 (최대 255자) */
    note?: string;
    /** 실을 제품 LOT과 중량 (1개 이상) */
    lines: FiberShipmentLineRequest[];
}

/** 섬유 출고지시서 수정 요청 */
export interface FiberShipmentUpdateRequest {
    /** 출고 예정일 (지시서 번호는 처음 예정일 그대로 유지) */
    shipDate?: string;
    /** 고객이 지정한 인도 장소 (최대 255자) */
    shipDest?: string;
    /** 출고 담당자 ID (선택, 지시서 인쇄용) */
    managerId?: string;
    /** 인수자 및 출고 특이사항 (최대 255자) */
    note?: string;
    /** 실을 제품 LOT과 중량 (기존 라인을 이 목록으로 교체, 1개 이상) */
    lines: FiberShipmentLineRequest[];
}

/** 섬유 출고지시서 목록 조회 파라미터 */
export interface FiberShipmentListParams {
    shipId?: string;
    orderCode?: string;
    bpCode?: string;
    status?: FiberShipmentStatus | string;
    managerId?: string;
    shipDateFrom?: string;
    shipDateTo?: string;
    page?: number;
    size?: number;
    sort?: string | string[];
    [key: string]: any;
}

// ── 응답 타입 ────────────────────────────────────────────────────────────────

/** 섬유 출고지시서 헤더 응답 (목록/등록/수정/취소/출고확인 공용) */
export interface FiberShipmentResponse {
    /** 출고지시서 번호(지시서 바코드) */
    shipId: string;
    /** 섬유 수주번호 */
    orderCode: string;
    /** 거래처 코드 */
    bpCode: string;
    /** 거래처명 */
    bpNm: string;
    /** 출고 예정일 */
    shipDate: string;
    /** 인도 장소 */
    shipDest: string | null;
    /** 출고 담당자 ID */
    managerId: string | null;
    /** 출고 담당자명 */
    managerNm: string | null;
    /** 출고 상태 - FiberShipmentStatus 값이 오지만, 서버 값 확장에 대비해 string으로 받음 */
    status: string;
    /** 현장 지시서 바코드 스캔 시각 (SCANNED부터) */
    scannedAt: string | null;
    /** 실제 출고일시 (출고 확인 시 스캔 시각으로 기록) */
    shippedAt: string | null;
    /** 출고 확인 처리자 ID (PC에서 확인을 누른 사용자) */
    shippedBy: string | null;
    /** 출고 처리자명 */
    shippedByNm: string | null;
    /** 실을 제품 LOT 수 */
    lineCount: number;
    /** 출고 중량 합계(kg) */
    totalShipQty: number;
    /** 인수자 및 출고 특이사항 */
    note: string | null;
    /** 생성 일시 */
    createdAt: string;
    /** 수정 일시 */
    updatedAt: string;
}

/** 섬유 출고지시서 라인 응답 */
export interface FiberShipmentLineResponse {
    /** 출고지시서 라인 ID */
    shipLineId: number;
    /** 섬유 작업실적 ID */
    perfId: number;
    /** 제품 LOT 번호(FP-) */
    productLotCode: string;
    /** 제품 품목코드 */
    productItemCode: string;
    /** 제품명 */
    productItemNm: string;
    /** 작업일(생산일) */
    workDate: string;
    /** 이 LOT 생산 중량(kg) */
    outputQty: number;
    /** 이번 출고 중량(kg) */
    shipQty: number;
}

/** 섬유 출고지시서 단건 상세 응답 (헤더 + 라인) */
export interface FiberShipmentDetailResponse {
    /** 출고지시서 헤더 */
    shipment: FiberShipmentResponse;
    /** 실을 제품 LOT 목록 (제품 LOT 순) */
    lines: FiberShipmentLineResponse[];
}

/** 섬유동 출고지시서 바코드 스캔 응답 */
export interface FiberShipmentScanResponse {
    /** 작업자에게 보여주거나 읽어줄 한 줄 안내 */
    message: string;
    /** 출고지시서 번호 */
    shipId: string;
    /** 출고 상태 (스캔 성공이면 SCANNED) */
    status: string;
    /** 섬유 수주번호 */
    orderCode: string;
    /** 거래처명 */
    bpNm: string;
    /** 지시서의 제품 LOT 수 */
    lineCount: number;
    /** 지시서 출고 중량 합계(kg) */
    totalShipQty: number;
    /** 스캔 시각 (출고 확인 시 출고일시가 됨) */
    scannedAt: string;
}

/** 출고지시서에 넣을 수 있는 제품 LOT 응답 */
export interface FiberShippableLotResponse {
    /** 섬유 작업실적 ID */
    perfId: number;
    /** 제품 LOT 번호(FP-) */
    productLotCode: string;
    /** 제품 품목코드 */
    productItemCode: string;
    /** 제품명 */
    productItemNm: string;
    /** 작업일(생산일) */
    workDate: string;
    /** 이 LOT 생산 중량(kg) */
    outputQty: number;
    /** 다른 출고지시서에 이미 잡힌 중량(kg) */
    reservedQty: number;
    /** 추가로 출고 가능한 잔여 중량(kg) */
    remainingQty: number;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 섬유 출고지시서 등록/수정/취소/스캔취소/출고취소 API 최종 응답 타입 */
export type ApiResponseFiberShipmentResponse = ApiResponse<FiberShipmentResponse>;

/** 섬유 출고지시서 단건 상세 조회 API 최종 응답 타입 */
export type ApiResponseFiberShipmentDetailResponse = ApiResponse<FiberShipmentDetailResponse>;

/** 섬유 출고지시서 목록 페이징 데이터 타입 */
export type PageFiberShipmentResponse = PageResponse<FiberShipmentResponse>;

/** 섬유 출고지시서 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageFiberShipmentResponse = ApiResponsePage<FiberShipmentResponse>;

/** 섬유 출고 확인(일괄) API 최종 응답 타입 */
export type ApiResponseListFiberShipmentResponse = ApiResponse<FiberShipmentResponse[]>;

/** 섬유 출고지시서 바코드 스캔 API 최종 응답 타입 */
export type ApiResponseFiberShipmentScanResponse = ApiResponse<FiberShipmentScanResponse>;

/** 출고 가능 제품 LOT 목록 API 최종 응답 타입 */
export type ApiResponseListFiberShippableLotResponse = ApiResponse<FiberShippableLotResponse[]>;

/** 섬유 출고지시서 삭제 API 최종 응답 타입 */
export type ApiResponseFiberShipmentDelete = ApiResponse<string>;

// ── 섬유 출고지시서 API 함수 ────────────────────────────────────────────────────

const BASE_URL = '/fiber-shipments';

export const FiberShipmentApi = {
    /** 섬유 출고지시서 목록 조회 */
    getList: async (params?: FiberShipmentListParams): Promise<ApiResponsePageFiberShipmentResponse> => {
        const res = await apiClient.get<ApiResponsePageFiberShipmentResponse>(BASE_URL, { params });
        return res.data;
    },

    /** 섬유 출고지시서 단건 상세 조회 */
    getDetail: async (shipId: string): Promise<ApiResponseFiberShipmentDetailResponse> => {
        const res = await apiClient.get<ApiResponseFiberShipmentDetailResponse>(
            `${BASE_URL}/${encodeURIComponent(shipId)}`,
        );
        return res.data;
    },

    /** 출고지시서에 넣을 수 있는 제품 LOT 목록 조회 (수정 화면에서는 excludeShipId로 자기 지시서 예약분 제외) */
    getShippableLots: async (
        orderCode: string,
        excludeShipId?: string,
    ): Promise<ApiResponseListFiberShippableLotResponse> => {
        const res = await apiClient.get<ApiResponseListFiberShippableLotResponse>(`${BASE_URL}/shippable-lots`, {
            params: { orderCode, excludeShipId },
        });
        return res.data;
    },

    /** 섬유 출고지시서 등록 */
    create: async (data: FiberShipmentCreateRequest): Promise<ApiResponseFiberShipmentResponse> => {
        const res = await apiClient.post<ApiResponseFiberShipmentResponse>(BASE_URL, data);
        return res.data;
    },

    /** 섬유 출고지시서 수정 (lines는 기존 라인을 통째로 교체) */
    update: async (shipId: string, data: FiberShipmentUpdateRequest): Promise<ApiResponseFiberShipmentResponse> => {
        const res = await apiClient.put<ApiResponseFiberShipmentResponse>(
            `${BASE_URL}/${encodeURIComponent(shipId)}`,
            data,
        );
        return res.data;
    },

    /** 섬유 출고지시서 삭제 */
    remove: async (shipId: string): Promise<ApiResponseFiberShipmentDelete> => {
        const res = await apiClient.delete<ApiResponseFiberShipmentDelete>(`${BASE_URL}/${encodeURIComponent(shipId)}`);
        return res.data;
    },

    /** 섬유 출고지시서 취소 */
    cancel: async (shipId: string): Promise<ApiResponseFiberShipmentResponse> => {
        const res = await apiClient.post<ApiResponseFiberShipmentResponse>(
            `${BASE_URL}/${encodeURIComponent(shipId)}/cancel`,
        );
        return res.data;
    },

    /** [바코드] 섬유동 출고지시서 스캔 (대기 → 스캔됨, 이후 PC에서 출고 확인) */
    scan: async (code: string): Promise<ApiResponseFiberShipmentScanResponse> => {
        const res = await apiClient.post<ApiResponseFiberShipmentScanResponse>(`${BASE_URL}/scan`, null, {
            params: { code },
        });
        return res.data;
    },

    /** 섬유 출고지시서 스캔 취소 (스캔됨 → 대기) */
    revertScan: async (shipId: string): Promise<ApiResponseFiberShipmentResponse> => {
        const res = await apiClient.post<ApiResponseFiberShipmentResponse>(
            `${BASE_URL}/${encodeURIComponent(shipId)}/revert-scan`,
        );
        return res.data;
    },

    /** 섬유 출고 확인 (스캔된 지시서 일괄 출고 처리 - 스캔됨 → 출고완료) */
    confirm: async (shipIds: string[]): Promise<ApiResponseListFiberShipmentResponse> => {
        const res = await apiClient.post<ApiResponseListFiberShipmentResponse>(`${BASE_URL}/confirm`, shipIds);
        return res.data;
    },

    /** 섬유 출고 취소 (출고완료 → 스캔됨) */
    revertShip: async (shipId: string): Promise<ApiResponseFiberShipmentResponse> => {
        const res = await apiClient.post<ApiResponseFiberShipmentResponse>(
            `${BASE_URL}/${encodeURIComponent(shipId)}/revert-ship`,
        );
        return res.data;
    },
};
