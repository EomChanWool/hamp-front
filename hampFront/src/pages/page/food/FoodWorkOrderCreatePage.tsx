import { useState, useMemo, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/common/Badge";
import { CusTable } from "@/components/table/CusTable";
import { SalesOrderModal } from "@/components/modal/SalesOrderModal";
import { type SalesOrderStatusLineResponse } from "@/api/sales/SalesOrder";
import '@/pages/page/master/MasterItem.css'; 

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

  const [form, setForm] = useState({
    workDate: new Date().toISOString().split('T')[0],
    status: "대기",
    managerId: "김도현",
  });

  const [lines, setLines] = useState<WorkOrderLine[]>([
    {
      id: "line-1",
      salesOrderLineId: 4,
      orderCode: "SO-2026-0918",
      itemCode: "ITEM-004",
      itemNm: "헴프 오일 반제품",
      instructQty: 100,
    },
  ]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleQtyChange = (id: string, qty: number) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, instructQty: qty } : line))
    );
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length === 1) {
      alert("최소 1개 이상의 작업지시 라인이 필요합니다.");
      return;
    }
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const handleAddLine = () => {
    const newLine: WorkOrderLine = {
      id: `line-${Date.now()}`,
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

  // 모달에서 '선택' 버튼을 누르거나 행을 클릭했을 때 실행되는 핸들러
  const handleSelectSalesOrderLine = (selected: SalesOrderStatusLineResponse) => {
    if (!activeLineId) return;

    setLines((prev) =>
      prev.map((line) => {
        if (line.id === activeLineId) {
          return {
            ...line,
            salesOrderLineId: selected.salesOrderLineId,
            orderCode: selected.orderCode,
            itemCode: selected.itemCode,
            itemNm: selected.itemNm,
            instructQty: selected.orderQty, // 기본값으로 주문수량 연동 또는 0 처리 가능
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
          return (
            <button
              type="button"
              onClick={() => handleOpenModal(line.id)}
              className="tableInput"
              style={{ 
                cursor: 'pointer', 
                textAlign: 'left', 
                background: 'var(--bg-input, #fff)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                width: '100%',
                padding: '8px 12px',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                <span style={{ fontWeight: 600, color: 'var(--primary-color, #2563eb)' }}>{line.orderCode}</span>
                <Badge tone="info">{line.itemCode}</Badge>
                <span style={{ color: 'var(--text-main, #374151)' }}>{line.itemNm}</span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-sub, #6b7280)', whiteSpace: 'nowrap' }}>(변경)</span>
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
              className="tableInput"
              value={line.instructQty}
              disabled={isSubmitting}
              onChange={(e) => handleQtyChange(line.id, Number(e.target.value))}
              style={{ padding: '8px 12px', boxSizing: 'border-box', width: '100%' }}
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
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                title="라인 삭제"
              >
                <TrashIcon style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          );
        },
        meta: { width: '60px' },
      },
    ],
    [isSubmitting, lines]
  );

  const validateForm = (): boolean => {
    if (!form.workDate) {
      alert("작업일자를 입력해주세요.");
      return false;
    }
    if (lines.length === 0) {
      alert("수주라인을 최소 1개 이상 선택해야 합니다.");
      return false;
    }
    for (const line of lines) {
      if (line.salesOrderLineId === 0) {
        alert("모든 라인에 수주라인을 선택해주셔야 합니다.");
        return false;
      }
      if (line.instructQty <= 0) {
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

    const payload = {
      workDate: form.workDate,
      status: form.status,
      managerId: form.managerId,
      lines: lines.map((l) => ({
        salesOrderLineId: l.salesOrderLineId,
        instructQty: l.instructQty,
      })),
    };

    setIsSubmitting(true);
    try {
      console.log("전송할 Payload:", payload);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      alert("작업지시가 성공적으로 등록되었습니다. (Mock)");
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
                  <span className="createMeta" style={{ marginTop: '4px', display: 'block' }}>
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
                    <option value="대기">대기</option>
                    <option value="진행중">진행중</option>
                    <option value="완료">완료</option>
                    <option value="지연">지연</option>
                  </select>
                </div>

                <div className="createField">
                  <label className="requiredLabel">담당자</label>
                  <select
                    className="tableInput"
                    value={form.managerId}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("managerId", e.target.value)}
                  >
                    <option value="김도현">김도현</option>
                    <option value="박서연">박서연</option>
                    <option value="전지윤">전지윤</option>
                    <option value="이하늘">이하늘</option>
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

              {/* CusTable 컴포넌트 적용 */}
              <div style={{ marginTop: '12px' }}>
                <CusTable
                  data={lines}
                  columns={workOrderColumns}
                  noDataMessage="등록된 작업지시 라인이 없습니다."
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