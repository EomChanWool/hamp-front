import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Barcode from "react-barcode";
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
     * 실제 작업지시서 한 장을 만드는 함수
  
     * [1장 압축 방향]
     *  1) 품목마다 "표 + 바코드 블록"을 따로 만들던 구조(품목당 약 110px+)를
     *     → 하나의 표로 합치고 바코드를 행 안의 셀로 이동 (품목당 약 40px)
     *  2) 공정순서를 세로 목록 → 가로 칩(줄바꿈) 형태로 변경
     *  3) 작업지시 정보 표를 4열 2행 → 8열 1행으로 축소
     *  4) 주의사항/서명/푸터 높이 축소
     *  5) 라인이 많으면(6개 이상) is-dense 클래스로 한 단계 더 압축
     *  ※ 그래도 넘치면 thead 반복 + 행 단위 분할로 자연스럽게 2장째로 이어진다.
     */
    const renderSheet = (
        lines: WorkOrderLineDetail[]
    ) => {
        const isDense = lines.length >= 6;
        const barcodeHeight = isDense ? 22 : 28;

        return (
            <div
                className={`work-order-print-sheet${isDense ? " is-dense" : ""}`}
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

                {/* 작업지시 정보 (8열 1행으로 압축) */}
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

                {/* 작업지시 품목: 하나의 표 + 품목별 tbody 그룹 */}
                <section className="work-order-print-section">
                    <h3 className="work-order-print-section-title">
                        <span />
                        작업지시 품목 및 생산 정보
                    </h3>

                    <table className="work-order-print-table line-table">
                        <thead>
                            <tr>
                                <th className="col-no">순번</th>
                                <th className="col-bp">거래처</th>
                                <th className="col-item">품명</th>
                                <th className="col-qty">지시수량</th>
                                <th className="col-due">납기일자</th>
                                <th className="col-barcode">바코드</th>
                            </tr>
                        </thead>

                        {lines.length === 0 && (
                            <tbody>
                                <tr>
                                    <td colSpan={6} className="empty-row">
                                        선택된 작업지시 품목이 없습니다.
                                    </td>
                                </tr>
                            </tbody>
                        )}

                        {lines.map((line, index) => {
                            // 공정순서 정렬 (원본 배열 훼손 방지)
                            const steps = [...(line.routingSteps ?? [])].sort(
                                (a, b) => a.operSeq - b.operSeq
                            );

                            return (
                                /*
                                 * 품목 1개 = tbody 1개
                                 * (메인 행 + 공정순서 행)이 페이지 중간에서 잘리지 않도록
                                 * CSS 에서 .line-group { break-inside: avoid } 적용
                                 */
                                <tbody className="line-group" key={line.id}>
                                    <tr>
                                        <td className="text-center">
                                            {index + 1}
                                        </td>

                                        <td className="bp-name">
                                            {line.bpNm || "-"}
                                            <span className="bp-code">
                                                ({line.bpCode || "-"})
                                            </span>
                                        </td>

                                        <td className="item-name">
                                            {line.itemNm || "-"}
                                            <span className="item-code">
                                                ({line.itemCode || "-"})
                                            </span>
                                        </td>

                                        <td className="qty">
                                            {(line.instructQty ?? 0).toLocaleString()}
                                            {line.unit ? ` ${line.unit}` : ""}
                                        </td>

                                        <td className="text-center">
                                            {line.dueDate || "-"}
                                        </td>

                                        {/* 품목별 바코드 (표 안으로 이동) */}
                                        <td className="barcode-cell">
                                            <Barcode
                                                value={line.barcode || "NO-BARCODE"}
                                                width={1.2}
                                                height={barcodeHeight}
                                                fontSize={9}
                                                displayValue={true}
                                                margin={0}
                                                background="#ffffff"
                                                lineColor="#000000"
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

                {/* 주의사항 (한 줄 요약형으로 축소) */}
                <section className="work-order-print-notice">
                    <strong>⚠ 현장 특이사항 및 주의사항</strong>

                    <div className="work-order-print-notice-body">
                        품목·수량·바코드 정보에 이상이 있으면 담당자에게 즉시 보고하고,
                        작업 완료 후 생산수량과 지시수량을 확인하십시오.
                    </div>
                </section>

                {/* 서명 */}
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

                {/* Footer */}
                <div className="work-order-print-footer">
                    HEMP 식품 MES 시스템 © FOODTECH MANUFACTURING DIVISION
                </div>
            </div>
        );
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
                                A4 규격으로 출력합니다. (라인이 많으면 자동으로 다음 장에 이어집니다)
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
                        {renderSheet(selectedLines)}
                    </div>

                </div>
            </div>

            {/* =====================================================
                실제 인쇄 전용 영역
                화면에서는 숨기고 인쇄할 때만 표시한다.
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
