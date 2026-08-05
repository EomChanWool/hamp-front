import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { RowDetailModal } from "@components/common/RowDetailModal";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { CusTable } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";

import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  type ItemResponse,
  type ItemDetailResponse,
  type ApiResponseItemDetailResponse,
  type ApiResponsePageItemResponse,
  type ItemUpdateRequest,
  type ProductType,
  type ItemCategory,
} from "@/types/master/Item";

export function MasterItemsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<ItemResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingItemCode, setDetailLoadingItemCode] = useState<string | null>(null);

  // 수정 및 삭제 상태 관리
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalItem, setModalItem] = useState<ItemDetailResponse | null>(null);

  const detailRequestIdRef = useRef(0);

  // URL에서 현재 페이지 및 검색어 추출
  const currentPage = Number(searchParams.get("page") || "0");
  const queryItemCode = searchParams.get("itemCode") || "";
  const queryProductType = searchParams.get("productType") || "";
  const queryCategory = searchParams.get("category") || "";
  const queryItemNm = searchParams.get("itemNm") || "";
  const queryUnit = searchParams.get("unit") || "";
  const queryStandard = searchParams.get("standard") || "";
  const queryUseYn = searchParams.get("useYn") || "";

  // 검색 필드 Refs
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

  // URL Query가 바뀔 때 Input/Select 필드 값 복원
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

  // 1. 품목 목록 조회 (useCallback으로 메모이제이션)
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

  // URL 쿼리 파라미터 변경 시 자동 재조회
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // 검색 버튼 클릭 시
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

  // 검색 초기화 시
  const handleReset = () => {
    [itemCodeRef, itemNmRef, unitRef, standardRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    [productTypeRef, categoryRef, useYnRef].forEach((ref) => {
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

  // 2. 품목 상세 조회 (GET /items/{itemCode})
  const handleOpenDetail = async (itemCode: string) => {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoadingItemCode(itemCode);

    try {
      const encodedItemCode = encodeURIComponent(itemCode);
      const response = await apiClient.get<ApiResponseItemDetailResponse>(
        `/items/${encodedItemCode}`
      );
      const item = response.data.data;

      if (!item) throw new Error("품목 상세 데이터가 없습니다.");

      if (requestId === detailRequestIdRef.current) {
        setModalItem(item);
      }
    } catch (error) {
      console.error("품목 상세 조회 실패:", error);
      if (requestId === detailRequestIdRef.current) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.message
          : error instanceof Error
          ? error.message
          : null;
        window.alert(message || "상세 정보를 불러오는 중 오류가 발생했습니다.");
      }
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoadingItemCode(null);
      }
    }
  };

  // 3. 등록 페이지로 이동
  const handleCreate = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/items/create?${queryString}` : "/master/items/create");
  };

  // 4. 품목 정보 수정 처리 (PUT /items/{itemCode})
  const handleSave = async (updated: Record<string, string>) => {
    if (!modalItem || isUpdating) return;

    setIsUpdating(true);
    try {
      const productTypeVal = "productType" in updated ? updated.productType : modalItem.productType;
      const categoryVal = "category" in updated ? updated.category : modalItem.category;
      const itemNmVal = "itemNm" in updated ? updated.itemNm : modalItem.itemNm;
      const unitVal = "unit" in updated ? updated.unit : modalItem.unit;
      const standardVal = "standard" in updated ? updated.standard : modalItem.standard;

      const updatePayload: ItemUpdateRequest = {
        productType: productTypeVal !== "" && productTypeVal !== null ? (Number(productTypeVal) as ProductType) : null,
        category: categoryVal !== "" && categoryVal !== null ? (Number(categoryVal) as ItemCategory) : null,
        itemNm: itemNmVal?.trim() ? itemNmVal.trim() : null,
        unit: unitVal?.trim() ? unitVal.trim() : null,
        standard: standardVal?.trim() ? standardVal.trim() : null,
      };

      const encodedItemCode = encodeURIComponent(modalItem.itemCode);

      const response = await apiClient.put(`/items/${encodedItemCode}`, updatePayload);

      const successMessage = response.data?.message || "수정되었습니다.";
      window.alert(successMessage);

      setModalItem(null);
      await loadItems();
    } catch (err) {
      console.error("품목 수정 실패:", err);
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.message
        : null;
      window.alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 5. 품목 삭제 처리 (DELETE /items/{itemCode})
  const handleDeleteItem = async () => {
    if (!modalItem || isDeleting) return;

    const confirmed = window.confirm(
      `${modalItem.itemNm ?? modalItem.itemCode} 품목을 삭제하시겠습니까?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const encodedItemCode = encodeURIComponent(modalItem.itemCode);
      await apiClient.delete(`/items/${encodedItemCode}`);
      window.alert("품목이 삭제되었습니다.");
      setModalItem(null);
      await loadItems();
    } catch (error) {
      console.error("품목 삭제 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      window.alert(message || "품목 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 테이블 컬럼 정의
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
      { accessorKey: "itemNm", header: "품목명" },
      { accessorKey: "unit", header: "단위" },
      { accessorKey: "standard", header: "규격" },
      { accessorKey: "useYn", header: "사용여부" },
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
              disabled={detailLoadingItemCode === row.original.itemCode}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(row.original.itemCode);
              }}
            >
              {detailLoadingItemCode === row.original.itemCode ? "조회 중..." : "상세"}
            </button>
          </div>
        ),
      },
    ],
    [detailLoadingItemCode]
  );

  // 모달 상세 필드 설정
  const detailFields = [
    { label: "품목코드", key: "itemCode", editable: false },
    { label: "종류", key: "productType" },
    { label: "품목구분", key: "category" },
    { label: "품목명", key: "itemNm" },
    { label: "단위", key: "unit" },
    { label: "규격", key: "standard" },
    { label: "사용여부", key: "useYn", editable: false },
    { label: "생성일시", key: "createdAt", editable: false },
    { label: "수정일시", key: "updatedAt", editable: false },
  ];

  const modalData = useMemo(() => {
    if (!modalItem) return {};
    return {
      itemCode: modalItem.itemCode,
      productType: modalItem.productType?.toString() ?? "",
      category: modalItem.category?.toString() ?? "",
      itemNm: modalItem.itemNm ?? "",
      unit: modalItem.unit ?? "",
      standard: modalItem.standard ?? "",
      useYn: modalItem.useYn ?? "",
      createdAt: formatDateTime(modalItem.createdAt),
      updatedAt: formatDateTime(modalItem.updatedAt),
    };
  }, [modalItem]);

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

      {/* 품목 상세/수정 모달 */}
      <RowDetailModal
        isOpen={modalItem !== null}
        onClose={() => {
          if (!isDeleting && !isUpdating) setModalItem(null);
        }}
        onSave={handleSave}
        fields={detailFields}
        data={modalData as unknown as Record<string, string>}
        dangerAction={{
          label: "품목 삭제",
          loadingLabel: "삭제 처리 중...",
          onClick: handleDeleteItem,
          isLoading: isDeleting,
        }}
      />
    </section>
  );
}