import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortingState } from "@tanstack/react-table";

export function useTableSorting() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL의 sort 파라미터
  const sortParams = useMemo(() => {
    return searchParams.getAll("sort");
  }, [searchParams]);

  // URL의 sort 파라미터를 TanStack Table SortingState로 변환
  const sorting: SortingState = useMemo(() => {
    return sortParams
      .map((item) => {
        const [id, direction] = item.split(",");

        if (!id) {
          return null;
        }

        return {
          id,
          desc: direction === "desc",
        };
      })
      .filter(
        (
          item
        ): item is { id: string; desc: boolean } =>
          item !== null
      );
  }, [sortParams]);

  const handleSortingChange = useCallback(
    (
      updater:
        | SortingState
        | ((old: SortingState) => SortingState)
    ) => {
      const nextSorting =
        typeof updater === "function"
          ? updater(sorting)
          : updater;

      const nextParams = new URLSearchParams(searchParams);

      // 기존 정렬 제거
      nextParams.delete("sort");

      // 새로운 정렬 추가
      nextSorting.forEach((sort) => {
        nextParams.append(
          "sort",
          `${sort.id},${sort.desc ? "desc" : "asc"}`
        );
      });

      // 정렬 변경 시 첫 페이지
      nextParams.set("page", "0");

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