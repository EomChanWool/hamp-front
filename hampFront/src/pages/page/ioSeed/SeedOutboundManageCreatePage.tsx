import { useState, useMemo, useEffect, useCallback, useRef, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { type ColumnDef } from "@tanstack/react-table";
import { CusTable } from "@/components/table/CusTable";
import { SalesOrderApi, type SalesOrderOptionResponse } from "@/api/sales/SalesOrder";
import { ShipmentOrderApi, type ShipmentOrderCreateRequest, type ShipmentSalesOrderResponse } from "@/api/ShipmentOrder";
import { UserApi, type UserOptionResponse } from "@/api/User";
import "@/pages/page/food/Food.css";
import "@/pages/page/ioSeed/ioSeed.css";

type ShipmentLine = ShipmentSalesOrderResponse["lines"][number];

/** 잔여수량 = 주문수량 - 기출고수량 */
const getRemainingQty = (line: ShipmentLine) =>
    Math.max(0, Number(line.orderQty ?? 0) - Number(line.shippedQty ?? 0));


/** 숫자를 천 단위 쉼표로 표시 */
const formatQty = (value: number | string | null | undefined) => {
    const num = Number(value ?? 0);

    return Number.isFinite(num)
        ? num.toLocaleString("ko-KR")
        : "0";
};

/** 출고 가능한 라인인지 (출고가능수량 > 0) */
const isShippable = (line: ShipmentLine) => Number(line.availableQty ?? 0) > 0;

/** 생산현황 문자열 → 배지 색상 (서버 값에 맞게 조정 가능) */
const getProductionTone = (status: string): "good" | "warn" | "info" => {
    const s = String(status ?? "");
    if (s.includes("완료") || s.toUpperCase().includes("COMPLETE")) return "good";
    if (s.includes("진행") || s.includes("일부") || s.toUpperCase().includes("PROGRESS")) return "warn";
    return "info";
};

export function SeedOutboundManageCreatePage() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 옵션 목록 상태
    const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([]);
    const [salesOrderOptions, setSalesOrderOptions] = useState<SalesOrderOptionResponse[]>([]);

    const [form, setForm] = useState({
        orderCode: "",
        managerId: "",
        shipDate: "",
    });

    const [selectedSalesOrder, setSelectedSalesOrder] =
        useState<ShipmentSalesOrderResponse | null>(null);
    const [isLoadingSalesOrder, setIsLoadingSalesOrder] = useState(false);
    const [salesOrderError, setSalesOrderError] = useState("");

    /**
     * 선택된 라인과 이번 출고수량을 한 곳에서 관리
     * - key 존재 = 체크된 라인
     * - value = 입력 중인 출고수량(문자열)
     */
    const [checkedLines, setCheckedLines] = useState<Record<number, boolean>>({});
    const [qtyMap, setQtyMap] = useState<Record<number, string>>({});

    const qtyMapRef = useRef(qtyMap);
    const checkedLinesRef = useRef(checkedLines);

    qtyMapRef.current = qtyMap;
    checkedLinesRef.current = checkedLines;

    // 수주 변경 시 이전 요청의 응답이 늦게 도착해도 무시하기 위한 요청 번호
    const requestSeqRef = useRef(0);

    const fetchOptions = useCallback(async () => {
        try {
            const [userRes, salesOrderRes] = await Promise.all([
                UserApi.getOptions(),
                SalesOrderApi.getOptions(),
            ]);
            setUserOptions(userRes.data ?? []);
            setSalesOrderOptions(salesOrderRes.data ?? []);
        } catch (error) {
            console.error("옵션 목록 조회 실패:", error);
        }
    }, []);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    const handleChange = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSalesOrderChange = async (orderCode: string) => {
        handleChange("orderCode", orderCode);

        // 선택 초기화
        setSelectedSalesOrder(null);
        setSalesOrderError("");
        setCheckedLines({});
        setQtyMap({});

        if (!orderCode) return;

        const seq = ++requestSeqRef.current;

        try {
            setIsLoadingSalesOrder(true);
            const response = await ShipmentOrderApi.getSalesOrderForShipment(orderCode);
            if (seq !== requestSeqRef.current) return;
            setSelectedSalesOrder(response.data);
        } catch (error) {
            if (seq !== requestSeqRef.current) return;
            console.error("수주 정보 조회 실패:", error);
            setSalesOrderError("수주 정보를 불러오지 못했습니다.");
        } finally {
            if (seq === requestSeqRef.current) setIsLoadingSalesOrder(false);
        }
    };


    const lines: ShipmentLine[] = selectedSalesOrder?.lines ?? [];

    const shippableLines = useMemo(
        () => lines.filter(isShippable),
        [lines]
    );

    const hasUnfinishedProduction = lines.some((line) => {
        const status = String(line.productionStatus ?? "").trim();

        return status === "생산중" || status === "일부생산";
    });

    const hasShippableLines = lines.some(isShippable);

    const hasUnavailableLines = lines.some(
        (line) => !isShippable(line)
    );

    const noticeType =
        lines.length === 0
            ? "none"
            : hasUnfinishedProduction
                ? "production"
                : !hasShippableLines
                    ? "unavailable"
                    : hasUnavailableLines
                        ? "partial"
                        : "none";

    const selectedCount = Object.values(checkedLines).filter(Boolean).length;

    const allChecked =
        shippableLines.length > 0 &&
        shippableLines.every(
            (line) => checkedLines[line.salesOrderLineId]
        );

    const allCheckedRef = useRef(allChecked);
    allCheckedRef.current = allChecked;

    // 체크박스 토글 (체크 시 출고가능수량을 기본값으로 채움)
    const toggleLine = (line: ShipmentLine) => {
        if (!isShippable(line)) return;

        const lineId = line.salesOrderLineId;

        setCheckedLines((prev) => {
            const checked = !prev[lineId];

            // 체크할 때만 기본 수량 설정
            if (checked) {
                setQtyMap((qtyPrev) => ({
                    ...qtyPrev,
                    [lineId]: qtyPrev[lineId] ?? String(line.availableQty),
                }));
            }

            return {
                ...prev,
                [lineId]: checked,
            };
        });
    };

    const toggleAll = () => {
        if (allCheckedRef.current) {
            setCheckedLines({});
            return;
        }

        setCheckedLines(
            Object.fromEntries(
                shippableLines.map((line) => [
                    line.salesOrderLineId,
                    true,
                ])
            )
        );

        setQtyMap((prev) => {
            const next = { ...prev };

            shippableLines.forEach((line) => {
                next[line.salesOrderLineId] ??= String(line.availableQty);
            });

            return next;
        });
    };

    const handleQtyChange = (lineId: number, value: string) => {
        setQtyMap((prev) => ({ ...prev, [lineId]: value }));
    };

    // 수주라인 테이블 컬럼 정의
    const columns = useMemo<ColumnDef<ShipmentLine>[]>(
        () => [
            {
                id: "select",
                enableSorting: false,
                meta: { width: "56px" },
                header: () => (
                    <input
                        type="checkbox"
                        className="checkbox"
                        checked={allCheckedRef.current}
                        disabled={isSubmitting || shippableLines.length === 0}
                        onChange={toggleAll}
                        aria-label="전체 선택"
                    />
                ),
                cell: ({ row }) => {
                    const line = row.original;
                    return (
                        <input
                            type="checkbox"
                            className="checkbox"
                            checked={!!checkedLinesRef.current[line.salesOrderLineId]}
                            disabled={isSubmitting || !isShippable(line)}
                            onChange={() => toggleLine(line)}
                            aria-label={`${line.itemNm} 선택`}
                        />
                    );
                },
            },
            {
                id: "item",
                header: "품목",
                enableSorting: false,
                meta: { width: "240px" },
                cell: ({ row }) => (
                    <div className="seedOutItemCell">
                        <span className="seedOutItemName">{row.original.itemNm}</span>
                        <span className="seedOutItemCode">{row.original.itemCode}</span>
                    </div>
                ),
            },
            {
                id: "orderQty",
                header: "주문수량",
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="seed-out-qty-unit">
                        <span className="seed-out-qty-value">
                            {formatQty(row.original.orderQty)}
                        </span>
                        <span className="seed-out-qty-unit-label">
                            {row.original.unit ?? ""}
                        </span>
                    </div>
                ),
            },
            {
                id: "shippedQty",
                header: "기출고",
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="seed-out-qty-unit">
                        <span className="seed-out-qty-value">
                            {formatQty(row.original.shippedQty)}
                        </span>
                        <span className="seed-out-qty-unit-label">
                            {row.original.unit ?? ""}
                        </span>
                    </div>
                ),
            },
            {
                id: "remainingQty",
                header: "잔여",
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="seed-out-qty-unit">
                        <strong className="seedOutRemain seed-out-qty-value">
                            {formatQty(getRemainingQty(row.original))}
                        </strong>
                        <span className="seed-out-qty-unit-label">
                            {row.original.unit ?? ""}
                        </span>
                    </div>
                ),
            },
            {
                id: "productionStatus",
                header: "생산현황",
                enableSorting: false,
                cell: ({ row }) => {
                    const status = row.original.productionStatus;
                    return <span className={`badge ${getProductionTone(status)}`}>{status}</span>;
                },
            },
            {
                id: "availableQty",
                header: "출고가능",
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="seed-out-qty-unit">
                        <span className="seed-out-qty-value">
                            {formatQty(row.original.availableQty)}
                        </span>
                        <span className="seed-out-qty-unit-label">
                            {row.original.unit ?? ""}
                        </span>
                    </div>
                ),
            },
            {
                id: "shipQty",
                header: "이번 출고수량",
                enableSorting: false,
                meta: { width: "170px" },
                cell: ({ row }) => {
                    const line = row.original;
                    const currentQty = qtyMapRef.current[line.salesOrderLineId];

                    return (
                        <div className="seed-out-qty-unit">
                            <input
                                type="number"
                                min={1}
                                max={line.availableQty}
                                step={1}
                                placeholder="-"
                                className="tableInput seedOutQtyInput seed-out-qty-input"
                                value={currentQty ?? ""}
                                disabled={isSubmitting || !isShippable(line)}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    const lineId = line.salesOrderLineId;

                                    handleQtyChange(lineId, value);

                                    setCheckedLines((prev) => ({
                                        ...prev,
                                        [lineId]: value !== "",
                                    }));
                                }}
                            />
                            <span className="seed-out-qty-unit-label">
                                {line.unit ?? ""}
                            </span>
                        </div>
                    );
                },
            }
        ],

        [isSubmitting, shippableLines]
    );

    const validateForm = (): boolean => {
        if (!form.managerId) {
            alert("담당자를 선택해주세요.");
            return false;
        }
        if (!form.orderCode || !selectedSalesOrder) {
            alert("수주를 선택해주세요.");
            return false;
        }
        if (selectedCount === 0) {
            alert("출고할 품목을 1개 이상 선택해주세요.");
            return false;
        }

        for (const line of lines) {
            if (!checkedLines[line.salesOrderLineId]) continue;

            const raw = qtyMap[line.salesOrderLineId];
            const qty = raw === undefined || raw.trim() === ""
                ? NaN
                : Number(raw);

            if (!Number.isFinite(qty) || qty <= 0) {
                alert(`[${line.itemNm}] 출고수량은 0보다 큰 숫자를 입력해주세요.`);
                return false;
            }

            if (!Number.isInteger(qty)) {
                alert(`[${line.itemNm}] 출고수량은 정수로 입력해주세요.`);
                return false;
            }

            if (qty > Number(line.availableQty)) {
                alert(
                    `[${line.itemNm}] 출고수량은 출고가능수량(${line.availableQty})을 초과할 수 없습니다.`
                );
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

        if (isSubmitting) return;
        if (!validateForm()) return;

        const payload: ShipmentOrderCreateRequest = {
            orderCode: form.orderCode,
            shipDate: form.shipDate,
            managerId: form.managerId,
            lines: lines
                .filter((line) => checkedLines[line.salesOrderLineId])
                .map((line) => ({
                    salesOrderLineId: line.salesOrderLineId,
                    instructQty: Number(qtyMap[line.salesOrderLineId]),
                })),
        };

        setIsSubmitting(true);

        try {
            await ShipmentOrderApi.create(payload);

            alert("출고지시서가 성공적으로 등록되었습니다.");
            navigate("/io/seed-outbound-manage");
        } catch (error) {
            console.error("출고지시서 등록 실패:", error);
            alert("출고지시서 등록 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };
    const shipmentCount = Number(selectedSalesOrder?.shipmentOrderCount ?? 0);

    return (
        <section className="screenStack">
            <form onSubmit={handleSubmit} className="screenStack">
                {/* 1. 기본정보 카드 */}
                <div className="createCard">
                    <div className="createHeader">
                        <h1 className="createTitle">출고지시서 등록</h1>
                        <span className="createMeta">
                            <span className="required">* 표시는 필수 입력 항목입니다</span>
                        </span>
                    </div>

                    <div className="createBody">
                        <div className="createGrid3Cols">
                            <div className="createField">
                                <label className="requiredLabel">
                                    담당자 <span className="required">*</span>
                                </label>
                                <select
                                    className="tableInput"
                                    value={form.managerId}
                                    disabled={isSubmitting}
                                    onChange={(e) => handleChange("managerId", e.target.value)}
                                >
                                    <option value="" disabled>담당자를 선택하세요</option>
                                    {userOptions.map((user) => (
                                        <option key={user.userId} value={user.userId}>
                                            {user.userNm} ({user.userId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="createField">
                                <label className="requiredLabel">
                                    수주 <span className="required">*</span>
                                </label>
                                <select
                                    className="tableInput"
                                    value={form.orderCode}
                                    disabled={isSubmitting}
                                    onChange={(e) => handleSalesOrderChange(e.target.value)}
                                >
                                    <option value="" disabled>수주를 선택하세요</option>
                                    {salesOrderOptions.map((order) => (
                                        <option key={order.orderCode} value={order.orderCode}>
                                            {order.bpNm} · {order.orderCode}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="createField">
                                <label className="requiredLabel">
                                    출고일자 <span className="required">*</span>
                                </label>
                                <input
                                    type="date"
                                    className="tableInput"
                                    value={form.shipDate}
                                    onChange={(e) => handleChange("shipDate", e.target.value)}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                        </div>

                        {isLoadingSalesOrder && (
                            <p className="seedOutStateText">수주 정보를 불러오는 중입니다...</p>
                        )}
                        {salesOrderError && (
                            <p className="seedOutStateText seedOutStateText--error">{salesOrderError}</p>
                        )}
                    </div>
                </div>

                {/* 2. 수주 요약 카드 */}
                {selectedSalesOrder && (
                    <div className="createCard">
                        <div className="seedOutSummary">
                            <div className="seedOutSummaryMain">
                                <h2 className="seedOutSummaryTitle">
                                    {selectedSalesOrder.bpNm}
                                    <span className="seedOutSummaryCode"> · {selectedSalesOrder.orderCode}</span>
                                </h2>
                                <span className="seedOutSummaryDue">납기일 {selectedSalesOrder.dueDate}</span>
                            </div>

                            <span className={`seedOutPill ${shipmentCount > 0 ? "seedOutPill--has" : ""}`}>
                                {shipmentCount > 0
                                    ? `등록된 출고지시서 ${shipmentCount}건`
                                    : "등록된 출고지시서 없음"}
                            </span>
                        </div>
                    </div>
                )}

                {/* 2-1. 생산 및 출고 안내 */}
                {selectedSalesOrder && noticeType !== "none" && (
                    <div className="seedOutNotice" role="status">
                        <span className="seedOutNoticeIcon" aria-hidden="true">
                            !
                        </span>

                        <div className="seedOutNoticeContent">
                            {noticeType === "production" && (
                                <>
                                    <strong>아직 생산이 끝나지 않은 품목이 있습니다.</strong>
                                    <p>
                                        전체 공정이 끝날 때까지 기다렸다가 한 번에 출고하거나,
                                        일정 차질 등의 사유로{" "}
                                        <strong>준비된 품목만 먼저 출고</strong>할 수 있습니다.
                                        출고지시서는 등록할 때마다 별도로 생성됩니다(= 송장 1건).
                                    </p>
                                </>
                            )}

                            {noticeType === "unavailable" && (
                                <>
                                    <strong>현재 출고 가능한 품목이 없습니다.</strong>
                                    <p>
                                        생산 현황과 출고 가능 수량을 확인해 주세요.
                                    </p>
                                </>
                            )}

                            {noticeType === "partial" && (
                                <>
                                    <strong>일부 품목만 출고할 수 있습니다.</strong>
                                    <p>
                                        출고 가능한 품목과 수량을 확인한 후
                                        출고지시서를 등록해 주세요.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. 수주라인 카드 */}
                {selectedSalesOrder && (
                    <div className="createCard">
                        <div className="seedOutLinesBody">
                            <h2 className="seedOutLinesTitle">수주라인</h2>

                            <div className="seedOutTable">
                                <CusTable
                                    data={lines}
                                    columns={columns}
                                    getRowId={(line) => String(line.salesOrderLineId)}
                                    noDataMessage="출고 가능한 수주라인이 없습니다."
                                />
                            </div>

                            <div className="seedOutLinesFooter">
                                <span className="seedOutSelectedCount">
                                    {selectedCount}개 품목 선택됨
                                </span>

                                <div className="seedOutFooterActions">
                                    <button
                                        type="button"
                                        className="ghostButton"
                                        onClick={handleCancel}
                                        disabled={isSubmitting}
                                    >
                                        목록
                                    </button>

                                    <button
                                        type="submit"
                                        className="primaryButton"
                                        disabled={isSubmitting || selectedCount === 0}
                                    >
                                        {isSubmitting ? "등록 중..." : "출고지시서 등록"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 하단: 수주 선택 전 목록 버튼 */}
                {!selectedSalesOrder && (
                    <div className="seedOutLinesFooter seedOutLinesFooter--listOnly">
                        <div className="seedOutFooterActions">
                            <button
                                type="button"
                                className="ghostButton"
                                onClick={handleCancel}
                                disabled={isSubmitting}
                            >
                                목록
                            </button>
                        </div>
                    </div>
                )}
            </form>
        </section>
    );
}
