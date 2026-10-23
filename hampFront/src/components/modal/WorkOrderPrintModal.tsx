import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import "@/components/modal/WorkOrderPrintModal.css";
import type { WorkOrderRoutingStepResponse } from "@/api/WorkOrder";

export interface WorkOrderLineDetail {
    id: string;
    salesOrderLineId: number;
    orderCode: string;
    lineId: string;
    bpCode?: string;
    bpNm?: string;
    dueDate?: string;
    itemCode: string;
    itemNm: string;
    instructQty: number;
    barcode: string;
    unit?: string;
    routingSteps?: WorkOrderRoutingStepResponse[];
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
    includeRouting?: boolean;
}

/* =========================================================
   인쇄 레이아웃 설정
   - LINES_PER_PAGE : A4 한 장에 들어갈 품목 수
   - QR_SIZE        : QR코드 한 변 길이(px) / 60px ≈ 16mm
   - BARCODE_HEIGHT : 바코드 막대 높이(px)
========================================================= */
const LINES_PER_PAGE = 5;
const QR_SIZE = 60;
const BARCODE_HEIGHT = 26;

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

// 품목을 페이지 단위로 분할 (품목이 0개여도 빈 페이지 1장은 만든다)
const chunkLines = (lines: WorkOrderLineDetail[]) => {
    if (lines.length === 0) return [[] as WorkOrderLineDetail[]];

    const pages: WorkOrderLineDetail[][] = [];

    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
        pages.push(lines.slice(i, i + LINES_PER_PAGE));
    }

    return pages;
};

export function WorkOrderPrintModal({
    isOpen,
    onClose,
    selectedLines,
    workOrder,
    includeRouting = false,
}: WorkOrderPrintModalProps) {
    const [printDateTime, setPrintDateTime] = useState("");

    // 모달이 열릴 때마다 출력일시를 현재 시각으로 갱신
    useEffect(() => {
        if (!isOpen) return;

        setPrintDateTime(formatPrintDateTime(new Date()));
    }, [isOpen]);

    if (!isOpen) return null;

    /*
     * 작업지시서를 페이지 단위(LINES_PER_PAGE개)로 나누어 렌더링한다.
     *  - 페이지마다: 헤더 / 작업지시 정보 / 품목 표 / 푸터
     *  - 마지막 페이지에만: 주의사항 / 서명란
     *  - 품목 1개 = 정보 + 바코드 + QR 한 줄 (+ 공정순서 한 줄)
     */
    const renderSheets = (lines: WorkOrderLineDetail[]) => {
        const pages = chunkLines(lines);

        return pages.map((pageLines, pageIdx) => {
            const isLastPage = pageIdx === pages.length - 1;
            const startIndex = pageIdx * LINES_PER_PAGE;

            return (
                <div className="work-order-print-sheet" key={pageIdx}>
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
                                    <strong>출력일시:</strong>{" "}
                                    {printDateTime || "-"}
                                </div>

                                <div>
                                    <strong>페이지:</strong>{" "}
                                    {pageIdx + 1} / {pages.length}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 작업지시 정보 (8열 1행) */}
                    <section className="work-order-print-section">
                        <h3 className="work-order-print-section-title">
                            <span />
                            작업지시 정보
                        </h3>

                        <table className="work-order-print-table info-table">
                            <tbody>
                                <tr>
                                    <th>작업지시번호</th>
                                    <td className="mono">
                                        {workOrder.workOrderNo || "-"}
                                    </td>

                                    <th>작업일자</th>
                                    <td>{workOrder.workDate || "-"}</td>

                                    <th>상태</th>
                                    <td>{getStatusText(workOrder.status)}</td>

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

                    {/* 작업지시 품목: 정보 + 바코드 + QR */}
                    <section className="work-order-print-section">
                        <h3 className="work-order-print-section-title">
                            <span />
                            작업지시 품목 및 생산 정보
                        </h3>

                        <table className="work-order-print-table work-order-line-table">
                            <thead>
                                <tr>
                                    <th className="col-no">순번</th>
                                    <th className="col-item">품명 / 거래처</th>
                                    <th className="col-qty">지시수량</th>
                                    <th className="col-due">납기일자</th>
                                    <th className="col-barcode">바코드</th>
                                    <th className="col-qr">QR</th>
                                </tr>
                            </thead>

                            {pageLines.length === 0 && (
                                <tbody>
                                    <tr>
                                        <td colSpan={6} className="empty-row">
                                            선택된 작업지시 품목이 없습니다.
                                        </td>
                                    </tr>
                                </tbody>
                            )}

                            {pageLines.map((line, index) => {
                                // 공정순서 정렬 (원본 배열 훼손 방지)
                                const steps = [...(line.routingSteps ?? [])].sort(
                                    (a, b) => a.operSeq - b.operSeq
                                );

                                // 바코드와 QR 에 같은 값을 사용
                                const codeValue = line.barcode || "NO-BARCODE";

                                return (
                                    <tbody className="line-group" key={line.id}>
                                        <tr>
                                            <td className="text-center">
                                                {startIndex + index + 1}
                                            </td>

                                            <td className="item-cell">
                                                <div className="item-name">
                                                    {line.itemNm || "-"}
                                                    <span className="item-code">
                                                        ({line.itemCode || "-"})
                                                    </span>
                                                </div>

                                                <div className="bp-line">
                                                    {line.bpNm || "-"}
                                                    <span className="bp-code">
                                                        ({line.bpCode || "-"})
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="qty">
                                                {(line.instructQty ?? 0).toLocaleString()}
                                                {line.unit ? ` ${line.unit}` : ""}
                                            </td>

                                            <td className="text-center">
                                                {line.dueDate || "-"}
                                            </td>

                                            {/* 바코드 */}
                                            <td className="code-cell barcode-cell">
                                                <Barcode
                                                    value={codeValue}
                                                    width={1.3}
                                                    height={BARCODE_HEIGHT}
                                                    fontSize={9}
                                                    displayValue={true}
                                                    margin={0}
                                                    background="#ffffff"
                                                    lineColor="#000000"
                                                />
                                            </td>

                                            {/* QR 코드 */}
                                            <td className="code-cell qr-cell">
                                                <QRCode
                                                    value={codeValue}
                                                    size={QR_SIZE}
                                                    level="M"
                                                    bgColor="#ffffff"
                                                    fgColor="#000000"
                                                />
                                            </td>
                                        </tr>

                                        {/* 공정순서: 포함 인쇄일 때만 표시 (가로 칩) */}
                                        {includeRouting && steps.length > 0 && (
                                            <tr className="routing-row">
                                                <td colSpan={6}>
                                                    <div className="work-order-print-routing">
                                                        <span className="work-order-print-routing-label">
                                                            공정순서
                                                        </span>

                                                        {steps.map((step) => (
                                                            <span
                                                                key={`${step.operCode}-${step.operSeq}`}
                                                                className="work-order-print-routing-step"
                                                            >
                                                                <strong>
                                                                    {String(step.operSeq).padStart(2, "0")}
                                                                </strong>

                                                                <span className="work-order-print-routing-step-name">
                                                                    {step.operNm}
                                                                </span>

                                                                <span className="work-order-print-routing-step-detail">
                                                                    {step.operCode}
                                                                    {step.equipments?.length
                                                                        ? ` · ${step.equipments
                                                                            .map((eq) => eq.eqNm)
                                                                            .join(", ")}`
                                                                        : ""}
                                                                </span>

                                                                <span
                                                                    className={`work-order-print-routing-tag ${
                                                                        step.finalYn === "N"
                                                                            ? "is-normal"
                                                                            : "is-final"
                                                                    }`}
                                                                >
                                                                    {step.finalYn === "N" ? "일반" : "최종"}
                                                                </span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                );
                            })}
                        </table>
                    </section>

                    {/* 주의사항 + 서명: 마지막 페이지에만 표시 */}
                    {isLastPage && (
                        <>
                            <section className="work-order-print-notice">
                                <strong>⚠ 현장 특이사항 및 주의사항</strong>

                                <div className="work-order-print-notice-body">
                                    품목·수량·바코드 정보에 이상이 있으면 담당자에게 즉시 보고하고,
                                    작업 완료 후 생산수량과 지시수량을 확인하십시오.
                                </div>
                            </section>

                            <section className="work-order-print-sign-area">
                                <div className="work-order-sign-box">
                                    <div className="work-order-sign-title">담 당 자</div>

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
                                    <div className="work-order-sign-title">공 정 처 리 자</div>

                                    <div className="work-order-sign-row">
                                        <span>확인:</span>
                                        <span className="signature-space" />
                                    </div>
                                </div>

                                <div className="work-order-sign-box">
                                    <div className="work-order-sign-title">품 질 승 인 자</div>

                                    <div className="work-order-sign-row">
                                        <span>승인:</span>
                                        <span className="signature-space" />
                                    </div>
                                </div>
                            </section>
                        </>
                    )}

                    {/* Footer */}
                    <div className="work-order-print-footer">
                        HEMP 식품 MES 시스템 © FOODTECH MANUFACTURING DIVISION
                    </div>
                </div>
            );
        });
    };

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
                                A4 규격으로 출력합니다. (한 장에 최대 {LINES_PER_PAGE}개 품목, 초과 시 다음 장에 이어집니다)
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

                                    // PDF 저장 시 기본 파일명이 되도록 문서 제목을 임시 변경
                                    const originalTitle = document.title;

                                    const workDate = (workOrder.workDate ?? "").replace(/-/g, "");
                                    document.title = `작업지시서_${workDate}_${workOrder.workOrderNo}`;

                                    // 인쇄 창이 닫히면 원래 제목으로 복구
                                    const restoreTitle = () => {
                                        document.title = originalTitle;
                                        window.removeEventListener("afterprint", restoreTitle);
                                    };

                                    window.addEventListener("afterprint", restoreTitle);

                                    window.print();
                                }}
                            >
                                인쇄하기 / PDF 저장
                            </button>
                        </div>
                    </div>

                    <div className="work-order-print-scroll">
                        {renderSheets(selectedLines)}
                    </div>

                </div>
            </div>

            {/* =====================================================
                실제 인쇄 전용 영역
                화면에서는 숨기고 인쇄할 때만 표시한다.
                fixed / flex / overflow 구조와 완전히 분리된다.
            ===================================================== */}
            <div className="work-order-print-pages">
                {renderSheets(selectedLines)}
            </div>
        </div>
    );

    return createPortal(
        modal,
        document.body
    );
}
