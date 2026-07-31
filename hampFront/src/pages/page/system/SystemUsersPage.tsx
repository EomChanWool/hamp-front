import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
import { UserCreateModal } from "@components/common/UserCreateModal";
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
  UserCreateRequest,
} from "@/types/User";

export function SystemUsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingUserId, setDetailLoadingUserId] = useState<string | null>(null);

  // 상태 변경 및 로딩 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [modalUser, setModalUser] = useState<UserResponse | null>(null);

  // 등록 모달 및 생성 중 로딩 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const detailRequestIdRef = useRef(0);

  const userIdRef = useRef<HTMLInputElement>(null);
  const userNmRef = useRef<HTMLInputElement>(null);
  const userDepRef = useRef<HTMLInputElement>(null);

  const searchFields: SearchField[] = [
    { type: "input", label: "사용자ID", ref: userIdRef },
    { type: "input", label: "이름", ref: userNmRef },
    { type: "input", label: "부서", ref: userDepRef },
  ];

  // 회원 목록 조회
  const loadUsers = async (page: number, params: Record<string, string>) => {
    setIsLoading(true);
    try {
      const cleanedParams = Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (value && value.trim() !== "") acc[key] = value.trim();
          return acc;
        },
        {} as Record<string, string>
      );

      const response = await apiClient.get<ApiResponsePageUserResponse>("/users", {
        params: { ...cleanedParams, page, size: 10 },
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
  };

  // 회원 단건 상세 조회 (GET /users/{userId})
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

  useEffect(() => {
    loadUsers(currentPage, searchParams);
  }, [currentPage, searchParams]);

  // 검색 핸들러
  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (userIdRef.current?.value.trim()) params.userId = userIdRef.current.value.trim();
    if (userNmRef.current?.value.trim()) params.userNm = userNmRef.current.value.trim();
    if (userDepRef.current?.value.trim()) params.userDep = userDepRef.current.value.trim();

    setCurrentPage(0);
    setSearchParams(params);
  };

  // 검색 초기화
  const handleReset = () => {
    [userIdRef, userNmRef, userDepRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    setCurrentPage(0);
    setSearchParams({});
  };

  // 1. 신규 회원 등록 처리 (POST /users)
  const handleCreateUser = async (formData: UserCreateRequest) => {
    setIsCreating(true);
    try {
      await apiClient.post("/users", formData);
      window.alert("성공적으로 등록되었습니다.");
      setIsCreateModalOpen(false);
      await loadUsers(currentPage, searchParams);
    } catch (error) {
      console.error("회원 등록 실패:", error);
      // 백엔드 에러 메시지 노출 (400 VALIDATION_ERROR, 409 DUPLICATE_USER_ID 등)
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "회원 등록 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  // 2. 회원 정보 수정 처리 (PUT /users/{userId}) - Full Replace 적용
  const handleSave = async (updated: Record<string, string>) => {
    if (!modalUser || isUpdating) return;

    setIsUpdating(true);
    try {
      // updated에 값이 존재하면 trim 후 검사, 빈값이면 null로 처리 (속성 자체가 없을 땐 기존 modalUser 값 유지)
      const phoneVal = "phone" in updated ? updated.phone : modalUser.phone;
      const positionVal = "position" in updated ? updated.position : modalUser.position;

      const updatePayload: UserUpdateRequest = {
        userNm: ("userNm" in updated ? updated.userNm : modalUser.userNm)?.trim() || modalUser.userNm,

        // 빈 문자열("") 또는 공백이면 null, 값이 있으면 trim된 문자열 전송
        phone: phoneVal?.trim() ? phoneVal.trim() : null,
        position: positionVal?.trim() ? positionVal.trim() : null,
      };

      const encodedUserId = encodeURIComponent(modalUser.userId);
      await apiClient.put(`/users/${encodedUserId}`, updatePayload);

      window.alert("수정되었습니다.");
      setModalUser(null);
      await loadUsers(currentPage, searchParams);
    } catch (err) {
      console.error("저장 실패:", err);
      // 백엔드 에러 메시지 노출 (400 VALIDATION_ERROR, 404 USER_NOT_FOUND 등)
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : null;
      window.alert(message || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 3. 회원 비활성화 처리 (DELETE /users/{userId})
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
      await loadUsers(currentPage, searchParams);
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

      <Panel title="사용자관리 목록" action="등록" onAction={() => setIsCreateModalOpen(true)}>
        <div className="relative min-h-[300px]">
          {isLoading && (
            <span>데이터를 불러오는 중입니다...</span>
          )}

          <CusTable
            data={users}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.userId)}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={setCurrentPage}
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

      {/* 신규 회원 등록 모달 */}
      <UserCreateModal
        isOpen={isCreateModalOpen}
        isLoading={isCreating}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateUser}
      />
    </section>
  );
}