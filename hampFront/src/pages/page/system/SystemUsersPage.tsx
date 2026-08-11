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
import { useTableSorting } from "@/hooks/useTableSorting";
import type {
  UserResponse,
  ApiResponsePageUserResponse,
} from "@/types/User";
import Spinner from "@/components/common/Spinner";

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

  // 커스텀 훅으로 정렬 상태 및 핸들러 분리 완료
  const { sorting, sortParams, handleSortingChange } = useTableSorting();

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
      const params: Record<string, any> = {
        page: currentPage,
        size: 10,
      };

      if (queryUserId) params.userId = queryUserId;
      if (queryUserNm) params.userNm = queryUserNm;
      if (queryUserDep) params.position = queryUserDep;

      // 정렬 파라미터가 존재할 경우 배열 형태로 추가 (apiClient 전역 설정이 자동으로 스프링 규격 변환)
      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

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
  }, [currentPage, queryUserId, queryUserNm, queryUserDep, sortParams]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 검색 버튼 클릭 시
  const handleSearch = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");

    const userId = userIdRef.current?.value.trim();
    const userNm = userNmRef.current?.value.trim();
    const userDep = userDepRef.current?.value.trim();

    if (userId) nextParams.set("userId", userId);
    else nextParams.delete("userId");

    if (userNm) nextParams.set("userNm", userNm);
    else nextParams.delete("userNm");

    if (userDep) nextParams.set("position", userDep);
    else nextParams.delete("position");

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

  // 상세 페이지로 이동
  const handleRowClick = (userId: string) => {
    const queryString = searchParams.toString();
    navigate(`/system/users/${userId}${queryString ? `?${queryString}` : ""}`);
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<UserResponse>[] = useMemo(
    () => [
      { accessorKey: "userId", header: "사용자ID" },
      { accessorKey: "userNm", header: "이름" },
      {
        accessorKey: "phone",
        header: "전화번호",
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val : "-";
        },
      },
      {
        accessorKey: "position",
        header: "부서",
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val : "-";
        },
      },
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
        header: "등록일자",
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? formatDateTime(val) : "-";
        },
      },
    ],
    []
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
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={users}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                onRowClick={(row) => handleRowClick(row.userId)}
                noDataMessage="조회된 데이터가 없습니다."
              />
              <CusPagination
                page={currentPage}
                totalPages={totalPages}
                totalCount={totalElements}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </Panel>
    </section>
  );
}