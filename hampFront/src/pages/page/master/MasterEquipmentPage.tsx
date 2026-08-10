import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";

import type {
  EquipmentResponse,
  ApiResponsePageEquipmentResponse,
} from "@/types/master/Equipment";

export function MasterEquipmentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [equipments, setEquipments] = useState<EquipmentResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // URL 쿼리스트링에서 상태 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryEqCode = searchParams.get("eqCode") || "";
  const queryOperCode = searchParams.get("operCode") || "";
  const queryEqNm = searchParams.get("eqNm") || "";
  const queryEqType = searchParams.get("eqType") || "";
  const queryManufacturer = searchParams.get("manufacturer") || "";

  // 검색 필드 Refs
  const eqCodeRef = useRef<HTMLInputElement>(null);
  const operCodeRef = useRef<HTMLInputElement>(null);
  const eqNmRef = useRef<HTMLInputElement>(null);
  const eqTypeRef = useRef<HTMLInputElement>(null);
  const manufacturerRef = useRef<HTMLInputElement>(null);

  const searchFields: SearchField[] = [
    { type: "input", label: "장비코드", ref: eqCodeRef },
    { type: "input", label: "공정코드", ref: operCodeRef },
    { type: "input", label: "장비명", ref: eqNmRef },
    { type: "input", label: "장비유형", ref: eqTypeRef },
    { type: "input", label: "제조사", ref: manufacturerRef },
  ];

  // URL 쿼리스트링 값과 검색창 input 값 동기화
  useEffect(() => {
    if (eqCodeRef.current) eqCodeRef.current.value = queryEqCode;
    if (operCodeRef.current) operCodeRef.current.value = queryOperCode;
    if (eqNmRef.current) eqNmRef.current.value = queryEqNm;
    if (eqTypeRef.current) eqTypeRef.current.value = queryEqType;
    if (manufacturerRef.current) manufacturerRef.current.value = queryManufacturer;
  }, [
    queryEqCode,
    queryOperCode,
    queryEqNm,
    queryEqType,
    queryManufacturer,
  ]);

  // 1. 장비 목록 조회 (GET /equipment)
  const loadEquipments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        size: 10,
      };
      if (queryEqCode) params.eqCode = queryEqCode;
      if (queryOperCode) params.operCode = queryOperCode;
      if (queryEqNm) params.eqNm = queryEqNm;
      if (queryEqType) params.eqType = queryEqType;
      if (queryManufacturer) params.manufacturer = queryManufacturer;

      const response = await apiClient.get<ApiResponsePageEquipmentResponse>("/equipment", {
        params,
      });

      const pageData = response.data.data;
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
    currentPage,
    queryEqCode,
    queryOperCode,
    queryEqNm,
    queryEqType,
    queryManufacturer,
  ]);

  useEffect(() => {
    loadEquipments();
  }, [loadEquipments]);

  // 검색 핸들러
  const handleSearch = () => {
    const nextParams: Record<string, string> = {
      page: "0",
    };

    const eqCode = eqCodeRef.current?.value.trim();
    const operCode = operCodeRef.current?.value.trim();
    const eqNm = eqNmRef.current?.value.trim();
    const eqType = eqTypeRef.current?.value.trim();
    const manufacturer = manufacturerRef.current?.value.trim();

    if (eqCode) nextParams.eqCode = eqCode;
    if (operCode) nextParams.operCode = operCode;
    if (eqNm) nextParams.eqNm = eqNm;
    if (eqType) nextParams.eqType = eqType;
    if (manufacturer) nextParams.manufacturer = manufacturer;

    setSearchParams(nextParams);
  };

  // 검색 초기화
  const handleReset = () => {
    [eqCodeRef, operCodeRef, eqNmRef, eqTypeRef, manufacturerRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    setSearchParams({
      page: "0",
    });
  };

  // 페이지네이션 핸들러
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  // 등록 페이지로 이동
  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(
      queryString
        ? `/master/equipment/create?${queryString}`
        : "/master/equipment/create"
    );
  };

  // 상세 페이지로 이동
  const handleOpenDetail = (eqCode: string) => {
    const queryString = searchParams.toString();
    navigate(
      queryString
        ? `/master/equipment/${encodeURIComponent(eqCode)}?${queryString}`
        : `/master/equipment/${encodeURIComponent(eqCode)}`
    );
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<EquipmentResponse>[] = useMemo(
    () => [
      { accessorKey: "eqCode", header: "장비코드" },
      { accessorKey: "operCode", header: "공정코드", cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val : "-";
        }, },
      { accessorKey: "eqNm", header: "장비명", cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val : "-";
        }, },
      { accessorKey: "eqType", header: "장비유형", cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val : "-";
        }, },
      { accessorKey: "manufacturer", header: "제조사", cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val : "-";
        }, },
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
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(row.original.eqCode);
              }}
            >
              상세
            </button>
          </div>
        ),
      },
    ],
    [searchParams]
  );

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="장비관리 목록" action="등록" onAction={handleCreate}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={equipments}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.eqCode)}
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