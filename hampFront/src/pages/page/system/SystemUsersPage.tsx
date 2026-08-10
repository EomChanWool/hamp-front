import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import type {
  UserResponse,
  ApiResponsePageUserResponse,
} from "@/types/User";

export function SystemUsersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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

  // 회원 목록 조회
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

  // 상세 페이지로 이동 (현재 검색 상태 쿼리 스트링 유지)
  const handleRowClick = (userId: string) => {
    const queryString = searchParams.toString();
    navigate(`/system/users/${userId}${queryString ? `?${queryString}` : ""}`);
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
    ],
    [searchParams]
  );

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
            onRowClick={(row) => handleRowClick(row.userId)}
          />
          <CusPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalElements}
            onPageChange={handlePageChange}
          />
        </div>
      </Panel>
    </section>
  );
}