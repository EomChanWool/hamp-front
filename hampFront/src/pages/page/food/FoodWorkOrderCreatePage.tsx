import { useState, useMemo, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/common/Badge";
import { CusTable } from "@/components/table/CusTable";
import '@/pages/page/master/MasterItem.css'; 

interface WorkOrderLine {
  id: string;
  salesOrderLineId: number;
  orderCode: string;
  itemCode: string;
  itemNm: string;
  instructQty: number;
}

// ==========================================
// 1. 수주라인 선택 모달 컴포넌트
// ==========================================
interface SalesOrderLineItem {
  id: string;
  orderCode: string;
  customer: string;
  dueDate: string;
  itemName: string;
  orderQty: number;
  remainQty: number;
  unit: string;
  isClosed: boolean;
}

interface SalesOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (line: SalesOrderLineItem) => void;
}

const dummySalesOrderLines: SalesOrderLineItem[] = [
  { id: '1', orderCode: 'SO-2026-0912', customer: '그린테라 농협', dueDate: '2026-09-20', itemName: '헴프 원료(건조)', orderQty: 800, remainQty: 120, unit: 'KG', isClosed: false },
  { id: '2', orderCode: 'SO-2026-0912', customer: '그린테라 농협', dueDate: '2026-09-20', itemName: 'CBD 오일 원료', orderQty: 150, remainQty: 30, unit: 'KG', isClosed: false },
  { id: '3', orderCode: 'SO-2026-0915', customer: '네이처바이오', dueDate: '2026-09-25', itemName: 'CBD 아이솔레이트 반제품', orderQty: 65, remainQty: 0, unit: 'KG', isClosed: true },
  { id: '4', orderCode: 'SO-2026-0918', customer: '헴프코리아', dueDate: '2026-09-28', itemName: '헴프 오일 반제품', orderQty: 300, remainQty: 50, unit: 'L', isClosed: false },
  { id: '5', orderCode: 'SO-2026-0918', customer: '헴프코리아', dueDate: '2026-09-28', itemName: 'CBD 오일 30ml', orderQty: 5000, remainQty: 500, unit: 'EA', isClosed: false },
  { id: '6', orderCode: 'SO-2026-0921', customer: '오가닉웰니스', dueDate: '2026-10-02', itemName: '헴프 그래놀 완제품', orderQty: 1200, remainQty: 300, unit: 'KG', isClosed: false },
  { id: '7', orderCode: 'SO-2026-0921', customer: '오가닉웰니스', dueDate: '2026-10-02', itemName: 'CBDA 캡슐 완제품', orderQty: 8000, remainQty: 800, unit: 'EA', isClosed: false },
  { id: '8', orderCode: 'SO-2026-0925', customer: '그린테라 농협', dueDate: '2026-10-05', itemName: '헴프 원료(건조)', orderQty: 1000, remainQty: 360, unit: 'KG', isClosed: false },
];

function SalesOrderModal({ isOpen, onClose, onSelect }: SalesOrderModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLines = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return dummySalesOrderLines;
    return dummySalesOrderLines.filter(
      (item) =>
        item.orderCode.toLowerCase().includes(term) ||
        item.customer.toLowerCase().includes(term) ||
        item.itemName.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const modalColumns = useMemo<ColumnDef<SalesOrderLineItem>[]>(
    () => [
      { accessorKey: 'orderCode', header: '수주코드', cell: ({ row }) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{row.original.orderCode}</span> },
      { accessorKey: 'customer', header: '거래처' },
      { accessorKey: 'dueDate', header: '납기일' },
      { accessorKey: 'itemName', header: '품목', cell: ({ row }) => <span style={{ fontWeight: 500 }}>{row.original.itemName}</span> },
      { 
        accessorKey: 'orderQty', 
        header: '주문수량', 
        cell: ({ row }) => <div style={{ textAlign: 'right' }}>{row.original.orderQty.toLocaleString()} {row.original.unit}</div> 
      },
      { 
        accessorKey: 'remainQty', 
        header: '잔여수량', 
        cell: ({ row }) => (
          <div style={{ textAlign: 'right', fontWeight: 600 }}>
            {row.original.isClosed ? <Badge tone="danger">마감</Badge> : `${row.original.remainQty.toLocaleString()} ${row.original.unit}`}
          </div>
        ) 
      },
      {
        id: 'action',
        header: '관리',
        enableSorting: false,
        cell: ({ row }) => (
          <div style={{ textAlign: 'center' }}>
            {!row.original.isClosed ? (
              <button
                type="button"
                style={modalStyles.selectButton}
                onClick={() => { onSelect(row.original); onClose(); }}
              >
                선택
              </button>
            ) : (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
            )}
          </div>
        ),
        meta: { width: '80px' },
      },
    ],
    [onSelect, onClose]
  );

  if (!isOpen) return null;

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.container}>
        <div style={modalStyles.header}>
          <div>
            <h2 style={modalStyles.title}>수주라인 선택</h2>
            <p style={modalStyles.subtitle}>수주코드·거래처·품목명으로 검색할 수 있어요. 잔여수량이 없는 라인은 선택할 수 없습니다.</p>
          </div>
          <button type="button" onClick={onClose} style={modalStyles.closeButton}>✕</button>
        </div>

        <div style={modalStyles.searchWrapper}>
          <input
            type="text"
            placeholder="예: SO-2026-0918, 헴프코리아, CBD 오일"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={modalStyles.searchInput}
          />
        </div>

        <div style={modalStyles.tableContainer}>
          <CusTable
            data={filteredLines}
            columns={modalColumns}
            noDataMessage="검색 결과가 없습니다."
            onRowClick={(row) => {
              if (!row.isClosed) {
                onSelect(row);
                onClose();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}


// ==========================================
// 2. 메인 페이지 컴포넌트
// ==========================================
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
      salesOrderLineId: 101,
      orderCode: "SO-2026-0918",
      itemCode: "ITM-OIL-01",
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

  const handleSelectSalesOrderLine = (selected: SalesOrderLineItem) => {
    if (!activeLineId) return;

    setLines((prev) =>
      prev.map((line) => {
        if (line.id === activeLineId) {
          return {
            ...line,
            salesOrderLineId: Number(selected.id),
            orderCode: selected.orderCode,
            itemCode: `ITM-${selected.id}`,
            itemNm: selected.itemName,
            instructQty: selected.remainQty,
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
        meta: { width: '400px' },
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

            {/* 2. 작업지시 라인 섹션 (CusTable 적용) */}
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
                수주코드·거래처·품목으로 검색해서 수주라인을 선택하세요.
              </div>

              {/* CusTable 컴포넌트를 통한 일관된 테이블 렌더링 */}
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

      {/* 수주라인 선택 모달 연결 */}
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

const modalStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  container: {
    backgroundColor: '#ffffff', width: '900px', maxWidth: '95vw', maxHeight: '85vh',
    borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    padding: '20px 24px 16px 24px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9',
  },
  title: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' },
  subtitle: { margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' },
  closeButton: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b', padding: '4px' },
  searchWrapper: { padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' },
  searchInput: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' },
  tableContainer: { padding: '16px 24px 24px 24px', overflowY: 'auto', maxHeight: '500px' },
  selectButton: { padding: '4px 12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' },
};