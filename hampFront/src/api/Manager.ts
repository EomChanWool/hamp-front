/** 담당자 배정 요청 */
export interface ManagerAssignRequest {
    roleType?: string | null;
    userId: string;
}

/** 담당자 배정 응답 */
export interface ManagerAssignResponse {
  managerAssignId: number;
  tableNm: string;
  roleType: string;
  userId: string;
  userNm: string;
  createdAt: string;
  updatedAt: string;
}
