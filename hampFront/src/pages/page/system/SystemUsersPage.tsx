import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type {
  UserResponse,
  ApiResponseUserResponse,
  ApiResponsePageUserResponse,
  UserUpdateRequest,
} from "@/types/User";

export function SystemUsersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingUserId, setDetailLoadingUserId] = useState<string | null>(null);

  // 상세/수정 모달 관련 상태
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [modalUser, setModalUser] = useState<UserResponse | null>(null);

  const detailRequestIdRef = useRef(0);

  // URL에서 현재 페이지 및 검색어 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryUserId = searchParams.get("userId") || "";
  const queryUserNm = searchParams.get("userNm") || "";
  const queryUserDep = searchParams.get("userDep") || "";

  // input ref 초기값 설정
  const userIdRef = useRef<HTMLInputElement>(null);
  const userNmRef = useRef<HTMLInputElement>(null);
  const userDepRef = useRef<HTMLInputElement>(null);

  // 검색 폼 UI 항목 정의
  const searchFields: SearchField[] = [
    { type: "input", label: "사용자ID", ref: userIdRef },
    { type: "input", label: "이름", ref: userNmRef },
    { type: "input", label: "부서", ref: userDepRef },
  ];

  // URL Query가 바뀔 때 Input 텍스트 필드 값 복원
  useEffect(() => {
    if (userIdRef.current) userIdRef.current.value = queryUserId;
    if (userNmRef.current) userNmRef.current.value = queryUserNm;
    if (userDepRef.current) userDepRef.current.value = queryUserDep;
  }, [queryUserId, queryUserNm, queryUserDep]);

  // 회원 목록 조회 (useCallback으로 메모이제이션 처리)
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        size: 10,
      };

      if (queryUserId) params.userId = queryUserId;
      if (queryUserNm) params.userNm = queryUserNm;
      if (queryUserDep) params.position = queryUserDep;

      const response = await apiClient.get<ApiResponsePageUserResponse>("/users", {
        params,
      });

      const pageData = response.data.data;
      setUsers(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("사용자 목록 조회 실패:", error);
      window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, queryUserId, queryUserNm, queryUserDep]);

  // URL 쿼리 파라미터가 변경될 때 자동 재조회
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 검색 버튼 클릭 시
  const handleSearch = () => {
    const nextParams: Record<string, string> = { page: "0" };

    const userId = userIdRef.current?.value.trim();
    const userNm = userNmRef.current?.value.trim();
    const userDep = userDepRef.current?.value.trim();

    if (userId) nextParams.userId = userId;
    if (userNm) nextParams.userNm = userNm;
    if (userDep) nextParams.position = userDep;

    setSearchParams(nextParams);
  };

  // 검색 초기화 시
  const handleReset = () => {
    [userIdRef, userNmRef, userDepRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    setSearchParams({ page: "0" });
  };

  // 페이지 이동 시
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  // 회원 단건 상세 조회
  const handleOpenDetail = async (userId: string) => {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoadingUserId(userId);

    try {
      const encodedUserId = encodeURIComponent(userId);
      const response = await apiClient.get<ApiResponseUserResponse>(
        `/users/${encodedUserId}`
      );
      const user = response.data.data;

      if (!user) throw new Error("사용자 상세 데이터가 없습니다.");

      if (requestId === detailRequestIdRef.current) {
        setModalUser(user);
      }
    } catch (error) {
      console.error("사용자 상세 조회 실패:", error);
      if (requestId === detailRequestIdRef.current) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.message
          : error instanceof Error
            ? error.message
            : null;
        window.alert(message || "상세 정보를 불러오는 중 오류가 발생했습니다.");
      }
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoadingUserId(null);
      }
    }
  };

  // 회원 정보 수정 처리
  const handleSave = async (updated: Record<string, string>) => {
    if (!modalUser || isUpdating) return;

    setIsUpdating(true);
    try {
      const userNmVal = "userNm" in updated ? updated.userNm.trim() : modalUser.userNm;
      const phoneVal = "phone" in updated ? updated.phone : modalUser.phone;
      const positionVal = "position" in updated ? updated.position : modalUser.position;

      const updatePayload: UserUpdateRequest = {
        userNm: userNmVal,
        phone: phoneVal?.trim() ? phoneVal.trim() : null,
        position: positionVal?.trim() ? positionVal.trim() : null,
      };

      const encodedUserId = encodeURIComponent(modalUser.userId);

      const response = await apiClient.put<ApiResponseUserResponse>(
        `/users/${encodedUserId}`,
        updatePayload
      );

      const successMessage = response.data?.message || "수정되었습니다.";
      window.alert(successMessage);

      setModalUser(null);
      await loadUsers();
    } catch (err) {
      console.error("저장 실패:", err);

      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.message
        : null;

      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 회원 비활성화 처리
  const handleDeactivate = async () => {
    if (!modalUser || !modalUser.use || isDeactivating) return;

    const confirmed = window.confirm(
      `${modalUser.userNm}(${modalUser.userId}) 회원을 비활성화하시겠습니까?\n비활성화 후에는 로그인할 수 없습니다.`
    );
    if (!confirmed) return;

    setIsDeactivating(true);
    try {
      const encodedUserId = encodeURIComponent(modalUser.userId);
      await apiClient.delete(`/users/${encodedUserId}`);
      window.alert("회원이 비활성화되었습니다.");
      setModalUser(null);
      await loadUsers();
    } catch (error) {
      console.error("회원 비활성화 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "회원 비활성화에 실패했습니다.");
    } finally {
      setIsDeactivating(false);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<UserResponse>[] = useMemo(
    () => [
      { accessorKey: "userId", header: "사용자ID" },
      { accessorKey: "userNm", header: "이름" },
      { accessorKey: "phone", header: "전화번호" },
      { accessorKey: "position", header: "부서" },
      {
        accessorKey: "use",
        header: "사용여부",
        cell: ({ getValue }) => (
          <Badge tone={getValue<boolean>() ? "good" : "muted"}>
            {getValue<boolean>() ? "사용" : "미사용"}
          </Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "생성일시",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
      {
        id: "actions",
        header: "관리",
        meta: { width: "100px" },
        cell: ({ row }) => (
          <div className="rowActions">
            <button
              type="button"
              className="miniButton"
              disabled={detailLoadingUserId === row.original.userId}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(row.original.userId);
              }}
            >
              {detailLoadingUserId === row.original.userId ? "조회 중..." : "상세"}
            </button>
          </div>
        ),
      },
    ],
    [detailLoadingUserId]
  );

  const detailFields = [
    { label: "사용자ID", key: "userId", editable: false },
    { label: "이름", key: "userNm" },
    { label: "전화번호", key: "phone" },
    { label: "부서", key: "position" },
    { label: "사용여부", key: "use", editable: false },
    { label: "생성일시", key: "createdAt", editable: false },
  ];

  const modalData = useMemo(() => {
    if (!modalUser) return {};
    return {
      userId: modalUser.userId,
      userNm: modalUser.userNm,
      phone: modalUser.phone,
      position: modalUser.position,
      use: modalUser.use ? "사용" : "미사용",
      createdAt: formatDateTime(modalUser.createdAt),
    };
  }, [modalUser]);

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel
        title="사용자관리 목록"
        action="등록"
        onAction={() => {
          const queryString = searchParams.toString();
          navigate(queryString ? `/system/users/create?${queryString}` : "/system/users/create");
        }}
      >
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={users}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.userId)}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={handlePageChange}
          />
        </div>
      </Panel>

      {/* 회원 상세/수정 모달 */}
      <RowDetailModal
        isOpen={modalUser !== null}
        onClose={() => {
          if (!isDeactivating && !isUpdating) setModalUser(null);
        }}
        onSave={handleSave}
        fields={detailFields}
        data={modalData as unknown as Record<string, string>}
        dangerAction={
          modalUser?.use
            ? {
                label: "회원 비활성화",
                loadingLabel: "비활성화 처리 중...",
                onClick: handleDeactivate,
                isLoading: isDeactivating,
              }
            : undefined
        }
      />
    </section>
  );
}