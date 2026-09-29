import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Barcode from "react-barcode";
import "@/components/modal/WorkOrderPrintModal.css";

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

    /*
     * 실제 작업지시서 한 장을 만드는 함수
     *
     * 화면 미리보기와 실제 인쇄 영역에서
     * 동일한 문서를 재사용한다.
     */
    const renderSheet = (
        lines: WorkOrderLineDetail[]
    ) => (
        <div
            className="work-order-print-sheet"
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

            {/* 작업지시 품목 */}
            <section className="work-order-print-section">
                <h3 className="work-order-print-section-title">
                    <span />
                    작업지시 품목 및 생산 정보
                </h3>

                <div className="work-order-item-list">
                    {lines.map((line, index) => (
                        <div
                            className="work-order-item-block"
                            key={line.id}
                        >
                            {/* 품목 정보 */}
                            <table className="work-order-print-table line-table">
                                <thead>
                                    <tr>
                                        <th className="col-no">
                                            순번
                                        </th>

                                        <th className="col-order">
                                            연결 수주
                                        </th>

                                        <th className="col-item-code">
                                            품명
                                        </th>

                                        <th className="col-qty">
                                            지시수량
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <tr>
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
                                            <span className="item-code">
                                                ({line.itemCode || "-"})
                                            </span>
                                        </td>

                                        <td className="qty">
                                            {(line.instructQty ?? 0).toLocaleString()}
                                            {line.unit
                                                ? ` ${line.unit}`
                                                : ""}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* 품목별 바코드 */}
                            <div className="work-order-item-barcode">
                                <Barcode
                                    value={line.barcode || "NO-BARCODE"}
                                    width={1.5}
                                    height={42}
                                    fontSize={11}
                                    displayValue={true}
                                    margin={0}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 주의사항 */}
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
                        담 당 자
                    </div>

                    <div className="work-order-sign-row">
                        <span>성명:</span>

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

            {/* Footer */}
            <div className="work-order-print-footer">
                HEMP 식품 MES 시스템 ©
                FOODTECH MANUFACTURING DIVISION
            </div>
        </div>
    );

    const modal = (
        <div
            id="work-order-print-root"
            className="work-order-print-root"
        >
            {/* =====================================================
                화면용 모달
            ===================================================== */}
            <div className="work-order-print-modal no-print">
                <div className="work-order-print-frame">

                    <div className="work-order-print-toolbar">
                        <div className="work-order-print-toolbar-info">
                            <h2>
                                작업지시서 인쇄
                            </h2>

                            <p>
                                선택한 작업지시 라인을 포함하여
                                A4 규격으로 출력합니다.
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
                                onClick={() => {
                                    window.focus();

                                    const originalTitle = document.title;

                                    const WorkDate = workOrder.workDate.replace(/-/g, "");
                                    document.title = `작업지시서_${WorkDate}_${workOrder.workOrderNo}`;

                                    const restoreTitle = () => {
                                        document.title = originalTitle;
                                        window.removeEventListener("afterprint", restoreTitle);
                                    }

                                    window.addEventListener("afterprint", restoreTitle);

                                    window.print();
                                }}
                            >
                                인쇄하기 / PDF 저장
                            </button>
                        </div>
                    </div>

                    <div className="work-order-print-scroll">
                        {renderSheet(selectedLines)}
                    </div>

                </div>
            </div>

            {/* =====================================================
                실제 인쇄 전용 영역

                화면에서는 숨기고
                인쇄할 때만 표시한다.

                fixed / flex / overflow 구조와 완전히 분리된다.
            ===================================================== */}
            <div className="work-order-print-pages">
                {renderSheet(selectedLines)}
            </div>
        </div>
    );

    return createPortal(
        modal,
        document.body
    );
}