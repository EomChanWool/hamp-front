import { useEffect, useMemo, useRef, useState } from "react";
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
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingUserId, setDetailLoadingUserId] = useState<string | null>(
    null,
  );
  const [modalUser, setModalUser] = useState<UserResponse | null>(null);
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
          if (value && value.trim() !== "") {
            acc[key] = value.trim();
          }
          return acc;
        },
        {} as Record<string, string>,
      );

      const response = await apiClient.get<ApiResponsePageUserResponse>(
        "/users",
        {
          params: {
            ...cleanedParams,
            page,
            size: 10,
          },
        },
      );

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
        `/users/${encodedUserId}`,
      );
      const user = response.data.data;

      if (!user) {
        throw new Error("사용자 상세 데이터가 없습니다.");
      }

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

  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (userIdRef.current?.value.trim())
      params.userId = userIdRef.current.value.trim();
    if (userNmRef.current?.value.trim())
      params.userNm = userNmRef.current.value.trim();
    if (userDepRef.current?.value.trim())
      params.userDep = userDepRef.current.value.trim();

    setCurrentPage(0);
    setSearchParams(params);
  };

  const handleReset = () => {
    [userIdRef, userNmRef, userDepRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    setCurrentPage(0);
    setSearchParams({});
  };

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalUser) return;
    try {
      const updatePayload: UserUpdateRequest = {
        userNm: updated.userNm ?? modalUser.userNm,
        phone: updated.phone ?? modalUser.phone,
        position: updated.position ?? modalUser.position,
      };

      await apiClient.put(`/users/${modalUser.userId}`, updatePayload);

      window.alert("저장되었습니다.");
      setModalUser(null);
      loadUsers(currentPage, searchParams);
    } catch (err) {
      console.error("저장 실패:", err);
      window.alert("저장에 실패했습니다.");
    }
  };

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
        // 💡 formatDateTime 사용
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
              {detailLoadingUserId === row.original.userId
                ? "조회 중..."
                : "상세"}
            </button>
          </div>
        ),
      },
    ],
    [detailLoadingUserId],
  );

  const detailFields = [
    { label: "사용자ID", key: "userId", editable: false },
    { label: "이름", key: "userNm" },
    { label: "전화번호", key: "phone" },
    { label: "직책", key: "position" },
    { label: "사용여부", key: "use", editable: false },
    { label: "생성일시", key: "createdAt", editable: false },
  ];

  // 상세 모달에 전달할 데이터의 createdAt 포맷팅
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
      <SearchBand
        fields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <Panel title="사용자관리 목록">
        <div className="relative min-h-[300px]">
          {/* 로딩 오버레이 (화면 깜빡임 및 위치 이동 방지) */}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-lg bg-gray-900/80 px-4 py-2 text-sm text-white shadow-md">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>데이터를 불러오는 중입니다...</span>
              </div>
            </div>
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

      <RowDetailModal
        isOpen={modalUser !== null}
        onClose={() => setModalUser(null)}
        onSave={handleSave}
        fields={detailFields}
        data={modalData as unknown as Record<string, string>}
      />
    </section>
  );
}
