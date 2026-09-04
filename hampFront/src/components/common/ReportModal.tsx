import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { type ColumnDef } from '@tanstack/react-table';
import { CusTable } from '@/components/table/CusTable'; // CusTable 경로에 맞게 수정해주세요
import Spinner from '@/components/common/Spinner'; 
import {
    SeedGoodsReceiptReturnApi,
    type SeedGoodsReceiptResponse,
    type SeedGoodsReceiptReturnResponse,
    type SeedGoodsReceiptReturnCreateRequest,
    type SeedGoodsReceiptReturnUpdateRequest,
} from '@/api/ioSeed/SeedGoodsReceipt';
import '@/pages/page/ioSeed/ioSeed.css';

interface ReportModalProps {
    receipt: SeedGoodsReceiptResponse;
    onClose: () => void;
    /** 신고 이력이 저장/수정/삭제되어 목록(진행상태 등)을 다시 불러와야 할 때 호출 */
    onChanged: () => void;
}

const PROCESS_STATUS_OPTIONS = ['신고완료', '반납예정', '반납완료'] as const;
type ProcessStatus = (typeof PROCESS_STATUS_OPTIONS)[number];

export function ReportModal({ receipt, onClose, onChanged }: ReportModalProps) {
    const [returns, setReturns] = useState<SeedGoodsReceiptReturnResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

    // --- 1. 위쪽 테이블 행 수정용 독립 상태 ---
    const [editingReturnId, setEditingReturnId] = useState<number | null>(null);
    const [editReturnQtyInput, setEditReturnQtyInput] = useState<number | ''>('');
    const [editReportDateInput, setEditReportDateInput] = useState<string>('');
    const [editReturnDueDateInput, setEditReturnDueDateInput] = useState<string>('');
    const [editProcessStatusInput, setEditProcessStatusInput] = useState<ProcessStatus>('신고완료');

    // --- 2. 하단 '이번 신고 등록'용 독립 상태 ---
    const [newReturnQtyInput, setNewReturnQtyInput] = useState<number | ''>('');
    const [newReportDateInput, setNewReportDateInput] = useState<string>('');
    const [newReturnDueDateInput, setNewReturnDueDateInput] = useState<string>('');
    const [newProcessStatusInput, setNewProcessStatusInput] = useState<ProcessStatus>('신고완료');

    const goodQty = receipt.goodQty ?? 0;

    const reportedTotal = returns.reduce((sum, r) => sum + (r.returnQty ?? 0), 0);
    // 수정 중인 행의 수량은 잔여수량 계산 시 중복 차감되지 않도록 보정
    const editingQty = editingReturnId
        ? returns.find((r) => r.returnId === editingReturnId)?.returnQty ?? 0
        : 0;
    const remainingQty = Math.max(goodQty - reportedTotal + editingQty, 0);
    const isFullyReported = remainingQty <= 0;

    const loadReturns = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await SeedGoodsReceiptReturnApi.getList(receipt.receiptId);
            setReturns(res.data ?? []);
        } catch (error) {
            console.error('신고 이력 조회 실패:', error);
            window.alert('신고 이력을 불러오는 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [receipt.receiptId]);

    useEffect(() => {
        loadReturns();
    }, [loadReturns]);

    // 하단 신규 등록 폼 초기화 및 기본 잔여수량 반영
    const resetNewForm = () => {
        setNewReturnQtyInput(remainingQty);
        setNewReportDateInput('');
        setNewReturnDueDateInput('');
        setNewProcessStatusInput('신고완료');
    };

    useEffect(() => {
        if (!isLoading) {
            setNewReturnQtyInput(remainingQty);
        }
    }, [isLoading, remainingQty]);

    // 위쪽 행 수정 모드 진입
    const handleStartEditReturn = (item: SeedGoodsReceiptReturnResponse) => {
        setEditingReturnId(item.returnId);
        setEditReturnQtyInput(item.returnQty);
        setEditReportDateInput(item.reportDate);
        setEditReturnDueDateInput(item.returnDueDate ?? '');
        setEditProcessStatusInput((item.processStatus as ProcessStatus) ?? '신고완료');
    };

    // 위쪽 행 수정 취소
    const handleCancelEditReturn = () => {
        setEditingReturnId(null);
    };

    // 위쪽 행 수정 저장
    const handleUpdateReturn = async (item: SeedGoodsReceiptReturnResponse) => {
        if (isSaving) return;

        const qty = Number(editReturnQtyInput) || 0;
        if (qty <= 0) {
            window.alert('신고(반납) 수량을 입력해주세요.');
            return;
        }
        const maxAllowedQty = remainingQty; 
        if (qty > maxAllowedQty) {
            window.alert('잔여수량을 넘어서 수정할 수 없습니다.');
            return;
        }
        if (!editReportDateInput) {
            window.alert('신고일자를 입력해주세요.');
            return;
        }

        setIsSaving(true);
        try {
            const payload: SeedGoodsReceiptReturnUpdateRequest = {
                returnQty: qty,
                processStatus: editProcessStatusInput,
                reportDate: editReportDateInput,
                returnDueDate: editReturnDueDateInput,
            };
            const res = await SeedGoodsReceiptReturnApi.update(receipt.receiptId, item.returnId, payload);
            window.alert(res.message || '수정되었습니다.');

            setEditingReturnId(null);
            await loadReturns();
            onChanged();
        } catch (error) {
            console.error('신고 이력 수정 실패:', error);
            const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
            window.alert(message || '수정에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    // 위쪽 행 삭제
    const handleDeleteReturn = async (item: SeedGoodsReceiptReturnResponse) => {
        if (isDeletingId) return;
        const confirmed = window.confirm('이 신고 이력을 삭제하시겠습니까?');
        if (!confirmed) return;

        setIsDeletingId(item.returnId);
        try {
            await SeedGoodsReceiptReturnApi.delete(receipt.receiptId, item.returnId);
            window.alert('삭제되었습니다.');
            if (editingReturnId === item.returnId) {
                setEditingReturnId(null);
            }
            await loadReturns();
            onChanged();
        } catch (error) {
            console.error('신고 이력 삭제 실패:', error);
            const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
            window.alert(message || '삭제에 실패했습니다.');
        } finally {
            setIsDeletingId(null);
        }
    };

    // 하단 '이번 신고 등록' 처리
    const handleCreateSubmit = async () => {
        if (isSaving) return;

        const qty = Number(newReturnQtyInput) || 0;
        if (qty <= 0) {
            window.alert('신고(반납) 수량을 입력해주세요.');
            return;
        }
        if (qty > remainingQty) {
            window.alert('잔여수량을 넘으면 등록할 수 없습니다. 남은 수량은 다음 신고로 이어서 처리하세요.');
            return;
        }
        if (!newReportDateInput) {
            window.alert('신고일자를 입력해주세요.');
            return;
        }

        setIsSaving(true);
        try {
            const payload: SeedGoodsReceiptReturnCreateRequest = {
                returnQty: qty,
                processStatus: newProcessStatusInput,
                reportDate: newReportDateInput,
                returnDueDate: newReturnDueDateInput,
            };
            const res = await SeedGoodsReceiptReturnApi.create(receipt.receiptId, payload);
            window.alert(res.message || '등록되었습니다.');

            resetNewForm();
            await loadReturns();
            onChanged();
        } catch (error) {
            console.error('신고 등록 실패:', error);
            const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
            window.alert(message || '저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    // CusTable용 컬럼 정의
    const columns: ColumnDef<SeedGoodsReceiptReturnResponse>[] = [
        {
            accessorKey: 'returnQty',
            header: '신고(반납)수량',
            cell: ({ row }) => {
                const item = row.original;
                const isEditing = editingReturnId === item.returnId;

                if (isEditing) {
                    return (
                        <input
                            type="number"
                            value={editReturnQtyInput}
                            onChange={(e) => setEditReturnQtyInput(e.target.value === '' ? '' : Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    );
                }
                return (item.returnQty ?? 0).toLocaleString();
            },
            meta: { width: '110px' },
        },
        {
            accessorKey: 'reportDate',
            header: '신고일자',
            cell: ({ row }) => {
                const item = row.original;
                const isEditing = editingReturnId === item.returnId;

                if (isEditing) {
                    return (
                        <input
                            type="date"
                            value={editReportDateInput}
                            onChange={(e) => setEditReportDateInput(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    );
                }
                return item.reportDate || '-';
            },
            meta: { width: '120px' },
        },
        {
            accessorKey: 'returnDueDate',
            header: '반납예정일',
            cell: ({ row }) => {
                const item = row.original;
                const isEditing = editingReturnId === item.returnId;

                if (isEditing) {
                    return (
                        <input
                            type="date"
                            value={editReturnDueDateInput}
                            onChange={(e) => setEditReturnDueDateInput(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    );
                }
                return item.returnDueDate || '-';
            },
            meta: { width: '120px' },
        },
        {
            accessorKey: 'processStatus',
            header: '처리상태',
            cell: ({ row }) => {
                const item = row.original;
                const isEditing = editingReturnId === item.returnId;

                if (isEditing) {
                    return (
                        <select
                            value={editProcessStatusInput}
                            onChange={(e) => setEditProcessStatusInput(e.target.value as ProcessStatus)}
                            style={{ width: '100%' }}
                        >
                            {PROCESS_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    );
                }
                return item.processStatus;
            },
            meta: { width: '100px' },
        },
        {
            id: 'actions',
            header: '관리',
            enableSorting: false,
            cell: ({ row }) => {
                const item = row.original;
                const isEditing = editingReturnId === item.returnId;

                return (
                    <div className="rowActions" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                            <>
                                <button
                                    type="button"
                                    className="miniButton primary"
                                    onClick={() => handleUpdateReturn(item)}
                                    disabled={isSaving}
                                >
                                    {isSaving ? '저장 중' : '저장'}
                                </button>
                                <button
                                    type="button"
                                    className="miniButton secondary"
                                    onClick={handleCancelEditReturn}
                                    disabled={isSaving}
                                >
                                    취소
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="miniButton"
                                    onClick={() => handleStartEditReturn(item)}
                                    disabled={isSaving || isDeletingId !== null}
                                >
                                    수정
                                </button>
                                <button
                                    type="button"
                                    className="miniButton danger"
                                    onClick={() => handleDeleteReturn(item)}
                                    disabled={isSaving || isDeletingId !== null}
                                >
                                    {isDeletingId === item.returnId ? '삭제 중' : '삭제'}
                                </button>
                            </>
                        )}
                    </div>
                );
            },
            meta: { width: '120px' },
        },
    ];

    return (
        <div className="reportModalOverlay" onClick={onClose}>
            <div className="reportModalContent" onClick={(e) => e.stopPropagation()}>
                <div className="reportModalHeader">
                    <div>
                        <h3>신고처리</h3>
                        <p className="reportModalSubtitle">
                            입고 #{receipt.receiptId} · {receipt.itemNm}({receipt.itemCode}) · 양품 {goodQty}
                        </p>
                    </div>
                    <button type="button" className="reportModalCloseBtn" onClick={onClose} aria-label="닫기">
                        ×
                    </button>
                </div>

                <div className="reportModalBody">
                    <div className="reportSectionLabel">신고 이력</div>

                    {isLoading ? (
                        <div style={{ minHeight: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Spinner />
                        </div>
                    ) : (
                        <>
                            <CusTable
                                data={returns}
                                columns={columns}
                                noDataMessage="아직 등록된 신고 이력이 없습니다."
                            />

                            <div className="remainingQtyBox">
                                <span>신고 가능 잔여수량</span>
                                <strong>
                                    {remainingQty.toLocaleString()} / {goodQty.toLocaleString()}
                                </strong>
                            </div>

                            {/* 하단 '이번 신고 등록' 영역 */}
                            {isFullyReported ? (
                                <div className="reportCompleteNotice">전체 양품수량에 대한 신고 처리가 모두 완료되었습니다.</div>
                            ) : (
                                <div className="reportForm">
                                    <div className="reportFormRow">
                                        <div className="reportFormField">
                                            <label>이번 신고(반납) 수량</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={remainingQty}
                                                value={newReturnQtyInput}
                                                onChange={(e) => {
                                                    setNewReturnQtyInput(e.target.value === '' ? '' : Number(e.target.value));
                                                }}
                                            />
                                            <p className="reportFormHint">
                                                잔여수량을 넘으면 등록할 수 없습니다.
                                            </p>
                                        </div>
                                        <div className="reportFormField">
                                            <label>처리상태</label>
                                            <select
                                                value={newProcessStatusInput}
                                                onChange={(e) => {
                                                    setNewProcessStatusInput(e.target.value as ProcessStatus);
                                                }}
                                            >
                                                {PROCESS_STATUS_OPTIONS.map((status) => (
                                                    <option key={status} value={status}>
                                                        {status}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="reportFormRow">
                                        <div className="reportFormField">
                                            <label>신고일자</label>
                                            <input
                                                type="date"
                                                value={newReportDateInput}
                                                onChange={(e) => {
                                                    setNewReportDateInput(e.target.value);
                                                }}
                                            />
                                        </div>
                                        <div className="reportFormField">
                                            <label>반납예정일</label>
                                            <input
                                                type="date"
                                                value={newReturnDueDateInput}
                                                onChange={(e) => {
                                                    setNewReturnDueDateInput(e.target.value);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="reportModalFooter">
                    <button type="button" className="modalButton secondary" onClick={onClose} disabled={isSaving || isLoading}>
                        닫기
                    </button>
                    {!isFullyReported && !isLoading && (
                        <button type="button" className="modalButton primary" onClick={handleCreateSubmit} disabled={isSaving || isLoading}>
                            {isSaving ? '저장 중' : '이번 신고 등록'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}