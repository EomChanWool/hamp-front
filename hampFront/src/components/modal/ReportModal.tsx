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

    // 신규 등록 폼 기본값 세팅 (잔여 수량 자동 반영)
    useEffect(() => {
        if (!isLoading && editingReturnId === null) {
            const currentRemaining = Math.max(goodQty - reportedTotal, 0);
            setNewReturnQtyInput(currentRemaining);
        }
    }, [isLoading, goodQty, reportedTotal, editingReturnId]);

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

        const qty = Number(editFormRef.current.returnQty) || 0;
        if (qty <= 0) {
            window.alert('신고(반납) 수량을 입력해주세요.');
            return;
        }

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
                header: '신고(반납) 수량',
                enableSorting: false,
                cell: ({ row }) => {
                    const item = row.original;
                    const isEditing = editingReturnId === item.returnId;
                    if (isEditing) {
                        return (
                            <input
                                type="number"
                                className="modalTableInput"
                                defaultValue={editFormRef.current.returnQty}
                                onChange={(e) => {
                                    editFormRef.current.returnQty = e.target.value === '' ? '' : Number(e.target.value);
                                }}
                            />
                        );
                    }
                    return (item.returnQty ?? 0).toLocaleString();
                },
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
                                className="modalTableInput"
                                defaultValue={editFormRef.current.reportDate}
                                onChange={(e) => {
                                    editFormRef.current.reportDate = e.target.value;
                                }}
                            />
                        );
                    }
                    return item.reportDate || '-';
                },
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
                                className="modalTableInput"
                                defaultValue={editFormRef.current.returnDueDate}
                                onChange={(e) => {
                                    editFormRef.current.returnDueDate = e.target.value;
                                }}
                            />
                        );
                    }
                    return item.returnDueDate || '-';
                },
            },
            {
                accessorKey: 'processStatus',
                header: '상태',
                enableSorting: false,
                cell: ({ row }) => {
                    const item = row.original;
                    const isEditing = editingReturnId === item.returnId;
                    if (isEditing) {
                        return (
                            <select
                                className="modalTableSelect"
                                defaultValue={editFormRef.current.processStatus}
                                onChange={(e) => {
                                    editFormRef.current.processStatus = e.target.value as ProcessStatus;
                                }}
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
            },
        ],
        [editingReturnId, isSaving, isDeletingId]
    );

    const percentage = goodQty > 0 ? Math.round((reportedTotal / goodQty) * 100) : 0;

    return (
        <div className="reportModalOverlay" onClick={onClose}>
            <div className="reportModalContent customModalSize" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                
                {/* 모달 전체 스피너 오버레이 (isLoading 또는 isSaving 시 작동) */}
                {(isLoading || isSaving) && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999,
                        borderRadius: 'inherit'
                    }}>
                        <Spinner />
                    </div>
                )}

                {/* 상단 헤더 */}
                <div className="reportModalHeader">
                    <div>
                        <h3>신고(반납) 처리 및 이력 관리<span className="badge"> 입고 #{receipt.receiptId}</span></h3>
                        <p className="reportModalSubtitle">
                            품목: {receipt.itemNm} ({receipt.itemCode}) · 총 양품 수량: {goodQty.toLocaleString()}
                           
                        </p>
                    </div>
                    <button type="button" className="reportModalCloseBtn" onClick={onClose} aria-label="닫기">
                        ✕
                    </button>
                </div>

                {/* 본문 레이아웃 (좌우 2단 분할) */}
                <div className="reportModalBody">
                    
                    {/* 좌측 영역: 잔여 수량 카드 + 입력 폼 또는 완료 안내 */}
                    <div className="reportModalLeftCol">
                        
                        {/* 1. 잔여 수량 표시 카드 */}
                        <div className="remainingQtyCard">
                            <div className="remainingQtyCardHeader">
                                <span className="remainingQtyLabel">신고 가능 잔여수량</span>
                                <span className={`remainingQtyPercent ${isFullyReported ? 'complete' : ''}`}>
                                    {isFullyReported ? '완료 100%' : `${percentage}% 남음`}
                                </span>
                            </div>
                            <div className="remainingQtyValueArea">
                                {Math.max(goodQty - reportedTotal, 0).toLocaleString()} 
                                <span className="remainingQtyTotal"> / {goodQty.toLocaleString()} 건</span>
                            </div>
                            {/* 프로그레스 바 */}
                            <div className="progressBarTrack">
                                <div className="progressBarFill" style={{ width: `${Math.min(percentage, 100)}%` }} />
                            </div>
                        </div>

                        {/* 2. 완료 상태 또는 신고 등록 폼 */}
                        {isFullyReported ? (
                            <div className="completeNoticeBox">
                                <div className="completeNoticeIcon">✅</div>
                                <h4 className="completeNoticeTitle">모든 신고 처리가 완료되었습니다</h4>
                                <p className="completeNoticeDesc">
                                    입고된 양품 {goodQty}건에 대한 반납 및 신고 내역이 모두 등록되었습니다.<br />
                                    수정이나 삭제는 우측 이력 목록에서 가능합니다.
                                </p>
                            </div>
                        ) : (
                            <div className="reportForm">
                                <div className="reportFormHeader">
                                    <label className="reportFormLabel">이번 신고(반납) 수량 *</label>
                                    <button 
                                        type="button" 
                                        className="setMaxBtn"
                                        onClick={() => setNewReturnQtyInput(Math.max(goodQty - reportedTotal, 0))}
                                    >
                                       잔여 전체 ({Math.max(goodQty - reportedTotal, 0)})
                                    </button>
                                </div>
                                <input
                                    type="number"
                                    className="reportFormInput"
                                    min={1}
                                    max={remainingQty}
                                    value={newReturnQtyInput}
                                    placeholder="수량을 입력하세요"
                                    onChange={(e) => {
                                        setNewReturnQtyInput(e.target.value === '' ? '' : Number(e.target.value));
                                    }}
                                />
                                <p className="reportFormHelper">
                                    잔여수량({Math.max(goodQty - reportedTotal, 0)})을 초과하여 등록할 수 없습니다.
                                </p>

                                <div>
                                    <label className="reportFormInputLabel">처리상태 *</label>
                                    <select
                                        className="reportFormSelect"
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

                                <div className="reportFormDateRow">
                                    <div className="reportFormDateItem">
                                        <label className="reportFormSubLabel">신고일자</label>
                                        <input
                                            type="date"
                                            className="reportFormInput"
                                            value={newReportDateInput}
                                            onChange={(e) => setNewReportDateInput(e.target.value)}
                                        />
                                    </div>
                                    <div className="reportFormDateItem">
                                        <label className="reportFormSubLabel">반납예정일</label>
                                        <input
                                            type="date"
                                            className="reportFormInput"
                                            value={newReturnDueDateInput}
                                            onChange={(e) => setNewReturnDueDateInput(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="submitReportBtn"
                                    onClick={handleCreateSubmit}
                                    disabled={isSaving || isLoading}
                                >
                                    {isSaving ? '저장 중...' : '+ 이번 신고 등록하기'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 우측 영역: 신고 이력 목록 테이블 */}
                    <div className="reportModalRightCol">
                        <div className="historyHeader">
                            <span className="historyTitle">신고 이력 목록</span>
                            <span className="historyCount">총 {returns.length}건</span>
                        </div>

                        <CusTable
                            data={returns}
                            columns={columns}
                            noDataMessage="아직 등록된 신고 이력이 없습니다."
                        />

                        {/* 안내 문구 */}
                        <div className="historyTipBox">
                         신고 내역 수정 및 삭제 시 <strong>신고가능 잔여수량</strong>이 즉시 재계산되어 업데이트됩니다.
                        </div>
                    </div>
                </div>

                {/* 하단 모달 닫기 버튼 영역 */}
                <div className="reportModalFooter">
                    <button type="button" className="modalButton secondary modalCloseFooterBtn" onClick={onClose} disabled={isSaving || isLoading}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}