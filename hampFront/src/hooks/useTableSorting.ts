import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortingState } from "@tanstack/react-table";

export function useTableSorting() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL에서 sort 파라미터 추출
  const sortParams = useMemo(() => searchParams.getAll("sort"), [searchParams]);

  // TanStack Table용 SortingState로 변환
  const sorting: SortingState = useMemo(() => {
    return sortParams.map((item) => {
      const [id, desc] = item.split(",");
      return { id, desc: desc === "desc" };
    });
  }, [sortParams]);

  // 테이블 정렬 변경 핸들러
  const handleSortingChange = (updater: any) => {
    const nextSorting = typeof updater === "function" ? updater(sorting) : updater;
    const nextParams = new URLSearchParams(searchParams);

    nextParams.delete("sort");
    nextSorting.forEach((s: { id: string; desc: boolean }) => {
      nextParams.append("sort", `${s.id},${s.desc ? "desc" : "asc"}`);
    });

    const rawQueryString = nextParams.toString().replace(/%2C/g, ",");
    setSearchParams(rawQueryString);
  };

  return {
    sorting,
    sortParams,
    handleSortingChange,
  };
}