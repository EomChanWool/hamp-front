import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Barcode from "react-barcode";
import '@/components/modal/WorkOrderPrintModal.css';

export interface WorkOrderLineDetail {
    id: string;
    salesOrderLineId: number;
    orderCode: string;
    lineId: string;
    itemCode: string;
    itemNm: string;
    instructQty: number;
    barcode: string;
    unit?: string;
}

export type WorkOrderStatus =
    | "WAIT"
    | "PROGRESS"
    | "DONE"
    | "DELAY";

export interface WorkOrderMaster {
    workOrderNo: string;
    title: string;
    workDate: string;
    status: WorkOrderStatus;
    managerId: string;
    managerNm: string;
    lines: WorkOrderLineDetail[];
}

interface WorkOrderPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedLines: WorkOrderLineDetail[];
    workOrder: WorkOrderMaster;
}

const getStatusText = (status: WorkOrderStatus) => {
    switch (status) {
        case "DONE":
            return "완료";
        case "PROGRESS":
            return "진행중";
        case "DELAY":
            return "지연";
        default:
            return "대기";
    }
};

const formatPrintDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export function WorkOrderPrintModal({
    isOpen,
    onClose,
    selectedLines,
    workOrder,
}: WorkOrderPrintModalProps) {
    const [printDateTime, setPrintDateTime] = useState("");

    useEffect(() => {
        if (!isOpen) return;

        setPrintDateTime(formatPrintDateTime(new Date()));
    }, [isOpen]);

    if (!isOpen) return null;

    const modal = (
        <div
            id="work-order-print-root"
            className="work-order-print-root"
        >
            <div className="work-order-print-modal">

                {/* =========================================
            A4와 같은 폭의 상단 툴바
        ========================================== */}
                <div className="work-order-print-frame">

                    <div className="work-order-print-toolbar no-print">
                        <div className="work-order-print-toolbar-info">
                            <h2>작업지시서 인쇄</h2>
                            <p>
                                선택한 작업지시 라인을 포함하여 A4 규격으로
                                출력합니다.
                            </p>
                        </div>

                        <div className="work-order-print-toolbar-actions">
                            <button
                                type="button"
                                className="ghostButton"
                                onClick={onClose}
                            >
                                닫기
                            </button>

                            <button
                                type="button"
                                className="primaryButton"
                                onClick={() => window.print()}
                            >
                                인쇄하기 / PDF 저장
                            </button>
                        </div>
                    </div>

                    {/* =========================================
              미리보기 스크롤 영역
          ========================================== */}
                    <div className="work-order-print-scroll">

                        {/* =====================================
                A4 Sheet
            ====================================== */}
                        {selectedLines.map((line, index) => (
                            <div
                                className="work-order-print-sheet"
                                key={line.id}
                            >

                                {/* Header */}
                                <div className="work-order-print-header">
                                    <div>
                                        <span className="work-order-print-department">
                                            식품제조 1동
                                        </span>

                                        <h1>작 업 지 시 서</h1>

                                        <p>
                                            Work Order Sheet - Food Production Division
                                        </p>
                                    </div>

                                    <div className="work-order-print-header-right">
                                        <div className="work-order-document-barcode">
                                            <Barcode
                                                value={
                                                    line.barcode ||
                                                    "NO-BARCODE"
                                                }
                                                width={1.5}
                                                height={42}
                                                fontSize={11}
                                                displayValue={true}
                                                margin={0}
                                            />
                                        </div>

                                        <div className="work-order-print-meta">
                                            <div>
                                                <strong>작업일자:</strong>{" "}
                                                {workOrder.workDate || "-"}
                                            </div>

                                            <div>
                                                <strong>출력일시:</strong>{" "}
                                                {printDateTime || "-"}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 작업지시 정보 */}
                                <section className="work-order-print-section">
                                    <h3 className="work-order-print-section-title">
                                        <span />
                                        작업지시 정보
                                    </h3>

                                    <table className="work-order-print-table">
                                        <tbody>
                                            <tr>
                                                <th>작업지시번호</th>
                                                <td className="mono">
                                                    {workOrder.workOrderNo || "-"}
                                                </td>
                                                <th>작업일자</th>
                                                <td>
                                                    {workOrder.workDate || "-"}
                                                </td>
                                            </tr>

                                            <tr>
                                                <th>상태</th>
                                                <td>
                                                    {getStatusText(workOrder.status)}
                                                </td>
                                                <th>담당자</th>
                                                <td>
                                                    {workOrder.managerNm
                                                        ? `${workOrder.managerNm} (${workOrder.managerId})`
                                                        : workOrder.managerId || "-"}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </section>

                                {/* 작업지시 라인 */}
                                <section className="work-order-print-section">
                                    <h3 className="work-order-print-section-title">
                                        <span />
                                        작업지시 품목 및 생산 정보
                                    </h3>

                                    <table className="work-order-print-table line-table">
                                        <thead>
                                            <tr>
                                                <th className="col-no">순번</th>
                                                <th className="col-order">연결 수주</th>
                                                <th className="col-item-code">
                                                    품명
                                                </th>
                                                <th className="col-qty">
                                                    지시수량
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            <tr key={line.id}>
                                                <td className="text-center">
                                                    {index + 1}
                                                </td>

                                                <td>
                                                    <div className="order-code">
                                                        {line.orderCode || "-"}
                                                    </div>

                                                    <div className="order-line">
                                                        {line.lineId || "-"}
                                                    </div>
                                                </td>
                                                <td className="item-name">
                                                    {line.itemNm || "-"}
                                                </td>

                                                <td className="qty">
                                                    {(
                                                        line.instructQty ?? 0
                                                    ).toLocaleString()}
                                                    {line.unit
                                                        ? ` ${line.unit}`
                                                        : ""}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </section>

                                {/* 체크리스트 */}
                                <section className="work-order-print-section">
                                    <h3 className="work-order-print-section-title">
                                        <span />
                                        공정 순서 확인
                                    </h3>

                                    <table className="work-order-print-table checklist-table">
                                        <thead>
                                            <tr>
                                                <th className="col-check-no">
                                                    순서
                                                </th>
                                                <th>확인 항목</th>
                                                <th className="col-check-result">
                                                    확인
                                                </th>
                                                <th>비고</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {[
                                                "공정1 상태",
                                                "공정2 상태",
                                                "공정3 상태",
                                                "공정4 상태",
                                            ].map((item, index) => (
                                                <tr key={item}>
                                                    <td className="text-center">
                                                        {index + 1}
                                                    </td>

                                                    <td>{item}</td>

                                                    <td className="checkbox-cell">
                                                        <span className="print-checkbox" />
                                                    </td>

                                                    <td />
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </section>

                                {/* 특이사항 */}
                                <section className="work-order-print-notice">
                                    <strong>
                                        ⚠ 현장 특이사항 및 주의사항
                                    </strong>

                                    <div className="work-order-print-notice-body">
                                        작업 중 품목, 수량, 바코드 정보에 이상이 있는
                                        경우 담당자에게 즉시 보고하십시오.
                                        <br />
                                        작업 완료 후 생산수량과 작업지시 수량을
                                        확인하십시오.
                                    </div>
                                </section>

                                {/* 서명 */}
                                <section className="work-order-print-sign-area">
                                    <div className="work-order-sign-box">
                                        <div className="work-order-sign-title">
                                            작 성 자
                                        </div>

                                        <div className="work-order-sign-row">
                                            <span>담당:</span>

                                            <strong>
                                                {workOrder.managerNm ||
                                                    workOrder.managerId ||
                                                    "-"}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="work-order-sign-box">
                                        <div className="work-order-sign-title">
                                            공 정 처 리 자
                                        </div>

                                        <div className="work-order-sign-row">
                                            <span>확인:</span>

                                            <span className="signature-space" />
                                        </div>
                                    </div>

                                    <div className="work-order-sign-box">
                                        <div className="work-order-sign-title">
                                            품 질 승 인 자
                                        </div>

                                        <div className="work-order-sign-row">
                                            <span>승인:</span>

                                            <span className="signature-space" />
                                        </div>
                                    </div>
                                </section>

                                <div className="work-order-print-footer">
                                    HEMP 식품 MES 시스템 ©
                                    FOODTECH MANUFACTURING DIVISION
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}