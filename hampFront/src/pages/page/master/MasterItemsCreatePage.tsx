import { useState, useEffect, type SyntheticEvent, useRef } from "react";
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
  type ApiResponseItemResponse,
} from "@/types/master/Item";
import { OperationSelectModal } from "@components/common/OperationSelectModal";
import { useItemRoutings } from "@/hooks/useItemRoutings";
import './MasterItem.css';

interface OperationOption {
  operCode: string;
  operNm: string;
}

export function MasterItemsCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 키보드 이동 후 포커스 유지를 위한 ref 배열
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  // 커스텀 훅을 통한 공정 라우팅 및 드래그/키보드 이동 관리
  const {
    routings,
    draggingIndex,
    targetIndex,
    keyboardActiveIndex, // 🌟 키보드로 잡고 있는 상태 인덱스 추가
    syncRoutings,
    removeRouting: handleRemoveRouting,
    updateRouting: handleRoutingChange,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    handleKeyDown,
  } = useItemRoutings();

  // 다중 선택 팝업 모달 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearchKeyword, setModalSearchKeyword] = useState("");
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
    if (key === "category" && value === "0") {
      syncRoutings([]);
    }
  };

  const handleOpenModal = () => {
    setModalSearchKeyword("");
    const currentCodes = routings.map((r) => r.operCode).filter(Boolean) as string[];
    setTempSelectedCodes(currentCodes);
    setIsModalOpen(true);
  };

  const handleConfirmModal = () => {
    syncRoutings(tempSelectedCodes);
    setIsModalOpen(false);
  };

  const validateForm = (): boolean => {
    if (!form.itemCode.trim()) {
      alert("품목 코드를 입력해주세요.");
      return false;
    }
    const selectedCategory = form.category !== "" ? (Number(form.category) as ItemCategory) : null;
    if ((selectedCategory === 1 || selectedCategory === 2) && routings.length === 0) {
      alert("반제품/완제품 등록 시 공정 라우팅을 최소 1개 이상 추가해야 합니다.");
      return false;
    }
    return true;
  };

  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/master/items?${queryString}` : "/master/items");
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const selectedCategory = form.category !== "" ? (Number(form.category) as ItemCategory) : null;
    const payload: ItemCreateRequest = {
      itemCode: form.itemCode.trim(),
      productType: form.productType !== "" ? (Number(form.productType) as ProductType) : null,
      category: selectedCategory,
      itemNm: form.itemNm.trim() || null,
      unit: form.unit.trim() || null,
      standard: form.standard.trim() || null,
      routings: (selectedCategory === 1 || selectedCategory === 2)
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
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(message || "품목 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRoutingRequired = form.category === "1" || form.category === "2";

  return (
    <section className="screenStack">
      <Panel title="신규 품목 등록">
        <form className="pageForm" onSubmit={handleSubmit}>
          <div className="detailField">
            <label className="requiredLabel">품목코드 <span className="required">*</span></label>
            <input className="tableInput" value={form.itemCode} disabled={isSubmitting} onChange={(e) => handleChange("itemCode", e.target.value)} placeholder="예: ITM001" />
          </div>

          <div className="detailField">
            <label>종류</label>
            <select className="tableInput" value={form.productType} disabled={isSubmitting} onChange={(e) => handleChange("productType", e.target.value)}>
              <option value="">선택</option>
              <option value="0">{PRODUCT_TYPE_LABEL[0]}</option>
              <option value="1">{PRODUCT_TYPE_LABEL[1]}</option>
            </select>
          </div>

          <div className="detailField">
            <label>품목구분</label>
            <select className="tableInput" value={form.category} disabled={isSubmitting} onChange={(e) => handleChange("category", e.target.value)}>
              <option value="">선택</option>
              <option value="0">{CATEGORY_LABEL[0]}</option>
              <option value="1">{CATEGORY_LABEL[1]}</option>
              <option value="2">{CATEGORY_LABEL[2]}</option>
            </select>
          </div>

          <div className="detailField">
            <label>품목명</label>
            <input className="tableInput" value={form.itemNm} disabled={isSubmitting} onChange={(e) => handleChange("itemNm", e.target.value)} placeholder="예: 사과 통조림" />
          </div>

          <div className="detailField">
            <label>단위</label>
            <input className="tableInput" value={form.unit} disabled={isSubmitting} onChange={(e) => handleChange("unit", e.target.value)} placeholder="예: EA, BOX, KG" />
          </div>

          <div className="detailField">
            <label>규격</label>
            <input className="tableInput" value={form.standard} disabled={isSubmitting} onChange={(e) => handleChange("standard", e.target.value)} placeholder="예: 500g" />
          </div>

          {isRoutingRequired && (
            <div className="routingSection">
              <div className="routingHeader">
                <label className="requiredLabel" style={{ fontWeight: 600 }}>공정 라우팅 설정 <span className="required">*</span></label>
                <button type="button" className="miniButton primary" disabled={isSubmitting} onClick={handleOpenModal}>공정 선택 / 추가</button>
              </div>

              {/* 🌟 키보드 조작 가이드 안내 텍스트 추가 */}
              <div className="routingHint">
                💡 <span>Space</span> 또는 <span>Enter</span>로 공정을 선택(잡기)하고, <span>방향키</span>로 순서를 변경하세요. (<span>Esc</span> 취소)
              </div>

              {routings.length === 0 ? (
                <div className="routingEmptyBox">선택된 공정이 없습니다. [공정 선택 / 추가] 버튼을 눌러주세요.</div>
              ) : (
                <div className="routingGrid" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                  {routings.map((route, index) => {
                    const matchedOp = operations.find((op) => op.operCode === route.operCode);
                    const isDragging = draggingIndex === index;
                    const isTarget = targetIndex === index && draggingIndex !== index;
                    const isKeyboardActive = keyboardActiveIndex === index; 

                    return (
                      <div
                        key={`${route.operCode}-${index}`}
                        ref={(el) => { itemRefs.current[index] = el; }}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isKeyboardActive}
                        className={`routingItem ${isDragging ? "dragging" : ""} ${isTarget ? "dragTarget" : ""} ${isKeyboardActive ? "keyboardActive" : ""}`}
                        onMouseDown={() => {
                          if (!isSubmitting) {
                            handleMouseDown(index);
                            itemRefs.current[index]?.focus(); // 클릭 시 포커스 강제 부여
                          }
                        }}
                        onMouseEnter={() => !isSubmitting && handleMouseEnter(index)}
                        onKeyDown={(e) => {
                          const nextIndex = handleKeyDown(e, index, 2);
                          if (nextIndex !== undefined) {
                             setTimeout(() => itemRefs.current[nextIndex]?.focus(), 0);
                          }
                        }}
                      >
                        <span className="dragHandle" title="Space/Enter로 잡고 방향키로 이동">☰</span>
                        <span className="routingSeq">순서 {route.operSeq}</span>
                        <div className="routingInfo">{route.operCode} {matchedOp ? `(${matchedOp.operNm})` : ""}</div>
                        <select className="tableInput routingSelect" value={route.finalYn ?? "N"} disabled={isSubmitting} onChange={(e) => handleRoutingChange(index, "finalYn", e.target.value)}>
                          <option value="N">일반공정</option>
                          <option value="Y">최종공정</option>
                        </select>
                        <button type="button" className="miniButton danger" disabled={isSubmitting} onClick={() => handleRemoveRouting(index)}>제외</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="pageFormFooter">
            <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>취소</button>
            <button type="submit" className="primaryButton" disabled={isSubmitting}>{isSubmitting ? "등록 중..." : "등록"}</button>
          </div>
        </form>
      </Panel>

      <OperationSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        operations={operations}
        modalSearchKeyword={modalSearchKeyword}
        setModalSearchKeyword={setModalSearchKeyword}
        tempSelectedCodes={tempSelectedCodes}
        setTempSelectedCodes={setTempSelectedCodes}
        onConfirm={handleConfirmModal}
      />
    </section>
  );
}