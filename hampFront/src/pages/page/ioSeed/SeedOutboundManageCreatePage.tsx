import { useState, useMemo, useEffect, useRef, type SyntheticEvent, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/common/Badge";
import { CusTable } from "@/components/table/CusTable";
import { SalesOrderApi, type SalesOrderOptionResponse } from "@/api/sales/SalesOrder";
import { ShipmentOrderApi, type ShipmentSalesOrderResponse } from "@/api/ShipmentOrder";
import { UserApi, type UserOptionResponse } from "@/api/User";
import '@/pages/page/food/Food.css';

interface WorkOrderLine {
    id: string;
    salesOrderLineId: number;
    orderCode: string;
    itemCode: string;
    itemNm: string;
    instructQty: number;
    remainingQty: number;
}

export function SeedOutboundManageCreatePage() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 옵션 목록 상태
    const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([]);
    const [salesOrderOptions, setSalesOrderOptions] = useState<SalesOrderOptionResponse[]>([]);

    const [form, setForm] = useState({
        orderCode: "",
        managerId: "",
    });

    const [selectedSalesOrder, setSelectedSalesOrder] =
        useState<ShipmentSalesOrderResponse | null>(null);

    const [isLoadingSalesOrder, setIsLoadingSalesOrder] = useState(false);
    const [salesOrderError, setSalesOrderError] = useState("");

    const [lines, setLines] = useState<WorkOrderLine[]>([]);

    // --- useRef 기반 지시수량 임시 저장소 (line id를 키로 관리) ---
    const editQuantitiesRef = useRef<Record<string, number | ''>>({});

    // 현재 입력된 지시수량 조회
    const getCurrentQty = (line: WorkOrderLine): number => {
        const value = editQuantitiesRef.current[line.id];

        if (value === undefined || value === '') {
            return NaN;
        }

        return Number(value);
    };


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

        if (!orderCode) return;

        try {
            setIsLoadingSalesOrder(true);

            const response =
                await ShipmentOrderApi.getSalesOrderForShipment(orderCode);

            setSelectedSalesOrder(response.data);
        } catch (error) {
            console.error("수주 정보 조회 실패:", error);
            setSalesOrderError("수주 정보를 불러오지 못했습니다.");
        } finally {
            setIsLoadingSalesOrder(false);
        }
    };

    const handleRemoveLine = (id: string) => {
        delete editQuantitiesRef.current[id];
        setLines((prev) => prev.filter((line) => line.id !== id));
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
                    const isSelected = line.salesOrderLineId > 0;
                    return (
                        <button
                            type="button"
                            className="tableInput food-order-select-btn"
                        >
                            {isSelected ? (
                                <div className="food-order-selected-container">
                                    <span className="food-order-code-text">{line.orderCode}</span>
                                    <Badge tone="info">{line.itemCode}</Badge>
                                    <span className="food-item-name-text">{line.itemNm}</span>
                                </div>
                            ) : (
                                <span className="food-order-placeholder-text">클릭하여 수주라인을 선택하세요</span>
                            )}
                            <span className="food-order-change-text">(변경)</span>
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
                            key={`${line.id}-${line.salesOrderLineId}`}
                            type="number"
                            min="1"
                            max={line.remainingQty}
                            step="1"
                            className="tableInput food-table-input-cell"
                            value={editQuantitiesRef.current[line.id] ?? line.instructQty}
                            disabled={isSubmitting || line.salesOrderLineId === 0}
                            onChange={(e) => {
                                const value = e.target.value;

                                editQuantitiesRef.current[line.id] =
                                    value === "" ? "" : Number(value);
                            }}
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
                                className="food-line-delete-btn"
                                title="라인 삭제"
                            >
                                <TrashIcon className="food-delete-icon" />
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
        if (!form.managerId) {
            alert("담당자를 선택해주세요.");
            return false;
        }
        if (lines.length === 0) {
            alert("수주라인을 최소 1개 이상 추가해야 합니다.");
            return false;
        }
        for (const line of lines) {
            if (line.salesOrderLineId === 0) {
                alert("모든 라인에 수주라인을 선택해주셔야 합니다.");
                return false;
            }
            const currentQty = getCurrentQty(line);

            if (!Number.isFinite(currentQty) || currentQty <= 0) {
                alert("지시수량은 0보다 큰 숫자를 입력해주세요.");
                return false;
            }

            if (!Number.isInteger(currentQty)) {
                alert("지시수량은 정수로 입력해주세요.");
                return false;
            }

            if (currentQty > line.remainingQty) {
                alert(
                    `지시수량은 잔여 수량(${line.remainingQty})을 초과할 수 없습니다.`
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
        if (!validateForm()) return;

        // 제출 직전에 ref의 최신 입력값들을 반영
        const finalizedLines = lines.map((line) => ({
            salesOrderLineId: line.salesOrderLineId,
            instructQty: getCurrentQty(line),
        }));

        const payload = {
            orderCode: form.orderCode,
            managerId: form.managerId,
            lines: finalizedLines,
        };

        // setIsSubmitting(true);
        // try {
        //     await WorkOrderApi.create(payload);
        //     alert("작업지시가 성공적으로 등록되었습니다.");
        //     navigate("/food/work-orders");
        // } catch (error) {
        //     console.error("작업지시 등록 실패:", error);
        //     alert("작업지시 등록 중 오류가 발생했습니다.");
        // } finally {
        //     setIsSubmitting(false);
        // }
    };

    return (
        <section className="screenStack">
            <div className="createCard">

                {/* 헤더 영역 */}
                <div className="createHeader">
                    <h1 className="createTitle">출고지시서 등록</h1>
                    <span className="createMeta">
                        <span className="required">* 표시는 필수 입력 항목입니다</span>
                    </span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="createBody">

                        {/* 1. 기본 정보 섹션 */}
                        <div className="createSection">
                            <h2 className="createSectionTitle">기본정보</h2>
                            <div className="createGrid2Cols">

                                <div className="createField">
                                    <label className="requiredLabel">담당자 <span className="required">*</span></label>
                                    <select
                                        className="tableInput"
                                        value={form.managerId}
                                        disabled={isSubmitting}
                                        onChange={(e) => handleChange("managerId", e.target.value)}
                                    >
                                        <option value="" disabled>담당자 선택</option>
                                        {userOptions.map((user) => (
                                            <option key={user.userId} value={user.userId}>
                                                {user.userNm} ({user.userId})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="createField">
                                    <label className="requiredLabel">수주 <span className="required">*</span></label>
                                    <select
                                        className="tableInput"
                                        value={form.orderCode}
                                        disabled={isSubmitting}
                                        onChange={(e) => handleSalesOrderChange(e.target.value)}
                                    >
                                        <option value="" disabled>수주 선택</option>
                                        {salesOrderOptions.map((order) => (
                                            <option key={order.orderCode} value={order.orderCode}>
                                                {order.bpNm} ({order.orderCode})
                                            </option>
                                        ))}
                                    </select>

                                    {isLoadingSalesOrder && (
                                        <p>수주 정보를 불러오는 중입니다...</p>
                                    )}

                                    {salesOrderError && (
                                        <p className="errorMessage">{salesOrderError}</p>
                                    )}

                                    {selectedSalesOrder && (
                                        <div className="salesOrderDetail">
                                            <h3>수주 정보</h3>

                                            <div>
                                                <strong>수주번호:</strong>{" "}
                                                {selectedSalesOrder.orderCode}
                                            </div>

                                            <div>
                                                <strong>거래처:</strong>{" "}
                                                {selectedSalesOrder.bpNm}
                                            </div>

                                            <div>
                                                <strong>납기일:</strong>{" "}
                                                {selectedSalesOrder.dueDate}
                                            </div>

                                            <div>
                                                <strong>상태:</strong>{" "}
                                                {selectedSalesOrder.status}
                                            </div>

                                            <div>
                                                <strong>출고지시서 수:</strong>{" "}
                                                {selectedSalesOrder.shipmentOrderCount}
                                            </div>

                                            <h3>품목별 생산 / 출고 현황</h3>

                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>품목코드</th>
                                                        <th>품목명</th>
                                                        <th>수주수량</th>
                                                        <th>출고가능수량</th>
                                                        <th>출고수량</th>
                                                        <th>생산상태</th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {selectedSalesOrder.lines.map((line) => (
                                                        <tr key={line.salesOrderLineId}>
                                                            <td>{line.itemCode}</td>
                                                            <td>{line.itemNm}</td>
                                                            <td>{line.orderQty}</td>
                                                            <td>{line.availableQty}</td>
                                                            <td>{line.shippedQty}</td>
                                                            <td>{line.productionStatus}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>



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
        </section>
    );
}