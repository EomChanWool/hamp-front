import { useState, useEffect, useMemo, type SyntheticEvent, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import {
  PRODUCT_TYPE_LABEL,
  CATEGORY_LABEL,
  type ItemCreateRequest,
  type ProductType,
  type ItemCategory,
  type ItemRoutingRequest,
  type ApiResponseItemResponse,
} from "@/types/master/Item";
import './MasterItem.css';

interface OperationOption {
  operCode: string;
  operNm: string;
}

export function MasterItemsCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 전체 공정 옵션 목록 상태
  const [operations, setOperations] = useState<OperationOption[]>([]);

  // 기본 폼 상태
  const [form, setForm] = useState<{
    itemCode: string;
    productType: string;
    category: string;
    itemNm: string;
    unit: string;
    standard: string;
  }>({
    itemCode: "",
    productType: "",
    category: "",
    itemNm: "",
    unit: "",
    standard: "",
  });

  // 공정 라우팅 목록 상태
  const [routings, setRoutings] = useState<ItemRoutingRequest[]>([]);

  // 드래그 앤 드롭을 위한 상태 관리 훅
  const draggedItemIndex = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // 다중 선택 팝업 모달 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearchKeyword, setModalSearchKeyword] = useState("");
  // 팝업 안에서 임시로 체크한 공정 코드들
  const [tempSelectedCodes, setTempSelectedCodes] = useState<string[]>([]);

  // 페이지 진입 시 공정 옵션 데이터 페칭
  useEffect(() => {
    const fetchOperations = async () => {
      try {
        const response = await apiClient.get("/operations/options");
        const data = response.data?.data || response.data || [];
        setOperations(data);
      } catch (error) {
        console.error("공정 옵션 목록 조회 실패:", error);
      }
    };

    fetchOperations();
  }, []);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    // 품목구분이 원료('0')로 변경되거나 초기화되면 라우팅 정보 삭제
    if (key === "category" && value === "0") {
      setRoutings([]);
    }
  };

  // 공정 삭제 (삭제 후 operSeq 자동 재정렬)
  const handleRemoveRouting = (index: number) => {
    setRoutings((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, operSeq: i + 1 }))
    );
  };

  // 공정 데이터 변경 Handling (최종공정 여부 등)
  const handleRoutingChange = (
    index: number,
    field: keyof ItemRoutingRequest,
    value: unknown
  ) => {
    setRoutings((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // --- 드래그 앤 드롭 핸들러들 ---
  const handleDragStart = (index: number) => {
    draggedItemIndex.current = index;
    setDraggingIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // 드롭을 허용하기 위해 기본 동작 방지
  };

  const handleDrop = (targetIndex: number) => {
    const sourceIndex = draggedItemIndex.current;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    setRoutings((prev) => {
      const newRoutings = [...prev];
      const [movedItem] = newRoutings.splice(sourceIndex, 1);
      newRoutings.splice(targetIndex, 0, movedItem);

      // 위치 이동 후 순서 번호(operSeq) 자동 재정렬
      return newRoutings.map((item, i) => ({ ...item, operSeq: i + 1 }));
    });

    draggedItemIndex.current = null;
    setDraggingIndex(null);
  };

  const handleDragEnd = () => {
    draggedItemIndex.current = null;
    setDraggingIndex(null);
  };
  // ------------------------------------

  // 팝업 모달 열기
  const handleOpenModal = () => {
    setModalSearchKeyword("");
    const currentCodes = routings.map((r) => r.operCode).filter(Boolean) as string[];
    setTempSelectedCodes(currentCodes);
    setIsModalOpen(true);
  };

  // 모달 내 개별 체크박스 토글
  const handleToggleCheckbox = (operCode: string) => {
    setTempSelectedCodes((prev) =>
      prev.includes(operCode)
        ? prev.filter((code) => code !== operCode)
        : [...prev, operCode]
    );
  };

  // 팝업 내부 검색 필터링 목록
  const filteredOperations = useMemo(() => {
    if (!modalSearchKeyword.trim()) return operations;
    const keyword = modalSearchKeyword.toLowerCase();
    return operations.filter(
      (op) =>
        op.operCode.toLowerCase().includes(keyword) ||
        op.operNm.toLowerCase().includes(keyword)
    );
  }, [operations, modalSearchKeyword]);

  // 전체선택 / 전체해제 토글 핸들러 (현재 검색된 목록 기준)
  const handleToggleSelectAll = () => {
    const filteredCodes = filteredOperations.map((op) => op.operCode);
    const isAllCurrentlySelected = filteredCodes.every((code) =>
      tempSelectedCodes.includes(code)
    );

    if (isAllCurrentlySelected) {
      setTempSelectedCodes((prev) =>
        prev.filter((code) => !filteredCodes.includes(code))
      );
    } else {
      setTempSelectedCodes((prev) => {
        const merged = new Set([...prev, ...filteredCodes]);
        return Array.from(merged);
      });
    }
  };

  // 팝업에서 [선택 완료] 클릭 시 (기존 순서 유지하며 추가/삭제 반영)
  const handleConfirmModal = () => {
    setRoutings((prev) => {
      // 기존에 이미 추가되어 있던 공정들은 순서를 최대한 유지
      const existingMap = new Map(prev.map((r) => [r.operCode, r]));

      const newRoutings: ItemRoutingRequest[] = tempSelectedCodes.map((code) => {
        const existing = existingMap.get(code);
        return {
          operCode: code,
          operSeq: 0, // 임시 지정 뒤에 재정렬
          finalYn: existing ? existing.finalYn : "N",
        };
      });

      // 순서 번호(operSeq) 부여
      return newRoutings.map((item, idx) => ({ ...item, operSeq: idx + 1 }));
    });

    setIsModalOpen(false);
  };

  // 프론트엔드 유효성 체크
  const validateForm = (): boolean => {
    if (!form.itemCode.trim()) {
      alert("품목 코드를 입력해주세요.");
      return false;
    }

    const selectedCategory =
      form.category !== "" ? (Number(form.category) as ItemCategory) : null;

    if (selectedCategory === 1 || selectedCategory === 2) {
      if (routings.length === 0) {
        alert("반제품/완제품 등록 시 공정 라우팅을 최소 1개 이상 추가해야 합니다.");
        return false;
      }
    }

    return true;
  };

  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/items?${queryString}` : "/master/items");
  };

  // 등록 제출 핸들러
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const selectedCategory =
      form.category !== "" ? (Number(form.category) as ItemCategory) : null;

    const payload: ItemCreateRequest = {
      itemCode: form.itemCode.trim(),
      productType:
        form.productType !== "" ? (Number(form.productType) as ProductType) : null,
      category: selectedCategory,
      itemNm: form.itemNm.trim() || null,
      unit: form.unit.trim() || null,
      standard: form.standard.trim() || null,
      routings:
        selectedCategory === 1 || selectedCategory === 2
          ? routings.map((r) => ({
              operCode: r.operCode?.trim() || null,
              operSeq: r.operSeq,
              finalYn: r.finalYn || "N",
            }))
          : null,
    };

    setIsSubmitting(true);
    try {
      await apiClient.post<ApiResponseItemResponse>("/items", payload);
      alert("성공적으로 등록되었습니다.");
      navigate("/master/items", { replace: true });
    } catch (error) {
      console.error("품목 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      alert(message || "품목 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRoutingRequired = form.category === "1" || form.category === "2";

  // 현재 필터된 목록이 모두 선택되었는지 여부 확인
  const isAllFilteredSelected =
    filteredOperations.length > 0 &&
    filteredOperations.every((op) => tempSelectedCodes.includes(op.operCode));

  return (
    <section className="screenStack">
      <Panel title="신규 품목 등록">
        <form className="pageForm" onSubmit={handleSubmit}>
          {/* 품목 코드 */}
          <div className="detailField">
            <label className="requiredLabel">
              품목코드 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.itemCode}
              disabled={isSubmitting}
              onChange={(e) => handleChange("itemCode", e.target.value)}
              placeholder="예: ITM001"
            />
          </div>

          {/* 종류 */}
          <div className="detailField">
            <label>종류</label>
            <select
              className="tableInput"
              value={form.productType}
              disabled={isSubmitting}
              onChange={(e) => handleChange("productType", e.target.value)}
            >
              <option value="">선택</option>
              <option value="0">{PRODUCT_TYPE_LABEL[0]}</option>
              <option value="1">{PRODUCT_TYPE_LABEL[1]}</option>
            </select>
          </div>

          {/* 품목 구분 */}
          <div className="detailField">
            <label>품목구분</label>
            <select
              className="tableInput"
              value={form.category}
              disabled={isSubmitting}
              onChange={(e) => handleChange("category", e.target.value)}
            >
              <option value="">선택</option>
              <option value="0">{CATEGORY_LABEL[0]}</option>
              <option value="1">{CATEGORY_LABEL[1]}</option>
              <option value="2">{CATEGORY_LABEL[2]}</option>
            </select>
          </div>

          {/* 품목명 */}
          <div className="detailField">
            <label>품목명</label>
            <input
              className="tableInput"
              value={form.itemNm}
              disabled={isSubmitting}
              onChange={(e) => handleChange("itemNm", e.target.value)}
              placeholder="예: 사과 통조림"
            />
          </div>

          {/* 단위 */}
          <div className="detailField">
            <label>단위</label>
            <input
              className="tableInput"
              value={form.unit}
              disabled={isSubmitting}
              onChange={(e) => handleChange("unit", e.target.value)}
              placeholder="예: EA, BOX, KG"
            />
          </div>

          {/* 규격 */}
          <div className="detailField">
            <label>규격</label>
            <input
              className="tableInput"
              value={form.standard}
              disabled={isSubmitting}
              onChange={(e) => handleChange("standard", e.target.value)}
              placeholder="예: 500g"
            />
          </div>

          {/* 반제품(1) / 완제품(2) 선택 시 나타나는 공정 라우팅 설정 영역 */}
          {isRoutingRequired && (
            <div className="routingSection">
              <div className="routingHeader">
                <label className="requiredLabel" style={{ fontWeight: 600 }}>
                  공정 라우팅 설정 <span className="required">*</span>
                </label>
                <button
                  type="button"
                  className="miniButton primary"
                  disabled={isSubmitting}
                  onClick={handleOpenModal}
                >
                  공정 선택 / 추가
                </button>
              </div>

              {routings.length === 0 ? (
                <div className="routingEmptyBox">
                  선택된 공정이 없습니다. [공정 선택 / 추가] 버튼을 눌러주세요.
                </div>
              ) : (
                <div className="routingGrid">
                  {routings.map((route, index) => {
                    const matchedOp = operations.find(
                      (op) => op.operCode === route.operCode
                    );
                    const isDragging = draggingIndex === index;

                    return (
                      <div
                        key={`${route.operCode}-${index}`}
                        className={`routingItem ${isDragging ? "dragging" : ""}`}
                        draggable={!isSubmitting}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(index)}
                        onDragEnd={handleDragEnd}
                      >
                        <span className="dragHandle" title="드래그하여 순서 변경">
                          ☰
                        </span>
                        
                        <span className="routingSeq">
                          순서 {route.operSeq}
                        </span>

                        <div className="routingInfo">
                          {route.operCode} {matchedOp ? `(${matchedOp.operNm})` : ""}
                        </div>

                        {/* 일반공정/최종공정 선택 셀렉트박스 */}
                        <select
                          className="tableInput routingSelect"
                          value={route.finalYn ?? "N"}
                          disabled={isSubmitting}
                          onChange={(e) =>
                            handleRoutingChange(index, "finalYn", e.target.value)
                          }
                        >
                          <option value="N">일반공정</option>
                          <option value="Y">최종공정</option>
                        </select>

                        {/* 제외 버튼 */}
                        <button
                          type="button"
                          className="miniButton danger"
                          disabled={isSubmitting}
                          onClick={() => handleRemoveRouting(index)}
                        >
                          제외
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 하단 버튼 영역 */}
          <div className="pageFormFooter">
            <button
              type="button"
              className="ghostButton"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="primaryButton"
              disabled={isSubmitting}
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </Panel>

      {/* 공정 다중 선택 팝업 모달 */}
      {isModalOpen && (
        <div className="modalOverlay">
          <div className="detailModal">
            <div className="detailModalHeader">
              <div>
                <h3>공정 선택</h3>
                <span>등록할 품목의 공정 라우팅을 선택하세요.</span>
              </div>
              <button
                type="button"
                className="detailModalClose"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="detailModalBody modalBodyFlex">
              {/* 검색창 */}
              <div>
                <input
                  type="text"
                  className="tableInput modalSearchInput"
                  placeholder="공정 코드 또는 공정명 검색..."
                  value={modalSearchKeyword}
                  onChange={(e) => setModalSearchKeyword(e.target.value)}
                  autoFocus
                />
              </div>

              {/* 전체선택 버튼 및 카운트 표시 행 */}
              <div className="modalSelectAllRow">
                <div className="modalCountText">
                  선택된 공정 수: <strong>{tempSelectedCodes.length}</strong>개
                </div>
                <button
                  type="button"
                  className="miniButton ghostButton"
                  onClick={handleToggleSelectAll}
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                >
                  {isAllFilteredSelected ? "전체 해제" : "전체 선택"}
                </button>
              </div>

              {/* 체크박스 공정 목록 리스트 (스크롤) */}
              <div className="modalListContainer">
                {filteredOperations.length === 0 ? (
                  <div className="modalEmptyText">
                    검색된 공정이 없습니다.
                  </div>
                ) : (
                  filteredOperations.map((op) => {
                    const isChecked = tempSelectedCodes.includes(op.operCode);
                    return (
                      <div
                        key={op.operCode}
                        onClick={() => handleToggleCheckbox(op.operCode)}
                        className={`modalListItem ${isChecked ? "modalListItemChecked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ cursor: "pointer" }}
                        />
                        <div className="modalListItemContent">
                          <span className="modalListItemTitle">
                            {op.operNm}
                          </span>
                          <span className="modalListItemCode">
                            {op.operCode}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 팝업 하단 액션 버튼 */}
            <div className="detailModalFooter">
              <button
                type="button"
                className="ghostButton"
                onClick={() => setIsModalOpen(false)}
              >
                취소
              </button>
              <div className="detailModalFooterRight">
                <button
                  type="button"
                  className="primaryButton"
                  onClick={handleConfirmModal}
                >
                  선택 완료 ({tempSelectedCodes.length}개 적용)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}