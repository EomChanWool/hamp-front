import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import {
  SearchBand,
  type SearchField,
} from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { useTableSorting } from "@/hooks/useTableSorting";
import type {
  UserResponse,
} from "@/api/User";
import Spinner from "@/components/common/Spinner";
import { UserApi } from "@/api/User";

export function SystemUsersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 새로고침 초기화가 끝난 뒤에 목록 조회를 시작하기 위한 상태
  const [isReady, setIsReady] = useState(false);

  const {
    sorting,
    sortParams,
    handleSortingChange,
  } = useTableSorting();

  // [정확한 새로고침 감지]
  // 브라우저가 닫히거나 새로고침(F5)될 때만 플래그 설정
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("is_browser_reload", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // 진입 시 실제 브라우저 새로고침 여부 확인 후 검색 조건 초기화
  useEffect(() => {
    const isReload = sessionStorage.getItem("is_browser_reload") === "true";

    if (isReload) {
      sessionStorage.removeItem("is_browser_reload");
      if (searchParams.toString()) {
        setSearchParams({}, { replace: true });
        return;
      }
    }

    setIsReady(true);
  }, []);

  // 새로고침 때문에 setSearchParams가 실행된 경우 조회 가능 상태로 변경
  useEffect(() => {
    const isReload = sessionStorage.getItem("is_browser_reload") === "true";
    if (!isReload && !isReady) {
      setIsReady(true);
    }
  }, [searchParams, isReady]);

  // URL에서 현재 검색조건 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryUserId = searchParams.get("userId") || "";
  const queryUserNm = searchParams.get("userNm") || "";
  const queryUserDep = searchParams.get("position") || "";

  // 검색 input refs
  const userIdRef = useRef<HTMLInputElement>(null);
  const userNmRef = useRef<HTMLInputElement>(null);
  const userDepRef = useRef<HTMLInputElement>(null);

  // 검색 필드
  const searchFields: SearchField[] = [
    {
      type: "input",
      label: "사용자ID",
      ref: userIdRef,
      name: "userId",
    },
    {
      type: "input",
      label: "이름",
      ref: userNmRef,
      name: "userNm",
    },
    {
      type: "input",
      label: "부서",
      ref: userDepRef,
      name: "position",
    },
  ];

  // URL → SearchBand input 동기화
  useEffect(() => {
    if (userIdRef.current) {
      userIdRef.current.value = queryUserId;
    }

    if (userNmRef.current) {
      userNmRef.current.value = queryUserNm;
    }

    if (userDepRef.current) {
      userDepRef.current.value = queryUserDep;
    }
  }, [
    queryUserId,
    queryUserNm,
    queryUserDep,
  ]);

  // 회원 목록 조회
  const loadUsers = useCallback(async () => {
    if (!isReady) {
      return;
    }

    setIsLoading(true);

    try {
      const params: Record<string, any> = {
        page: currentPage,
        size: 10,
      };

      if (queryUserId) {
        params.userId = queryUserId;
      }

      if (queryUserNm) {
        params.userNm = queryUserNm;
      }

      if (queryUserDep) {
        params.position = queryUserDep;
      }

      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await UserApi.getList(params);
      const pageData = response.data;

      setUsers(pageData.content ?? []);
      setTotalElements(
        pageData.totalElements ?? 0
      );
      setTotalPages(
        pageData.totalPages ?? 0
      );
    } catch (error) {
      console.error(
        "사용자 목록 조회 실패:",
        error
      );

      window.alert(
        "데이터를 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    isReady,
    currentPage,
    queryUserId,
    queryUserNm,
    queryUserDep,
    sortParams,
  ]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 검색
  const handleSearch = () => {
    const nextParams =
      new URLSearchParams(searchParams);

    nextParams.set("page", "0");

    const userId =
      userIdRef.current?.value.trim() || "";

    const userNm =
      userNmRef.current?.value.trim() || "";

    const userDep =
      userDepRef.current?.value.trim() || "";

    if (userId) {
      nextParams.set("userId", userId);
    } else {
      nextParams.delete("userId");
    }

    if (userNm) {
      nextParams.set("userNm", userNm);
    } else {
      nextParams.delete("userNm");
    }

    if (userDep) {
      nextParams.set("position", userDep);
    } else {
      nextParams.delete("position");
    }

    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    if (userIdRef.current) {
      userIdRef.current.value = "";
    }

    if (userNmRef.current) {
      userNmRef.current.value = "";
    }

    if (userDepRef.current) {
      userDepRef.current.value = "";
    }

    setSearchParams(
      { page: "0" },
      { replace: true }
    );
  };

  // 페이지 이동
  const handlePageChange = (
    newPage: number
  ) => {
    const nextParams =
      new URLSearchParams(searchParams);

    nextParams.set(
      "page",
      String(newPage)
    );

    setSearchParams(nextParams);
  };

  // 상세 페이지 이동
  const handleRowClick = (
    userId: string
  ) => {
    const queryString =
      searchParams.toString();

    navigate(
      `/system/users/${userId}${
        queryString
          ? `?${queryString}`
          : ""
      }`
    );
  };

  // 테이블 컬럼
  const columns: ColumnDef<UserResponse>[] =
    useMemo(
      () => [
        {
          accessorKey: "userId",
          header: "사용자ID",
        },
        {
          accessorKey: "userNm",
          header: "이름",
        },
        {
          accessorKey: "phone",
          header: "전화번호",
          cell: ({ getValue }) => {
            const val =
              getValue<string>();

            return val ? val : "-";
          },
        },
        {
          accessorKey: "position",
          header: "부서",
          cell: ({ getValue }) => {
            const val =
              getValue<string>();

            return val ? val : "-";
          },
        },
        {
          accessorKey: "use",
          header: "사용여부",
          cell: ({ getValue }) => (
            <Badge
              tone={
                getValue<boolean>()
                  ? "good"
                  : "muted"
              }
            >
              {getValue<boolean>()
                ? "사용"
                : "미사용"}
            </Badge>
          ),
        },
        {
          accessorKey: "createdAt",
          header: "등록일자",
          cell: ({ getValue }) => {
            const val =
              getValue<string>();

            return val
              ? formatDateTime(val)
              : "-";
          },
        },
      ],
      []
    );

  return (
    <section className="screenStack">
      <SearchBand
        fields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <Panel
        title="사용자관리 목록"
        action="등록"
        onAction={() => {
          const queryString = searchParams.toString();
          navigate(
            `/system/users/create${
              queryString ? `?${queryString}` : ""
            }`
          );
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
                onSortingChange={
                  handleSortingChange
                }
                onRowClick={(row) =>
                  handleRowClick(
                    row.userId
                  )
                }
                noDataMessage="조회된 데이터가 없습니다."
              />

              <CusPagination
                page={currentPage}
                totalPages={totalPages}
                totalCount={totalElements}
                onPageChange={
                  handlePageChange
                }
              />
            </>
          )}
        </div>
      </Panel>
    </section>
  );
}