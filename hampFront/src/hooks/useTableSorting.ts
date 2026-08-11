import { useMemo, useCallback } from "react";
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
  const handleSortingChange = useCallback(
    (updater: any) => {
      const nextSorting = typeof updater === "function" ? updater(sorting) : updater;
      const nextParams = new URLSearchParams(searchParams);

      // 기존 sort 파라미터 모두 제거 후 새로 추가
      nextParams.delete("sort");
      nextSorting.forEach((s: { id: string; desc: boolean }) => {
        nextParams.append("sort", `${s.id},${s.desc ? "desc" : "asc"}`);
      });

      // 문자열 치환 방식 대신 URLSearchParams 객체를 그대로 전달
      setSearchParams(nextParams);
    },
    [searchParams, sorting, setSearchParams]
  );

  return {
    sorting,
    sortParams,
    handleSortingChange,
  };
}