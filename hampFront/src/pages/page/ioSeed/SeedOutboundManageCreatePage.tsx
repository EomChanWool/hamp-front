import { useState, useMemo, useEffect, useCallback, useRef, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { type ColumnDef } from "@tanstack/react-table";
import { CusTable } from "@/components/table/CusTable";
import { SelectBox, type SelectBoxOption } from "@/components/common/SelectBox";
import { focusField } from "@/utils/common";
import { SalesOrderApi, type SalesOrderOptionResponse } from "@/api/sales/SalesOrder";
import { ShipmentOrderApi, type ShipmentOrderCreateRequest, type ShipmentSalesOrderResponse } from "@/api/ShipmentOrder";
import { UserApi, type UserOptionResponse } from "@/api/User";
import "@/pages/layout/Layout.css";
import "@/pages/page/food/Food.css";
import "@/pages/page/ioSeed/ioSeed.css";

type ShipmentLine = ShipmentSalesOrderResponse["lines"][number];

// 담당자 · 수주 · 출고일자
const REQUIRED_TOTAL = 3;

/** 잔여수량 = 주문수량 - 기출고수량 */
const getRemainingQty = (line: ShipmentLine) =>
    Math.max(0, Number(line.orderQty ?? 0) - Number(line.shippedQty ?? 0));

/** 숫자를 천 단위 쉼표로 표시 */
const formatQty = (value: number | string | null | undefined) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num.toLocaleString("ko-KR") : "0";
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

    // 체크된 라인 / 이번 출고수량(문자열)
    const [checkedLines, setCheckedLines] = useState<Record<number, boolean>>({});
    const [qtyMap, setQtyMap] = useState<Record<number, string>>({});

    // 등록을 한 번 눌러 필수값 검증에 걸린 뒤부터 비어 있는 필수 칸을 빨갛게 표시
    const [showRequiredErrors, setShowRequiredErrors] = useState(false);

    const managerSelectRef = useRef<HTMLButtonElement>(null);
    const orderSelectRef = useRef<HTMLButtonElement>(null);
    const shipDateRef = useRef<HTMLInputElement>(null);

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

    // SelectBox용 옵션 (이름 + 코드 2줄 표기)
    const managerSelectOptions = useMemo<SelectBoxOption[]>(
        () =>
            userOptions.map((user) => ({
                value: user.userId,
                label: user.userNm ?? user.userId,
                description: user.userId,
            })),
        [userOptions]
    );

    const orderSelectOptions = useMemo<SelectBoxOption[]>(
        () =>
            salesOrderOptions.map((order) => ({
                value: order.orderCode,
                label: order.bpNm ?? order.orderCode,
                description: order.orderCode,
            })),
        [salesOrderOptions]
    );

    const handleChange = (key: keyof typeof form, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const missingRequired = {
        managerId: !form.managerId,
        orderCode: !form.orderCode,
        shipDate: !form.shipDate,
    };
    const isInvalid = (key: keyof typeof missingRequired) =>
        (showRequiredErrors && missingRequired[key]) || undefined;

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

    const shippableLines = useMemo(() => lines.filter(isShippable), [lines]);

    const hasUnfinishedProduction = lines.some((line) => {
        const status = String(line.productionStatus ?? "").trim();
        return status === "생산중" || status === "일부생산";
    });
    const hasShippableLines = lines.some(isShippable);
    const hasUnavailableLines = lines.some((line) => !isShippable(line));

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
        shippableLines.every((line) => checkedLines[line.salesOrderLineId]);

    const allCheckedRef = useRef(allChecked);
    allCheckedRef.current = allChecked;

    // 체크박스 토글 (체크 시 출고가능수량을 기본값으로 채움)
    // updater 안에서 다른 setState를 부르지 않도록 ref 값으로 먼저 계산
    const toggleLine = (line: ShipmentLine) => {
        if (!isShippable(line)) return;

        const lineId = line.salesOrderLineId;
        const checked = !checkedLinesRef.current[lineId];

        setCheckedLines((prev) => ({ ...prev, [lineId]: checked }));

        if (checked) {
            setQtyMap((prev) => ({
                ...prev,
                [lineId]: prev[lineId] || String(line.availableQty),
            }));
        }
    };

    const toggleAll = () => {
        if (allCheckedRef.current) {
            setCheckedLines({});
            return;
        }

        setCheckedLines(
            Object.fromEntries(shippableLines.map((line) => [line.salesOrderLineId, true]))
        );

        setQtyMap((prev) => {
            const next = { ...prev };
            shippableLines.forEach((line) => {
                next[line.salesOrderLineId] ||= String(line.availableQty);
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
                        <span className="seed-out-qty-value">{formatQty(row.original.orderQty)}</span>
                        <span className="seed-out-qty-unit-label">{row.original.unit ?? ""}</span>
                    </div>
                ),
            },
            {
                id: "shippedQty",
                header: "기출고",
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="seed-out-qty-unit">
                        <span className="seed-out-qty-value">{formatQty(row.original.shippedQty)}</span>
                        <span className="seed-out-qty-unit-label">{row.original.unit ?? ""}</span>
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
                        <span className="seed-out-qty-unit-label">{row.original.unit ?? ""}</span>
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
                        <span className="seed-out-qty-value">{formatQty(row.original.availableQty)}</span>
                        <span className="seed-out-qty-unit-label">{row.original.unit ?? ""}</span>
                    </div>
                ),
            },
            {
                id: "shipQty",
                header: "이번 출고수량",
                enableSorting: false,
                meta: { width: "190px" },
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
                                className="formInput seedOutQtyInput"
                                value={currentQty ?? ""}
                                disabled={isSubmitting || !isShippable(line)}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    const lineId = line.salesOrderLineId;

                                    handleQtyChange(lineId, value);
                                    setCheckedLines((prev) => ({ ...prev, [lineId]: value !== "" }));
                                }}
                            />
                            <span className="seed-out-qty-unit-label">{line.unit ?? ""}</span>
                        </div>
                    );
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isSubmitting, shippableLines]
    );

    const validateForm = (): boolean => {
        // 비어 있는 첫 필수 칸을 안내하고 그 칸으로 이동
        const firstMissing = (
            [
                { missing: missingRequired.managerId, ref: managerSelectRef, message: "담당자를 선택해주세요." },
                { missing: missingRequired.orderCode, ref: orderSelectRef, message: "수주를 선택해주세요." },
                { missing: missingRequired.shipDate, ref: shipDateRef, message: "출고일자를 입력해주세요." },
            ] as const
        ).find((field) => field.missing);

        if (firstMissing) {
            setShowRequiredErrors(true);
            alert(firstMissing.message);
            focusField(firstMissing.ref.current);
            return false;
        }

        if (!selectedSalesOrder) {
            alert("수주 정보를 불러오지 못했습니다. 수주를 다시 선택해주세요.");
            return false;
        }
        if (selectedCount === 0) {
            alert("출고할 품목을 1개 이상 선택해주세요.");
            return false;
        }

        for (const line of lines) {
            if (!checkedLines[line.salesOrderLineId]) continue;

            const raw = qtyMap[line.salesOrderLineId];
            const qty = raw === undefined || raw.trim() === "" ? NaN : Number(raw);

            if (!Number.isFinite(qty) || qty <= 0) {
                alert(`[${line.itemNm}] 출고수량은 0보다 큰 숫자를 입력해주세요.`);
                return false;
            }
            if (!Number.isInteger(qty)) {
                alert(`[${line.itemNm}] 출고수량은 정수로 입력해주세요.`);
                return false;
            }
            if (qty > Number(line.availableQty)) {
                alert(`[${line.itemNm}] 출고수량은 출고가능수량(${line.availableQty})을 초과할 수 없습니다.`);
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
            const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;
            alert(errorMessage || "출고지시서 등록 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ---- 요약 패널용 파생 값 ----
    const shipmentCount = Number(selectedSalesOrder?.shipmentOrderCount ?? 0);
    const selectedManager = userOptions.find((user) => user.userId === form.managerId);

    const requiredDone = [form.managerId, form.orderCode, form.shipDate].filter(Boolean).length;

    const totalShipQty = lines.reduce(
        (sum, line) =>
            checkedLines[line.salesOrderLineId]
                ? sum + (Number(qtyMap[line.salesOrderLineId]) || 0)
                : sum,
        0
    );

    const summaryRows: { label: string; value: string }[] = [
        { label: "수주", value: selectedSalesOrder?.orderCode ?? "" },
        { label: "거래처", value: selectedSalesOrder?.bpNm ?? "" },
        { label: "납기일", value: selectedSalesOrder?.dueDate ?? "" },
        { label: "담당자", value: selectedManager ? (selectedManager.userNm ?? selectedManager.userId) : "" },
        { label: "출고일자", value: form.shipDate },
        {
            label: "등록 건수",
            value: selectedSalesOrder ? (shipmentCount > 0 ? `${shipmentCount}건` : "없음") : "",
        },
        { label: "선택 품목", value: selectedCount > 0 ? `${selectedCount}개` : "" },
        { label: "총 출고량", value: totalShipQty > 0 ? formatQty(totalShipQty) : "" },
    ];

    return (
        <section className="screenStack">
            <form className="formPage" onSubmit={handleSubmit}>
                <div className="formPageHead">
                    <h1 className="formPageTitle">출고지시서 등록</h1>
                    <span className="formPageMeta">
                        <span className="required" aria-hidden="true">*</span> 표시는 필수 입력 항목입니다
                    </span>
                </div>

                <div className="formLayout">
                    {/* ===== 좌측: 입력 섹션 카드 ===== */}
                    <div className="formMain">
                        {/* 1. 기본정보 */}
                        <section className="formCard" aria-labelledby="out-sec-basic">
                            <div className="formCardHead">
                                <div>
                                    <h2 className="formCardTitle" id="out-sec-basic">기본정보</h2>
                                    <p className="formCardDesc">담당자와 출고할 수주, 출고일자를 선택합니다.</p>
                                </div>
                            </div>

                            <div className="formGrid">
                                <div className="formField col2">
                                    <label className="formLabel" htmlFor="out-manager">
                                        담당자 <span className="required" aria-hidden="true">*</span>
                                    </label>
                                    <SelectBox
                                        ref={managerSelectRef}
                                        id="out-manager"
                                        value={form.managerId}
                                        options={managerSelectOptions}
                                        placeholder="담당자를 선택해주세요"
                                        searchPlaceholder="이름 또는 아이디 검색"
                                        searchable
                                        disabled={isSubmitting}
                                        invalid={isInvalid("managerId")}
                                        onChange={(v) => handleChange("managerId", v)}
                                    />
                                </div>

                                <div className="formField col2">
                                    <label className="formLabel" htmlFor="out-order">
                                        수주 <span className="required" aria-hidden="true">*</span>
                                    </label>
                                    <SelectBox
                                        ref={orderSelectRef}
                                        id="out-order"
                                        value={form.orderCode}
                                        options={orderSelectOptions}
                                        placeholder="수주를 선택해주세요"
                                        searchPlaceholder="거래처명 또는 수주번호 검색"
                                        searchable
                                        disabled={isSubmitting}
                                        invalid={isInvalid("orderCode")}
                                        onChange={handleSalesOrderChange}
                                    />
                                </div>

                                <div className="formField col2">
                                    <label className="formLabel" htmlFor="out-ship-date">
                                        출고일자 <span className="required" aria-hidden="true">*</span>
                                    </label>
                                    <input
                                        ref={shipDateRef}
                                        id="out-ship-date"
                                        type="date"
                                        className="formInput"
                                        value={form.shipDate}
                                        aria-invalid={isInvalid("shipDate")}
                                        disabled={isSubmitting}
                                        onChange={(e) => handleChange("shipDate", e.target.value)}
                                    />
                                </div>
                            </div>

                            {isLoadingSalesOrder && (
                                <p className="formStateText">수주 정보를 불러오는 중입니다...</p>
                            )}
                            {salesOrderError && (
                                <p className="formStateText formStateText--error" role="alert">
                                    {salesOrderError}
                                </p>
                            )}
                        </section>

                        {/* 2. 생산 및 출고 안내 */}
                        {selectedSalesOrder && noticeType !== "none" && (
                            <div className="formHint formHint--warn" role="status">
                                {noticeType === "production" && (
                                    <>
                                        <strong className="formHintTitle">아직 생산이 끝나지 않은 품목이 있습니다.</strong>
                                        <span>
                                            전체 공정이 끝날 때까지 기다렸다가 한 번에 출고하거나, 일정 차질 등의 사유로{" "}
                                            <strong>준비된 품목만 먼저 출고</strong>할 수 있습니다.
                                            출고지시서는 등록할 때마다 별도로 생성됩니다(= 송장 1건).
                                        </span>
                                    </>
                                )}
                                {noticeType === "unavailable" && (
                                    <>
                                        <strong className="formHintTitle">현재 출고 가능한 품목이 없습니다.</strong>
                                        <span>생산 현황과 출고 가능 수량을 확인해 주세요.</span>
                                    </>
                                )}
                                {noticeType === "partial" && (
                                    <>
                                        <strong className="formHintTitle">일부 품목만 출고할 수 있습니다.</strong>
                                        <span>출고 가능한 품목과 수량을 확인한 후 출고지시서를 등록해 주세요.</span>
                                    </>
                                )}
                            </div>
                        )}

                        {/* 3. 수주라인 */}
                        <section className="formCard" aria-labelledby="out-sec-lines">
                            <div className="formCardHead">
                                <div>
                                    <h2 className="formCardTitle" id="out-sec-lines">수주라인</h2>
                                    <p className="formCardDesc">출고할 품목을 선택하고 이번 출고수량을 입력합니다.</p>
                                </div>
                                {selectedSalesOrder && (
                                    <span className="formCardMeta">{selectedCount}개 품목 선택됨</span>
                                )}
                            </div>

                            {selectedSalesOrder ? (
                                <div className="seedOutTable">
                                    <CusTable
                                        data={lines}
                                        columns={columns}
                                        getRowId={(line) => String(line.salesOrderLineId)}
                                        noDataMessage="출고 가능한 수주라인이 없습니다."
                                    />
                                </div>
                            ) : (
                                <div className="formEmpty">
                                    <span className="formEmptyTitle">수주를 선택해주세요</span>
                                    <p className="formEmptyDesc">수주를 선택하면 수주라인이 여기에 표시됩니다.</p>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* ===== 우측: 요약 + 액션 ===== */}
                    <aside className="formCard formAside" aria-label="출고지시 요약">
                        <h2 className="formCardTitle">출고지시 요약</h2>

                        <div className="formProgress">
                            <div className="formProgressText">
                                <span>필수 입력</span>
                                <strong>
                                    {requiredDone}/{REQUIRED_TOTAL}
                                </strong>
                            </div>
                            <div
                                className="formProgressBar"
                                role="progressbar"
                                aria-label="필수 입력 진행률"
                                aria-valuemin={0}
                                aria-valuemax={REQUIRED_TOTAL}
                                aria-valuenow={requiredDone}
                            >
                                <div
                                    className="formProgressFill"
                                    style={{ width: `${(requiredDone / REQUIRED_TOTAL) * 100}%` }}
                                />
                            </div>
                        </div>

                        <dl className="formSummaryList">
                            {summaryRows.map((row) => (
                                <div className="formSummaryRow" key={row.label}>
                                    <dt>{row.label}</dt>
                                    <dd className={row.value ? undefined : "isEmpty"}>{row.value || "미입력"}</dd>
                                </div>
                            ))}
                        </dl>

                        <div className="formActions">
                            <button
                                type="submit"
                                className="primaryButton"
                                disabled={isSubmitting || selectedCount === 0}
                            >
                                {isSubmitting ? "등록 중..." : "출고지시서 등록"}
                            </button>
                            <button
                                type="button"
                                className="ghostButton"
                                onClick={handleCancel}
                                disabled={isSubmitting}
                            >
                                목록
                            </button>
                        </div>
                    </aside>
                </div>
            </form>
        </section>
    );
}