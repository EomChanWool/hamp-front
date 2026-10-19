import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Barcode from "react-barcode";
import type { ShipmentOrderResponse } from "@/api/ShipmentOrder";

// 모달 공통 껍데기(툴바/미리보기/A4/print 규칙)는 작업지시서 CSS 를 그대로 재사용
import "@/components/modal/WorkOrderPrintModal.css";
// 출고지시서 전용 스타일(제목 옆 버튼, 헤더 바코드, 합계행 등)
import "@/components/modal/ShipmentOrderPrintModal.css";

interface ShipmentOrderPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    shipment: ShipmentOrderResponse | null;
}

/** 상태 코드 → 한글 (상세 페이지의 getStatusBadge 와 동일한 매핑) */
const getStatusText = (status?: string) => {
    switch (status?.trim()) {
        case "DONE":
        case "완료":
            return "완료";
        case "PROGRESS":
        case "진행중":
            return "진행중";
        case "DELAY":
        case "지연":
            return "지연";
        case "WAIT":
        case "대기":
            return "대기";
        default:
            return status || "-";
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

export function ShipmentOrderPrintModal({
    isOpen,
    onClose,
    shipment,
}: ShipmentOrderPrintModalProps) {
    const [printDateTime, setPrintDateTime] = useState("");

    // 모달이 열릴 때마다 출력일시를 현재 시각으로 갱신
    useEffect(() => {
        if (!isOpen) return;

        setPrintDateTime(formatPrintDateTime(new Date()));
    }, [isOpen]);

    // Hook 호출 이후에 early return (Hook 순서 규칙 유지)
    if (!isOpen || !shipment) return null;

    const lines = shipment.lines ?? [];
    const totalQty = lines.reduce((sum, line) => sum + (line.instructQty ?? 0), 0);

    /*
     * 출고지시서 한 장.
     * 화면 미리보기와 실제 인쇄 영역에서 동일하게 재사용한다. (작업지시서와 동일 패턴)
     *
     * [1장 구성] 헤더(+바코드) / 출고 정보 3행 / 라인 표(합계 포함) / 주의사항 / 서명
     *  → 라인 표는 행 높이 약 20px 이라 한 장에 대략 30라인 정도까지 들어간다.
     *    넘치면 thead 반복 + 행 단위 분할로 다음 장에 이어서 출력된다.
     */
    const renderSheet = () => (
        <div className={`work-order-print-sheet${lines.length >= 20 ? " is-dense" : ""}`}>
            {/* Header: 좌측 제목 / 우측 출력정보 + 출고지시ID 바코드 */}
            <div className="work-order-print-header">
                <div>
                    {/* 부서 문구는 필요에 맞게 수정 */}
                    <span className="work-order-print-department">출고관리</span>

                    <h1>출 고 지 시 서</h1>

                    <p>Shipment Order Sheet - Seed Outbound</p>
                </div>

                <div className="work-order-print-header-right">
                    <div className="work-order-print-meta">
                        <div>
                            <strong>출고일자:</strong> {shipment.shipDate || "-"}
                        </div>

                        <div>
                            <strong>출력일시:</strong> {printDateTime || "-"}
                        </div>
                    </div>

                    {/* 출고처리 스캔용 바코드 (출고지시ID) */}
                    <div className="ship-header-barcode">
                        <Barcode
                            value={shipment.shipId || "NO-BARCODE"}
                            format="CODE128"
                            width={1.2}
                            height={30}
                            fontSize={9}
                            displayValue={true}
                            margin={0}
                            background="#ffffff"
                            lineColor="#000000"
                        />
                    </div>
                </div>
            </div>

            {/* 출고지시 정보 */}
            <section className="work-order-print-section">
                <h3 className="work-order-print-section-title">
                    <span />
                    출고지시 정보
                </h3>

                <table className="work-order-print-table ship-info-table">
                    <tbody>
                        <tr>
                            <th>출고지시번호</th>
                            <td className="mono">{shipment.shipId || "-"}</td>

                            <th>수주번호</th>
                            <td className="mono">{shipment.orderCode || "-"}</td>
                        </tr>

                        <tr>
                            <th>출고일자</th>
                            <td>{shipment.shipDate || "-"}</td>

                            <th>상태</th>
                            <td>{getStatusText(shipment.status)}</td>
                        </tr>

                        <tr>
                            <th>담당자</th>
                            <td>
                                {shipment.managerNm
                                    ? `${shipment.managerNm} (${shipment.managerId})`
                                    : shipment.managerId || "-"}
                            </td>

                            <th>라인 수 / 총 지시수량</th>
                            <td>
                                {lines.length}건 / {totalQty.toLocaleString()}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* 출고지시 라인 */}
            <section className="work-order-print-section">
                <h3 className="work-order-print-section-title">
                    <span />
                    출고지시 라인
                </h3>

                <table className="work-order-print-table ship-line-table">
                    <thead>
                        <tr>
                            <th className="col-no">순번</th>
                            <th className="col-id">출고라인ID</th>
                            <th className="col-id">수주라인ID</th>
                            <th>품명</th>
                            <th className="col-qty">지시수량</th>
                            <th className="col-check">출고확인</th>
                        </tr>
                    </thead>

                    <tbody>
                        {lines.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="empty-row">
                                    등록된 출고지시 라인이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            lines.map((line, index) => (
                                <tr key={line.shipOrderLineId}>
                                    <td className="text-center">{index + 1}</td>

                                    <td className="text-center mono">
                                        #{line.shipOrderLineId}
                                    </td>

                                    <td className="text-center mono">
                                        #{line.salesOrderLineId}
                                    </td>

                                    <td className="item-name">
                                        {line.itemNm || "-"}
                                        <span className="item-code">
                                            ({line.itemCode || "-"})
                                        </span>
                                    </td>

                                    <td className="qty">
                                        {(line.instructQty ?? 0).toLocaleString()}
                                    </td>

                                    {/* 현장에서 펜으로 체크하는 칸 */}
                                    <td className="checkbox-cell">
                                        <span className="print-checkbox" />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>

                    {/* 합계 행 */}
                    {lines.length > 0 && (
                        <tfoot>
                            <tr className="ship-total-row">
                                <td colSpan={4} className="text-center">
                                    합 계
                                </td>
                                <td className="qty">{totalQty.toLocaleString()}</td>
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </section>

            {/* 주의사항 */}
            <section className="work-order-print-notice">
                <strong>⚠ 출고 시 주의사항</strong>

                <div className="work-order-print-notice-body">
                    출고 전 품목·수량·LOT 정보를 지시서와 대조하고, 이상이 있으면 담당자에게
                    즉시 보고하십시오. 출고 완료 후 실제 출고수량을 확인하십시오.
                </div>
            </section>

            {/* 서명 */}
            <section className="work-order-print-sign-area">
                <div className="work-order-sign-box">
                    <div className="work-order-sign-title">담 당 자</div>

                    <div className="work-order-sign-row">
                        <span>성명:</span>
                        <strong>{shipment.managerNm || shipment.managerId || "-"}</strong>
                    </div>
                </div>

                <div className="work-order-sign-box">
                    <div className="work-order-sign-title">출 고 확 인 자</div>

                    <div className="work-order-sign-row">
                        <span>확인:</span>
                        <span className="signature-space" />
                    </div>
                </div>

                <div className="work-order-sign-box">
                    <div className="work-order-sign-title">인 수 확 인 자</div>

                    <div className="work-order-sign-row">
                        <span>인수:</span>
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

    /*
     * root id 는 작업지시서와 달라도 된다.
     * print 규칙이 class(.work-order-print-root) 기준이라 동일하게 동작한다.
     */
    const modal = (
        <div id="shipment-order-print-root" className="work-order-print-root">
            {/* 화면용 모달 */}
            <div className="work-order-print-modal no-print">
                <div className="work-order-print-frame">
                    <div className="work-order-print-toolbar">
                        <div className="work-order-print-toolbar-info">
                            <h2>출고지시서 인쇄</h2>

                            <p>
                                출고지시 정보와 라인을 A4 규격으로 출력합니다.
                                (라인이 많으면 자동으로 다음 장에 이어집니다)
                            </p>
                        </div>

                        <div className="work-order-print-toolbar-actions">
                            <button type="button" className="ghostButton" onClick={onClose}>
                                닫기
                            </button>

                            <button
                                type="button"
                                className="primaryButton"
                                onClick={() => {
                                    window.focus();

                                    // PDF 저장 시 기본 파일명이 되도록 문서 제목을 임시 변경
                                    const originalTitle = document.title;
                                    const shipDate = (shipment.shipDate ?? "").replace(/-/g, "");
                                    document.title = `출고지시서_${shipDate}_${shipment.shipId}`;

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

                    <div className="work-order-print-scroll">{renderSheet()}</div>
                </div>
            </div>

            {/* 실제 인쇄 전용 영역 (화면에서는 숨김, 인쇄 시에만 표시) */}
            <div className="work-order-print-pages">{renderSheet()}</div>
        </div>
    );

    return createPortal(modal, document.body);
}
