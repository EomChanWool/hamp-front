import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import {
  SearchBand,
  type SearchField,
} from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { useTableSorting } from "@/hooks/useTableSorting";

import type { EquipmentResponse } from "@/types/master/Equipment";
import { EquipmentApi } from "@/types/master/Equipment";
import type { OperationOptionResponse } from "@/types/master/Operation";
import { OperationApi } from "@/types/master/Operation";
import Spinner from "@/components/common/Spinner";

export function MasterEquipmentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [equipments, setEquipments] = useState<EquipmentResponse[]>([]);
  const [operationOptions, setOperationOptions] = useState<OperationOptionResponse[]>([]);
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

  // 공정 옵션 목록 API 호출
  const fetchOperationOptions = useCallback(async () => {
    try {
      const response = await OperationApi.getOptions();
      setOperationOptions(response.data ?? []);
    } catch (error) {
      console.error("공정 옵션 목록 조회 실패:", error);
    }
  }, []);

  useEffect(() => {
    fetchOperationOptions();
  }, [fetchOperationOptions]);

  // URL에서 현재 검색조건 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryEqCode = searchParams.get("eqCode") || "";
  const queryOperCode = searchParams.get("operCode") || "";
  const queryEqNm = searchParams.get("eqNm") || "";
  const queryEqType = searchParams.get("eqType") || "";
  const queryManufacturer = searchParams.get("manufacturer") || "";

  // 검색 input / select refs
  const eqCodeRef = useRef<HTMLInputElement>(null);
  const operCodeRef = useRef<HTMLSelectElement>(null);
  const eqNmRef = useRef<HTMLInputElement>(null);
  const eqTypeRef = useRef<HTMLInputElement>(null);
  const manufacturerRef = useRef<HTMLInputElement>(null);

  // 검색 필드
  const searchFields: SearchField[] = [
    {
      type: "input",
      label: "장비코드",
      ref: eqCodeRef,
      name: "eqCode",
    },
    {
      type: "select",
      label: "공정코드",
      ref: operCodeRef,
      options: [
        { label: "전체", value: "" },
        ...operationOptions.map((opt) => ({
          label: `${opt.operCode} (${opt.operNm ?? "-"})`,
          value: opt.operCode,
        })),
      ],
    },
    {
      type: "input",
      label: "장비명",
      ref: eqNmRef,
      name: "eqNm",
    },
    {
      type: "input",
      label: "장비유형",
      ref: eqTypeRef,
      name: "eqType",
    },
    {
      type: "input",
      label: "제조사",
      ref: manufacturerRef,
      name: "manufacturer",
    },
  ];

  // URL → SearchBand input / select 동기화
  // (operationOptions를 추가하여, 비동기 옵션이 로드 완료된 순간에도 선택값이 풀리지 않고 정확히 반영되도록 보장)
  useEffect(() => {
    if (eqCodeRef.current) {
      eqCodeRef.current.value = queryEqCode;
    }
    if (operCodeRef.current) {
      operCodeRef.current.value = queryOperCode;
    }
    if (eqNmRef.current) {
      eqNmRef.current.value = queryEqNm;
    }
    if (eqTypeRef.current) {
      eqTypeRef.current.value = queryEqType;
    }
    if (manufacturerRef.current) {
      manufacturerRef.current.value = queryManufacturer;
    }
  }, [
    queryEqCode,
    queryOperCode,
    queryEqNm,
    queryEqType,
    queryManufacturer,
    operationOptions,
  ]);

  // 장비 목록 조회
  const loadEquipments = useCallback(async () => {
    if (!isReady) {
      return;
    }

    setIsLoading(true);

    try {
      const params: Record<string, any> = {
        page: currentPage,
        size: 10,
      };

      if (queryEqCode) {
        params.eqCode = queryEqCode;
      }
      if (queryOperCode) {
        params.operCode = queryOperCode;
      }
      if (queryEqNm) {
        params.eqNm = queryEqNm;
      }
      if (queryEqType) {
        params.eqType = queryEqType;
      }
      if (queryManufacturer) {
        params.manufacturer = queryManufacturer;
      }

      if (sortParams.length > 0) {
        params.sort = sortParams;
      }

      const response = await EquipmentApi.getList(params);
      const pageData = response.data;

      setEquipments(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("장비 목록 조회 실패:", error);
      window.alert("장비 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [
    isReady,
    currentPage,
    queryEqCode,
    queryOperCode,
    queryEqNm,
    queryEqType,
    queryManufacturer,
    sortParams,
  ]);

  useEffect(() => {
    loadEquipments();
  }, [loadEquipments]);

  // 검색
  const handleSearch = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");

    const eqCode = eqCodeRef.current?.value.trim() || "";
    const operCode = operCodeRef.current?.value.trim() || "";
    const eqNm = eqNmRef.current?.value.trim() || "";
    const eqType = eqTypeRef.current?.value.trim() || "";
    const manufacturer = manufacturerRef.current?.value.trim() || "";

    if (eqCode) {
      nextParams.set("eqCode", eqCode);
    } else {
      nextParams.delete("eqCode");
    }

    if (operCode) {
      nextParams.set("operCode", operCode);
    } else {
      nextParams.delete("operCode");
    }

    if (eqNm) {
      nextParams.set("eqNm", eqNm);
    } else {
      nextParams.delete("eqNm");
    }

    if (eqType) {
      nextParams.set("eqType", eqType);
    } else {
      nextParams.delete("eqType");
    }

    if (manufacturer) {
      nextParams.set("manufacturer", manufacturer);
    } else {
      nextParams.delete("manufacturer");
    }

    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    if (eqCodeRef.current) eqCodeRef.current.value = "";
    if (operCodeRef.current) operCodeRef.current.value = "";
    if (eqNmRef.current) eqNmRef.current.value = "";
    if (eqTypeRef.current) eqTypeRef.current.value = "";
    if (manufacturerRef.current) manufacturerRef.current.value = "";

    setSearchParams({ page: "0" }, { replace: true });
  };

  // 페이지 이동
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  // 상세 페이지 이동
  const handleRowClick = (eqCode: string) => {
    const queryString = searchParams.toString();
    navigate(
      `/master/equipment/${encodeURIComponent(eqCode)}${
        queryString ? `?${queryString}` : ""
      }`
    );
  };

  // 테이블 컬럼
  const columns: ColumnDef<EquipmentResponse>[] = useMemo(
    () => [
      { accessorKey: "eqCode", header: "장비코드" },
      {
        accessorKey: "operCode",
        header: "공정코드",
        cell: ({ getValue }) => getValue<string>() || "-",
      },
      {
        accessorKey: "eqNm",
        header: "장비명",
        cell: ({ getValue }) => getValue<string>() || "-",
      },
      {
        accessorKey: "eqType",
        header: "장비유형",
        cell: ({ getValue }) => getValue<string>() || "-",
      },
      {
        accessorKey: "manufacturer",
        header: "제조사",
        cell: ({ getValue }) => getValue<string>() || "-",
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
      <SearchBand
        fields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <Panel
        title="장비관리 목록"
        action="등록"
        onAction={() => {
          const queryString = searchParams.toString();
          navigate(
            `/master/equipment/create${
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
                data={equipments}
                columns={columns}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                onRowClick={(row) => handleRowClick(row.eqCode)}
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