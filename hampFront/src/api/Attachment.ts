import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';

/** 파일업로드 공통 응답 구조 */
export interface AttachmentResponse {
  attachmentId: number;
  category?: string | null;
  originalName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
}

/** 파일업로드 API 최종 응답 타입 */
export type ApiResponseAttachmentResponse = ApiResponse<AttachmentResponse>;

// ── 공용 첨부파일 API ────────────────────────────────────────────────────────

export const AttachmentApi = {
  /**
   * 첨부파일 업로드 (공용)
   * @param file 업로드할 파일 객체
   * @param fcltCode 설비 코드 (refCode로 전달)
   * @param category 카테고리 (선택)
   */
  upload: async (file: File, fcltCode: string, category?: string): Promise<ApiResponseAttachmentResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ApiResponseAttachmentResponse>('/attachments', formData, {
      params: {
        refType: 'FACILITY',
        refCode: fcltCode,
        ...(category && { category }),
      },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * 첨부파일 삭제 (공용)
   * @param attachmentId 삭제할 파일 ID
   * @param fcltCode 설비 코드 (refCode로 전달)
   */
  delete: async (attachmentId: number, fcltCode: string): Promise<ApiResponse<string>> => {
    const response = await apiClient.delete<ApiResponse<string>>(`/attachments/${attachmentId}`, {
      params: {
        refType: 'FACILITY',
        refCode: fcltCode,
      },
    });
    return response.data;
  },

  /**
   * 첨부파일 다운로드
   * @param attachmentId 다운로드할 파일 ID
   * @returns Blob 형태의 파일 데이터
   */
  download: async (attachmentId: number): Promise<Blob> => {
    const response = await apiClient.get(`/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};