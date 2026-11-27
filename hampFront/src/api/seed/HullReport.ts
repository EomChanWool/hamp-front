import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';

/** 껍질 신고 상태 */
export type HullReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** 껍질 신고 포함 배치 라인 응답 */
export interface HullReportLineResponse {
  workId: string;
  bpCode: string;
  bpNm: string;
  hullQty: number;
}

/** 껍질 신고 응답 */
export interface HullReportResponse {
  reportId: number;
  reportDate: string;
  status: HullReportStatus;
  totalQty: number;
  note: string | null;
  decisionNote: string | null;
  lines: HullReportLineResponse[];
}

/** 신고 대상(미신고 완료 전처리 배치) 응답 */
export interface HullReportCandidateResponse {
  workId: string;
  bpCode: string;
  bpNm: string;
  hullQty: number;
  completedAt: string;
}

/** 껍질 신고 등록 요청 */
export interface HullReportCreateRequest {
  workIds: string[];
  note?: string;
}

export type ApiResponseHullReportResponse = ApiResponse<HullReportResponse>;
export type ApiResponseListHullReportResponse = ApiResponse<HullReportResponse[]>;
export type ApiResponseListHullReportCandidateResponse = ApiResponse<HullReportCandidateResponse[]>;

const BASE = '/hull-reports';

export const HullReportApi = {
  /** 껍질 신고 목록 조회 */
  getList: async (params?: {
    status?: HullReportStatus;
  }): Promise<ApiResponseListHullReportResponse> => {
    const res = await apiClient.get<ApiResponseListHullReportResponse>(BASE, { params });
    return res.data;
  },

  /** 껍질 신고 단건 조회 */
  getDetail: async (reportId: number): Promise<ApiResponseHullReportResponse> => {
    const res = await apiClient.get<ApiResponseHullReportResponse>(`${BASE}/${reportId}`);
    return res.data;
  },

  /** 신고 대상(미신고 완료 전처리 배치) 목록 조회 */
  getUnreportedBatches: async (): Promise<ApiResponseListHullReportCandidateResponse> => {
    const res = await apiClient.get<ApiResponseListHullReportCandidateResponse>(
      `${BASE}/unreported-batches`,
    );
    return res.data;
  },

  /** 껍질 신고 등록 */
  create: async (data: HullReportCreateRequest): Promise<ApiResponseHullReportResponse> => {
    const res = await apiClient.post<ApiResponseHullReportResponse>(BASE, data);
    return res.data;
  },
};
