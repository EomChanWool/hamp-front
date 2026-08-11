import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";

import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  type ItemResponse,
  type ApiResponsePageItemResponse,
  type ProductType,
  type ItemCategory,
} from "@/types/master/Item";
import { Badge } from "@/components/common/Badge";

export function MasterItemsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<ItemResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const currentPage = Number(searchParams.get("page") || "0");
  const queryItemCode = searchParams.get("itemCode") || "";
  const queryProductType = searchParams.get("productType") || "";
  const queryCategory = searchParams.get("category") || "";
  const queryItemNm = searchParams.get("itemNm") || "";
  const queryUnit = searchParams.get("unit") || "";
  const queryStandard = searchParams.get("standard") || "";
  const queryUseYn = searchParams.get("useYn") || "";

  const itemCodeRef = useRef<HTMLInputElement>(null);
  const productTypeRef = useRef<HTMLSelectElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const itemNmRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLInputElement>(null);
  const standardRef = useRef<HTMLInputElement>(null);
  const useYnRef = useRef<HTMLSelectElement>(null);

  const searchFields: SearchField[] = [
    { type: "input", label: "품목코드", ref: itemCodeRef },
    {
      type: "select",
      label: "종류",
      ref: productTypeRef,
      options: [
        { label: "전체", value: "" },
        { label: PRODUCT_TYPE_LABEL[0], value: "0" },
        { label: PRODUCT_TYPE_LABEL[1], value: "1" },
      ],
    },
    {
      type: "select",
      label: "품목구분",
      ref: categoryRef,
      options: [
        { label: "전체", value: "" },
        { label: CATEGORY_LABEL[0], value: "0" },
        { label: CATEGORY_LABEL[1], value: "1" },
        { label: CATEGORY_LABEL[2], value: "2" },
      ],
    },
    { type: "input", label: "품목명", ref: itemNmRef },
    { type: "input", label: "단위", ref: unitRef },
    { type: "input", label: "규격", ref: standardRef },
    {
      type: "select",
      label: "사용여부",
      ref: useYnRef,
      options: [
        { label: "전체", value: "" },
        { label: "사용", value: "Y" },
        { label: "미사용", value: "N" },
      ],
    },
  ];

  useEffect(() => {
    if (itemCodeRef.current) itemCodeRef.current.value = queryItemCode;
    if (productTypeRef.current) productTypeRef.current.value = queryProductType;
    if (categoryRef.current) categoryRef.current.value = queryCategory;
    if (itemNmRef.current) itemNmRef.current.value = queryItemNm;
    if (unitRef.current) unitRef.current.value = queryUnit;
    if (standardRef.current) standardRef.current.value = queryStandard;
    if (useYnRef.current) useYnRef.current.value = queryUseYn;
  }, [
    queryItemCode,
    queryProductType,
    queryCategory,
    queryItemNm,
    queryUnit,
    queryStandard,
    queryUseYn,
  ]);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        size: 10,
      };

      if (queryItemCode) params.itemCode = queryItemCode;
      if (queryProductType) params.productType = queryProductType;
      if (queryCategory) params.category = queryCategory;
      if (queryItemNm) params.itemNm = queryItemNm;
      if (queryUnit) params.unit = queryUnit;
      if (queryStandard) params.standard = queryStandard;
      if (queryUseYn) params.useYn = queryUseYn;

      const response = await apiClient.get<ApiResponsePageItemResponse>("/items", {
        params,
      });

      const pageData = response.data.data;
      setItems(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setTotalPages(pageData.totalPages ?? 0);
    } catch (error) {
      console.error("품목 목록 조회 실패:", error);
      window.alert("품목 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    queryItemCode,
    queryProductType,
    queryCategory,
    queryItemNm,
    queryUnit,
    queryStandard,
    queryUseYn,
  ]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSearch = () => {
    const nextParams: Record<string, string> = { page: "0" };

    const itemCode = itemCodeRef.current?.value.trim();
    const productType = productTypeRef.current?.value.trim();
    const category = categoryRef.current?.value.trim();
    const itemNm = itemNmRef.current?.value.trim();
    const unit = unitRef.current?.value.trim();
    const standard = standardRef.current?.value.trim();
    const useYn = useYnRef.current?.value.trim();

    if (itemCode) nextParams.itemCode = itemCode;
    if (productType) nextParams.productType = productType;
    if (category) nextParams.category = category;
    if (itemNm) nextParams.itemNm = itemNm;
    if (unit) nextParams.unit = unit;
    if (standard) nextParams.standard = standard;
    if (useYn) nextParams.useYn = useYn;

    setSearchParams(nextParams);
  };

  const handleReset = () => {
    [itemCodeRef, itemNmRef, unitRef, standardRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    [productTypeRef, categoryRef, useYnRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    setSearchParams({ page: "0" });
  };

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
  };

  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/items/create?${queryString}` : "/master/items/create");
  };

  // 상세 페이지로 이동
  const handleOpenDetail = (itemCode: string) => {
    const queryString = searchParams.toString();
    navigate(
      queryString
        ? `/master/items/${encodeURIComponent(itemCode)}?${queryString}`
        : `/master/items/${encodeURIComponent(itemCode)}`
    );
  };

  const columns: ColumnDef<ItemResponse>[] = useMemo(
    () => [
      { accessorKey: "itemCode", header: "품목코드" },
      {
        accessorKey: "productType",
        header: "종류",
        cell: ({ getValue }) => PRODUCT_TYPE_LABEL[getValue<ProductType>()] ?? getValue(),
      },
      {
        accessorKey: "category",
        header: "품목구분",
        cell: ({ getValue }) => CATEGORY_LABEL[getValue<ItemCategory>()] ?? getValue(),
      },
      {
        accessorKey: "itemNm", header: "품목명", cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val : "-";
        },
      },
      {
        accessorKey: "unit", header: "단위", cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val : "-";
        },
      },
      {
        accessorKey: "standard", header: "규격", cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? val : "-";
        },
      },
      {
        accessorKey: "useYn",
        header: "사용여부",
        cell: ({ getValue }) => {
          const isUse = getValue<string>() === "Y";
          return (
            <Badge tone={isUse ? "good" : "muted"}>
              {isUse ? "사용" : "미사용"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "등록일자",
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
                handleOpenDetail(row.original.itemCode);
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

      <Panel title="품목관리 목록" action="등록" onAction={handleCreate}>
        <div className="relative min-h-[300px]">
          {isLoading && <span>데이터를 불러오는 중입니다...</span>}

          <CusTable
            data={items}
            columns={columns}
            onRowClick={(row) => handleOpenDetail(row.itemCode)}
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