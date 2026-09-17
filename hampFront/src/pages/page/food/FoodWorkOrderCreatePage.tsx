import { useState, useMemo, useEffect, useRef, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/common/Badge";
import { CusTable } from "@/components/table/CusTable";
import { SalesOrderModal } from "@/components/modal/SalesOrderModal";
import { type SalesOrderStatusLineResponse } from "@/api/sales/SalesOrder";
import { WorkOrderApi } from "@/api/WorkOrder";
import { UserApi, type UserOptionResponse } from "@/api/User";
import '@/pages/page/food/Food.css'; 

interface WorkOrderLine {
  id: string;
  salesOrderLineId: number;
  orderCode: string;
  itemCode: string;
  itemNm: string;
  instructQty: number;
}

export function FoodWorkOrderCreatePage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);

  // 회원 옵션 목록 상태
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([]);

  const [form, setForm] = useState({
    workDate: new Date().toISOString().split('T')[0],
    status: "WAIT", // 영문 상태 코드 ("WAIT" | "PROGRESS" | "DONE" | "DELAY")
    managerId: "",
  });

  const [lines, setLines] = useState<WorkOrderLine[]>([]);

  // --- useRef 기반 지시수량 임시 저장소 (line id를 키로 관리) ---
  const editQuantitiesRef = useRef<Record<string, number | ''>>({});

  // 회원 옵션 데이터 조회
  useEffect(() => {
    const fetchUserOptions = async () => {
      try {
        const res = await UserApi.getOptions();
        if (res && res.data) {
          setUserOptions(res.data);
          if (res.data.length > 0) {
            setForm((prev) => ({ ...prev, managerId: prev.managerId || res.data[0].userId }));
          }
        }
      } catch (error) {
        console.error("회원 옵션 조회 실패:", error);
      }
    };

    fetchUserOptions();
  }, []);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRemoveLine = (id: string) => {
    delete editQuantitiesRef.current[id];
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const handleAddLine = () => {
    const newId = `line-${Date.now()}`;
    // 신규 라인 추가 시 기본 수량 0을 ref에 등록
    editQuantitiesRef.current[newId] = 0;

    const newLine: WorkOrderLine = {
      id: newId,
      salesOrderLineId: 0,
      orderCode: "수주선택 필요",
      itemCode: "선택요망",
      itemNm: "수주라인을 선택해주세요.",
      instructQty: 0,
    };
    setLines((prev) => [...prev, newLine]);
  };

  const handleOpenModal = (lineId: string) => {
    setActiveLineId(lineId);
    setIsModalOpen(true);
  };

  // 모달에서 수주 라인을 선택했을 때 실행되는 핸들러
  const handleSelectSalesOrderLine = (selected: SalesOrderStatusLineResponse) => {
    if (!activeLineId) return;

    const defaultQty = Number(selected.orderQty || 0);
    editQuantitiesRef.current[activeLineId] = defaultQty;

    setLines((prev) =>
      prev.map((line) => {
        if (line.id === activeLineId) {
          return {
            ...line,
            salesOrderLineId: selected.salesOrderLineId,
            orderCode: selected.orderCode,
            itemCode: selected.itemCode,
            itemNm: selected.itemNm,
            instructQty: defaultQty, 
          };
        }
        return line;
      })
    );
  };

  // 작업지시 라인 테이블 컬럼 정의
  const workOrderColumns = useMemo<ColumnDef<WorkOrderLine>[]>(
    () => [
      {
        accessorKey: 'orderCode',
        header: '수주라인',
        meta: { width: '450px' },
        cell: ({ row }) => {
          const line = row.original;
          const isSelected = line.salesOrderLineId > 0;
          return (
            <button
              type="button"
              onClick={() => handleOpenModal(line.id)}
              className="tableInput food-order-select-btn"
            >
              {isSelected ? (
                <div className="food-order-selected-container">
                  <span className="food-order-code-text">{line.orderCode}</span>
                  <Badge tone="info">{line.itemCode}</Badge>
                  <span className="food-item-name-text">{line.itemNm}</span>
                </div>
              ) : (
                <span className="food-order-placeholder-text">클릭하여 수주라인을 선택하세요</span>
              )}
              <span className="food-order-change-text">(변경)</span>
            </button>
          );
        },
      },
      {
        accessorKey: 'instructQty',
        header: '지시수량',
        cell: ({ row }) => {
          const line = row.original;
          return (
            <input
              type="number"
              className="tableInput food-table-input-cell"
              defaultValue={editQuantitiesRef.current[line.id] ?? line.instructQty}
              disabled={isSubmitting}
              onChange={(e) => {
                editQuantitiesRef.current[line.id] = e.target.value === '' ? '' : Number(e.target.value);
              }}
            />
          );
        },
        meta: { width: '150px' },
      },
      {
        id: 'action',
        header: '관리',
        enableSorting: false,
        cell: ({ row }) => {
          const line = row.original;
          return (
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => handleRemoveLine(line.id)}
                disabled={isSubmitting}
                className="food-line-delete-btn"
                title="라인 삭제"
              >
                <TrashIcon className="food-delete-icon" />
              </button>
            </div>
          );
        },
        meta: { width: '60px' },
      },
    ],
    [isSubmitting]
  );

  const validateForm = (): boolean => {
    if (!form.workDate) {
      alert("작업일자를 입력해주세요.");
      return false;
    }
    if (!form.managerId) {
      alert("담당자를 선택해주세요.");
      return false;
    }
    if (lines.length === 0) {
      alert("수주라인을 최소 1개 이상 추가해야 합니다.");
      return false;
    }
    for (const line of lines) {
      if (line.salesOrderLineId === 0) {
        alert("모든 라인에 수주라인을 선택해주셔야 합니다.");
        return false;
      }
      const currentQty = editQuantitiesRef.current[line.id];
      if (currentQty === '' || Number(currentQty) <= 0) {
        alert("지시수량은 0보다 커야 합니다.");
        return false;
      }
    }
    return true;
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // 제출 직전에 ref의 최신 입력값들을 반영
    const finalizedLines = lines.map((l) => ({
      salesOrderLineId: l.salesOrderLineId,
      instructQty: Number(editQuantitiesRef.current[l.id]) || 0,
    }));

    const payload = {
      workDate: form.workDate,
      status: form.status,
      managerId: form.managerId,
      lines: finalizedLines,
    };

    setIsSubmitting(true);
    try {
      await WorkOrderApi.create(payload);
      alert("작업지시가 성공적으로 등록되었습니다.");
      navigate("/food/work-orders");
    } catch (error) {
      console.error("작업지시 등록 실패:", error);
      alert("작업지시 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="screenStack">
      <div className="createCard">
        
        {/* 헤더 영역 */}
        <div className="createHeader">
          <h1 className="createTitle">작업지시 등록</h1>
          <span className="createMeta">
            수주 라인을 지정해 생산에 필요한 작업지시를 생성합니다. <span className="required">* 표시는 필수 입력 항목입니다</span>
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="createBody">
            
            {/* 1. 기본 정보 섹션 */}
            <div className="createSection">
              <h2 className="createSectionTitle">기본정보</h2>
              <div className="createGrid2Cols">
                
                <div className="createField">
                  <label className="requiredLabel">작업지시코드</label>
                  <input className="tableInput" value="(저장 시 자동 채번)" disabled />
                  <span className="createMeta food-create-meta-spacing">
                    등록 시 날짜+일련번호로 자동 채번됩니다.
                  </span>
                </div>

                <div className="createField">
                  <label className="requiredLabel">작업일자 <span className="required">*</span></label>
                  <input
                    type="date"
                    className="tableInput"
                    value={form.workDate}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("workDate", e.target.value)}
                  />
                </div>

                <div className="createField">
                  <label className="requiredLabel">상태</label>
                  <select
                    className="tableInput"
                    value={form.status}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("status", e.target.value)}
                  >
                    <option value="WAIT">대기</option>
                    <option value="PROGRESS">진행중</option>
                    <option value="DONE">완료</option>
                    <option value="DELAY">지연</option>
                  </select>
                </div>

                <div className="createField">
                  <label className="requiredLabel">담당자 <span className="required">*</span></label>
                  <select
                    className="tableInput"
                    value={form.managerId}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("managerId", e.target.value)}
                  >
                    <option value="">담당자 선택</option>
                    {userOptions.map((user) => (
                      <option key={user.userId} value={user.userId}>
                        {user.userNm} ({user.userId})
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* 2. 작업지시 라인 섹션 */}
            <div className="createSection">
              <div className="routing-header-wrapper">
                <label className="requiredLabel routing-header-label">
                  작업지시 라인 <span className="required">*</span>
                </label>
                <div className="routing-header-right">
                  <span className="routing-count-text">총 {lines.length}개 라인</span>
                  <button
                    type="button"
                    className="miniButton primary"
                    disabled={isSubmitting}
                    onClick={handleAddLine}
                  >
                    + 라인 추가
                  </button>
                </div>
              </div>

              <div className="routing-guide-text">
                수주코드·품목코드·품목명으로 검색해서 수주라인을 선택하세요.
              </div>

              <div className="food-table-container-margin">
                <CusTable
                  data={lines}
                  columns={workOrderColumns}
                  noDataMessage="등록된 작업지시 라인이 없습니다. [+ 라인 추가] 버튼을 눌러주세요."
                />
              </div>

            </div>

          </div>

          {/* 하단 버튼 영역 */}
          <div className="createFooter">
            <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>
              취소
            </button>
            <button type="submit" className="primaryButton" disabled={isSubmitting}>
              {isSubmitting ? "등록 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>

      <SalesOrderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveLineId(null);
        }}
        onSelect={handleSelectSalesOrderLine}
      />
    </section>
  );
}