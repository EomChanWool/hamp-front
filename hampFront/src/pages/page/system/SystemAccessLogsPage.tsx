import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@components/common/Badge";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { useTableSorting } from "@/hooks/useTableSorting";
import Spinner from "@/components/common/Spinner";
import { UserLoginApi } from "@/api/UserLogin";
import type { UserLoginResponse, UserLoginStatus } from "@/api/UserLogin";

// 접속상태 코드 → 화면 표시명
const STATUS_LABEL: Record<UserLoginStatus, string> = {
  SUCCESS: "성공",
  FAIL: "실패",
  LOGGED_OUT: "로그아웃",
  REPLACED: "중복로그인",
};

const STATUS_OPTIONS = [
  { label: "전체", value: "" },
  { label: STATUS_LABEL.SUCCESS, value: "SUCCESS" },
  { label: STATUS_LABEL.FAIL, value: "FAIL" },
  { label: STATUS_LABEL.LOGGED_OUT, value: "LOGGED_OUT" },
  { label: STATUS_LABEL.REPLACED, value: "REPLACED" },
];

const STATUS_TONE: Record<UserLoginStatus, "good" | "warn" | "danger" | "info" | "muted"> = {
  SUCCESS: "good",
  FAIL: "warn",
  LOGGED_OUT: "info",
  REPLACED: "danger",
};

// User-Agent → 브라우저명
const getBrowserName = (userAgent?: string | null) => {
  if (!userAgent) {
    return "-";
  }

  if (userAgent.includes("Edg/")) {
    return "Edge";
  }

  if (userAgent.includes("Chrome/")) {
    return "Chrome";
  }

  if (userAgent.includes("Firefox/")) {
    return "Firefox";
  }

  if (userAgent.includes("Safari/")) {
    return "Safari";
  }

  if (userAgent.includes("OPR/")) {
    return "Opera";
  }

  if (userAgent.includes("MSIE") || userAgent.includes("Trident/")) {
    return "Internet Explorer";
  }

  return "기타";
};

export function SystemAccessLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [logs, setLogs] = useState<UserLoginResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 새로고침 초기화가 끝난 뒤에 목록 조회를 시작하기 위한 상태
  const [isReady, setIsReady] = useState(false);

  const { sorting, sortParams, handleSortingChange } = useTableSorting();

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
  const queryLoginAtFrom = searchParams.get("loginAtFrom") || "";
  const queryLoginAtTo = searchParams.get("loginAtTo") || "";
  const queryUserId = searchParams.get("userId") || "";
  const queryIp = searchParams.get("ip") || "";
  const queryStatus = searchParams.get("status") || "";

  // 검색 input refs
  const loginStartRef = useRef<HTMLInputElement>(null);
  const loginEndRef = useRef<HTMLInputElement>(null);
  const userIdRef = useRef<HTMLInputElement>(null);
  const ipRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);

  // 검색 필드
  const searchFields: SearchField[] = [
    {
      type: "date",
      label: "기간",
      startRef: loginStartRef,
      endRef: loginEndRef,
    },
    {
      type: "input",
      label: "사용자ID",
      ref: userIdRef,
      name: "userId",
    },
    {
      type: "input",
      label: "IP",
      ref: ipRef,
      name: "ip",
    },
    {
      type: "select",
      label: "접속상태",
      ref: statusRef,
      name: "status",
      options: STATUS_OPTIONS,
    },
  ];

  // URL → SearchBand input 동기화
  useEffect(() => {
    if (loginStartRef.current) {
      loginStartRef.current.value = queryLoginAtFrom;
    }

    if (loginEndRef.current) {
      loginEndRef.current.value = queryLoginAtTo;
    }

    if (userIdRef.current) {
      userIdRef.current.value = queryUserId;
    }

    if (ipRef.current) {
      ipRef.current.value = queryIp;
    }

    if (statusRef.current) {
      statusRef.current.value = queryStatus;
    }
  }, [queryLoginAtFrom, queryLoginAtTo, queryUserId, queryIp, queryStatus]);

  // 접속기록 목록 조회
  const loadLogs = useCallback(async () => {
    if (!isReady) {
      return;
    }

    setIsLoading(true);

    try {
      const params: Record<string, any> = {
        page: currentPage,
        size: 10,
      };

      if (queryLoginAtFrom) {
        params.loginAtFrom = queryLoginAtFrom;
      }

      if (queryLoginAtTo) {
        params.loginAtTo = queryLoginAtTo;
      }

      if (queryUserId) {
        params.userId = queryUserId;
      }

      if (queryIp) {
        params.ip = queryIp;
      }

      if (queryStatus) {
        params.status = queryStatus;
      }

      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await UserLoginApi.getList(params);
      const pageData = response.data;

      setLogs(pageData?.content ?? []);
      setTotalElements(pageData?.totalElements ?? 0);
      setTotalPages(pageData?.totalPages ?? 0);
    } catch (error) {
      console.error("접속기록 목록 조회 실패:", error);

      window.alert("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [
    isReady,
    currentPage,
    queryLoginAtFrom,
    queryLoginAtTo,
    queryUserId,
    queryIp,
    queryStatus,
    sortParams,
  ]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // 검색
  const handleSearch = () => {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("page", "0");

    const values: Record<string, string> = {
      loginAtFrom: loginStartRef.current?.value.trim() || "",
      loginAtTo: loginEndRef.current?.value.trim() || "",
      userId: userIdRef.current?.value.trim() || "",
      ip: ipRef.current?.value.trim() || "",
      status: statusRef.current?.value.trim() || "",
    };

    Object.entries(values).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });

    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    [loginStartRef, loginEndRef, userIdRef, ipRef].forEach((ref) => {
      if (ref.current) {
        ref.current.value = "";
      }
    });

    if (statusRef.current) {
      statusRef.current.value = "";
    }

    setSearchParams({ page: "0" }, { replace: true });
  };

  // 페이지 이동
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("page", String(newPage));

    setSearchParams(nextParams);
  };

  // 테이블 컬럼
  const columns: ColumnDef<UserLoginResponse>[] = useMemo(
    () => [
      {
        accessorKey: "loginAt",
        header: "접속일시",
        cell: ({ getValue }) => {
          const val = getValue<string>();

          return val ? formatDateTime(val) : "-";
        },
      },
      {
        accessorKey: "userId",
        header: "사용자ID",
      },
      {
        accessorKey: "ip",
        header: "IP",
        cell: ({ getValue }) => getValue<string>() || "-",
      },
      {
        accessorKey: "browser",
        header: "접속브라우저",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();

          return getBrowserName(val);
        },
      },
      {
        accessorKey: "status",
        header: "접속상태",
        cell: ({ getValue }) => {
          const val = getValue<UserLoginStatus | undefined>();

          if (!val) {
            return "-";
          }

          return (
            <Badge tone={STATUS_TONE[val as UserLoginStatus] ?? "muted"}>
              {STATUS_LABEL[val as UserLoginStatus] ?? val}
            </Badge>
          );
        },
      },
      {
        accessorKey: "logoutAt",
        header: "로그아웃일시",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();

          return val ? formatDateTime(val) : "-";
        },
      },
      {
        accessorKey: "note",
        header: "비고",
        cell: ({ getValue }) => getValue<string>() || "-",
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

      <Panel title="사용자접속기록 목록">
        <div className="relative min-h-[300px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <CusTable
                data={logs}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
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
