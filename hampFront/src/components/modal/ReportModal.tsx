import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { type ColumnDef } from '@tanstack/react-table';
import { CusTable } from '@/components/table/CusTable';
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
    onChanged: () => void;
}

const PROCESS_STATUS_OPTIONS = ['신고완료', '반납예정', '반납완료'] as const;
type ProcessStatus = (typeof PROCESS_STATUS_OPTIONS)[number];

export function ReportModal({ receipt, onClose, onChanged }: ReportModalProps) {
    const [returns, setReturns] = useState<SeedGoodsReceiptReturnResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

    // --- 1. 수정 모드 상태 ---
    const [editingReturnId, setEditingReturnId] = useState<number | null>(null);
    
    const editFormRef = useRef<{
        returnQty: number | '';
        reportDate: string;
        returnDueDate: string;
        processStatus: ProcessStatus;
    }>({
        returnQty: '',
        reportDate: '',
        returnDueDate: '',
        processStatus: '신고완료',
    });

    // --- 2. 하단 신규 등록 모드 상태 ---
    const [newReturnQtyInput, setNewReturnQtyInput] = useState<number | ''>('');
    const [newReportDateInput, setNewReportDateInput] = useState<string>('');
    const [newReturnDueDateInput, setNewReturnDueDateInput] = useState<string>('');
    const [newProcessStatusInput, setNewProcessStatusInput] = useState<ProcessStatus>('신고완료');

    const goodQty = receipt.goodQty ?? 0;

    // 총 신고된 수량 합계
    const reportedTotal = returns.reduce((sum, r) => sum + (r.returnQty ?? 0), 0);

    // 현재 수정 중인 항목의 원래 수량
    const editingItem = returns.find((r) => r.returnId === editingReturnId);
    const editingOriginalQty = editingItem?.returnQty ?? 0;

    // 잔여 수량 계산
    const remainingQty = Math.max(goodQty - reportedTotal + (editingReturnId ? editingOriginalQty : 0), 0);

    // 전체 신고 완료 여부 판정
    const isFullyReported = reportedTotal >= goodQty;

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

    // 하단 폼 기본값 세팅
    useEffect(() => {
        if (!isLoading && editingReturnId === null) {
            const currentRemaining = Math.max(goodQty - reportedTotal, 0);
            setNewReturnQtyInput(currentRemaining);
        }
    }, [isLoading, goodQty, reportedTotal, editingReturnId]);

    // 수정 시작 시 useRef에 초기값을 세팅해 줍니다.
    const handleStartEditReturn = (item: SeedGoodsReceiptReturnResponse) => {
        setEditingReturnId(item.returnId);
        editFormRef.current = {
            returnQty: item.returnQty ?? '',
            reportDate: item.reportDate ?? '',
            returnDueDate: item.returnDueDate ?? '',
            processStatus: (item.processStatus as ProcessStatus) ?? '신고완료',
        };
    };

    const handleCancelEditReturn = () => {
        setEditingReturnId(null);
    };

    const handleUpdateReturn = async (item: SeedGoodsReceiptReturnResponse) => {
        if (isSaving) return;

        // state가 아닌 ref에서 값을 가져와 검증 및 페이로드 생성에 사용합니다.
        const qty = Number(editFormRef.current.returnQty) || 0;
        if (qty <= 0) {
            window.alert('신고(반납) 수량을 입력해주세요.');
            return;
        }

        // 전체 양품수 - (나를 제외한 다른 항목들의 총 신고 수량)
        const otherRowsTotal = returns
            .filter((r) => r.returnId !== item.returnId)
            .reduce((sum, r) => sum + (r.returnQty ?? 0), 0);

        const maxAllowedQty = goodQty - otherRowsTotal;

        if (qty > maxAllowedQty) {
            window.alert(`수정 가능한 최대 수량(${maxAllowedQty}개)을 초과할 수 없습니다.`);
            return;
        }

        if (!editFormRef.current.reportDate) {
            window.alert('신고일자를 입력해주세요.');
            return;
        }

        setIsSaving(true);
        try {
            const payload: SeedGoodsReceiptReturnUpdateRequest = {
                returnQty: qty,
                processStatus: editFormRef.current.processStatus,
                reportDate: editFormRef.current.reportDate,
                returnDueDate: editFormRef.current.returnDueDate,
            };
            
            console.log("전송하는 수정 Payload:", payload); // 디버깅용 로그

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

    const handleCreateSubmit = async () => {
        if (isSaving) return;

        const currentRemaining = Math.max(goodQty - reportedTotal, 0);
        const qty = Number(newReturnQtyInput) || 0;
        if (qty <= 0) {
            window.alert('신고(반납) 수량을 입력해주세요.');
            return;
        }
        if (qty > currentRemaining) {
            window.alert('잔여수량을 넘으면 등록할 수 없습니다.');
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

            setNewReportDateInput('');
            setNewReturnDueDateInput('');
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

    const columns = useMemo<ColumnDef<SeedGoodsReceiptReturnResponse>[]>(
        () => [
            {
                accessorKey: 'returnQty',
                header: '신고(반납)수량',
                enableSorting: false,
                cell: ({ row }) => {
                    const item = row.original;
                    const isEditing = editingReturnId === item.returnId;

                    if (isEditing) {
                        return (
                            <input
                                type="number"
                                // value 대신 defaultValue를 사용하고, onChange에서 ref 값을 바로 갱신하여 리렌더링 방지
                                defaultValue={editFormRef.current.returnQty}
                                onChange={(e) => {
                                    editFormRef.current.returnQty = e.target.value === '' ? '' : Number(e.target.value);
                                }}
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
                enableSorting: false,
                cell: ({ row }) => {
                    const item = row.original;
                    const isEditing = editingReturnId === item.returnId;

                    if (isEditing) {
                        return (
                            <input
                                type="date"
                                // defaultValue 및 ref 값 직접 갱신 적용
                                defaultValue={editFormRef.current.reportDate}
                                onChange={(e) => {
                                    editFormRef.current.reportDate = e.target.value;
                                }}
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
                enableSorting: false,
                cell: ({ row }) => {
                    const item = row.original;
                    const isEditing = editingReturnId === item.returnId;

                    if (isEditing) {
                        return (
                            <input
                                type="date"
                                // defaultValue 및 ref 값 직접 갱신 적용
                                defaultValue={editFormRef.current.returnDueDate}
                                onChange={(e) => {
                                    editFormRef.current.returnDueDate = e.target.value;
                                }}
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
                enableSorting: false,
                cell: ({ row }) => {
                    const item = row.original;
                    const isEditing = editingReturnId === item.returnId;

                    if (isEditing) {
                        return (
                            <select
                                // defaultValue 및 ref 값 직접 갱신 적용
                                defaultValue={editFormRef.current.processStatus}
                                onChange={(e) => {
                                    editFormRef.current.processStatus = e.target.value as ProcessStatus;
                                }}
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
        ],
        // useMemo 의존성 배열에서 불필요한 개별 input state 변수들을 제거하고 editingReturnId와 저장 상태 위주로만 관리
        [editingReturnId, isSaving, isDeletingId]
    );

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
                                    {Math.max(goodQty - reportedTotal, 0).toLocaleString()} / {goodQty.toLocaleString()}
                                </strong>
                            </div>

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