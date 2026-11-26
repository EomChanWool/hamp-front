import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';

// 도메인 타입

/** 상단 요약 숫자 */
export interface FiberProductionSummaryResponse {
    outputQty: number; // 기준일 생산량(kg) - 작업일이 기준일인 실적 줄의 생산 중량 합계
    inProgressCount: number; // 지금 작업 중인 작업지시 수
    remainingCount: number; // 기준일에 시작 예정인 대기 작업지시 수 (남은 작업)
    delayedCount: number; // 지연 - 예정 시작일이 기준일보다 지났는데 아직 시작하지 않은 작업지시 수
}

/** 수주 내 제품별 진행률 */
export interface FiberProductionLineResponse {
    productItemCode: string; // 제품 품목코드
    productItemNm: string; // 제품명
    allocatedQty: number; // 이 제품에 배분한 원물(kg)
    completedInputQty: number; // 실적으로 투입한 원물(kg)
    outputQty: number; // 실제 생산량(kg)
    progressPercent: number; // 진행률(%) = 투입 ÷ 배분 x 100, 소수 1자리
}

/** 진행 중인 수주별 진행률 (납기 빠른 순) */
export interface FiberProductionOrderResponse {
    orderCode: string; // 수주번호
    bpCode: string; // 거래처 코드
    bpNm: string; // 거래처명
    status: string; // 수주 상태
    dueDate: string; // 납기일
    dueDays: number | null; // 납기까지 남은 일수 (0 = 오늘, 음수 = 지남, 납기 없으면 null)
    workId: string | null; // 작업지시번호 (취소 제외, 아직 없으면 null)
    workStatus: string | null; // 작업지시 상태 (WAITING/IN_PROGRESS/COMPLETED, 아직 없으면 null)
    allocatedQty: number; // 제품에 배분한 원물 합계(kg)
    completedInputQty: number; // 실적으로 투입한 원물(kg)
    outputQty: number; // 실제 생산량(kg)
    progressPercent: number; // 진행률(%) - 원물을 더 투입하면 100을 넘을 수 있음(화면에서 막대만 100으로 자름)
    lines: FiberProductionLineResponse[]; // 제품별 진행률
}

/** 담당자별 현황 (작업 중이거나, 기준일에 끝냈거나, 남은 작업이 있는 담당자) */
export interface FiberProductionManagerResponse {
    managerId: string | null; // 담당자 ID (담당자 미지정 작업지시는 null)
    managerNm: string | null; // 담당자명 (미지정이면 null)
    inProgressCount: number; // 지금 작업 중인 작업지시 수
    performanceCount: number; // 기준일에 남긴 실적 줄 수 (작업일 기준)
    remainingCount: number; // 남은 작업 - 기준일까지 시작 예정인 대기 작업지시 수 (밀린 건 포함)
    outputQty: number; // 기준일 생산량(kg)
}

/** 지금 작업 중인 작업지시 (기준일과 관계없이 현재 시점, 먼저 시작한 순) */
export interface FiberProductionInProgressResponse {
    workId: string; // 작업지시번호
    orderCode: string; // 섬유 수주번호
    bpNm: string; // 거래처명
    requestInputQty: number; // 수주 요청 원물 중량(kg) = 제품별 배분 합계
    performanceCount: number; // 지금까지 실적 줄 수
    inputQty: number; // 지금까지 실적 투입 합계(kg)
    outputQty: number; // 지금까지 실적 생산 합계(kg)
    managerId: string | null; // 담당자 ID
    managerNm: string | null; // 담당자명
    startAt: string; // 작업 시작일시 (작업지시서 바코드 스캔)
    elapsedMinutes: number; // 경과 시간(분) - 응답 생성 시각 기준
}

/** 섬유동 작업현황판 응답 */
export interface FiberProductionStatusResponse {
    baseDate: string; // 기준일 (요약 숫자와 담당자별 집계의 기준)
    generatedAt: string; // 응답 생성 시각 - 화면의 '마지막 갱신' 표시용
    summary: FiberProductionSummaryResponse; // 상단 요약 숫자
    orders: FiberProductionOrderResponse[]; // 진행 중인 수주별 진행률 (납기 빠른 순)
    managers: FiberProductionManagerResponse[]; // 담당자별 현황
    inProgress: FiberProductionInProgressResponse[]; // 지금 작업 중인 작업지시
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 섬유동 작업현황판 조회 API 최종 응답 타입 */
export type ApiResponseFiberProductionStatusResponse = ApiResponse<FiberProductionStatusResponse>;

// ── 섬유동 작업현황판 API 함수 ────────────────────────────────────────────────────

export const FiberProductionStatusApi = {
    /** 섬유동 작업현황판 조회 (date 생략 시 오늘) */
    getStatus: async (params?: {
        date?: string; // 기준일 (YYYY-MM-DD)
    }): Promise<ApiResponseFiberProductionStatusResponse> => {
        const res = await apiClient.get('/fiber-production-status', { params });
        return res.data;
    },
};
