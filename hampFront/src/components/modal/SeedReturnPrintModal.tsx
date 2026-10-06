/**
 * 씨드 신고반납 확인서 인쇄 모달 (테스트용 기본 양식)
 *
 * - 방식: 브라우저 인쇄(window.print) -> 프린터 출력 또는 "PDF로 저장"
 * - 구조: WorkOrderPrintModal 과 동일
 *     1) 화면용 미리보기(.return-print-modal)  : 인쇄 시 숨김
 *     2) 인쇄 전용 영역(.return-print-pages)   : 화면에서는 숨김, 인쇄할 때만 표시
 *   (fixed / overflow 구조 때문에 인쇄가 잘리는 문제를 피하려고 문서를 두 번 렌더링한다)
 * - 업체 양식(워드/엑셀)이 확정되면 이 파일의 renderSheet 안쪽만 바꾸거나,
 *   seedReturnPrintData.ts 의 flattenForTemplate 을 이용해 서버에서 파일을 생성하는 방식으로 전환.
 */
import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { SeedGoodsReceiptReturnItemResponse } from '@/api/seed/SeedGoodsReceiptReturn';
import { buildSeedReturnPrintData } from '@/components/modal/SeedReturnPrintData';
import '@/components/modal/SeedReturnPrintModal.css';

interface SeedReturnPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 출력할 신고반납 건들 (신고완료 건만 넘길 것). 지금은 1건, 나중에 여러 건 선택 출력도 가능 */
  items: SeedGoodsReceiptReturnItemResponse[];
}

export function SeedReturnPrintModal({ isOpen, onClose, items }: SeedReturnPrintModalProps) {
  // 출력용 데이터 변환 (Hook 이므로 early return 보다 위에 둔다)
  // items 가 바뀔 때만 다시 만들어서 "출력일시" 가 렌더마다 바뀌지 않게 한다.
  const data = useMemo(() => buildSeedReturnPrintData(items), [items]);

  if (!isOpen || items.length === 0) return null;

  /**
   * 문서 한 장을 만드는 함수
   * 화면 미리보기와 실제 인쇄 영역에서 같은 문서를 재사용한다.
   */
  const renderSheet = () => (
    <div className="return-print-sheet">
      {/* ---------- 헤더 ---------- */}
      <div className="return-print-header">
        <div>
          <h1>씨드 신고반납 확인서</h1>
          <p>Seed Goods Receipt Return Report</p>
        </div>
        <div className="return-print-meta">
          <div>
            <strong>문서번호:</strong> {data.docNo}
          </div>
          <div>
            <strong>출력일시:</strong> {data.printedAt}
          </div>
        </div>
      </div>

      {/* ---------- 신고반납 내역 표 ---------- */}
      <section className="return-print-section">
        <h3>신고반납 내역</h3>
        <table className="return-print-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>순번</th>
              <th style={{ width: 70 }}>신고ID</th>
              <th>품목</th>
              <th style={{ width: 90 }}>신고일자</th>
              <th style={{ width: 90 }}>처리예정일</th>
              <th style={{ width: 70 }}>처리상태</th>
              <th style={{ width: 70 }}>수량</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.returnId}>
                <td className="center">{row.no}</td>
                <td className="center">{row.returnId}</td>
                <td>
                  {row.itemNm} <span className="code">({row.itemCode})</span>
                </td>
                <td className="center">{row.reportDate}</td>
                <td className="center">{row.returnDueDate}</td>
                <td className="center">{row.statusText}</td>
                <td className="right">{row.returnQty.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={6}>합계</th>
              <td className="right bold">{data.totalQty.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* ---------- 서명란 ---------- */}
      <section className="return-print-sign-area">
        {['담 당 자', '검 수 자', '승 인 자'].map((title) => (
          <div className="return-print-sign-box" key={title}>
            <div className="return-print-sign-title">{title}</div>
            <div className="return-print-sign-space" />
          </div>
        ))}
      </section>

      {/* ---------- 푸터 ---------- */}
      <div className="return-print-footer">HEMP 씨드 MES 시스템 ©</div>
    </div>
  );

  /** 인쇄 실행: 인쇄창/PDF 저장 시 파일명이 되도록 document.title 을 잠깐 바꿨다가 복원 */
  const handlePrint = () => {
    window.focus();

    const originalTitle = document.title;
    document.title = `씨드신고반납_${data.docNo.replace(/\s/g, '')}`;

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);

    window.print();
  };

  const modal = (
    // id="return-print-root" 는 인쇄 CSS 의 "다른 화면 숨김" 예외 처리에 쓰이므로 이름을 바꾸면 안 된다.
    <div id="return-print-root" className="return-print-root">
      {/* 화면용 모달 (인쇄 시 숨김) */}
      <div className="return-print-modal">
        <div className="return-print-frame">
          <div className="return-print-toolbar">
            <h2>신고반납 확인서 인쇄</h2>
            <div className="return-print-toolbar-actions">
              <button type="button" className="ghostButton" onClick={onClose}>
                닫기
              </button>
              <button type="button" className="primaryButton" onClick={handlePrint}>
                인쇄하기 / PDF 저장
              </button>
            </div>
          </div>
          <div className="return-print-scroll">{renderSheet()}</div>
        </div>
      </div>

      {/* 실제 인쇄 전용 영역 (화면에서는 숨김) */}
      <div className="return-print-pages">{renderSheet()}</div>
    </div>
  );

  // body 직계로 렌더링해야 인쇄 CSS(body > *:not(...))가 정상 동작한다.
  return createPortal(modal, document.body);
}
