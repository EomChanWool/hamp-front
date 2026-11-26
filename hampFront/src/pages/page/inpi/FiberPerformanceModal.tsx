import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/common/Badge'
import { NumberInput } from '@/components/common/NumberInput'
import Spinner from '@/components/common/Spinner'
import {
  FiberWorkOrderApi,
  type FiberInputReceiptResponse,
  type FiberWorkOrderDetailResponse,
} from '@/api/FiberWorkOrder'
import {
  FiberWorkPerformanceApi,
  type FiberWorkPerformanceResponse,
} from '@/api/inpi/FiberWorkPerformance'
import { formatKg, formatNum } from '@/pages/page/inpi/inpiPerfUtils'
import { FIBER_WO_STATUS_LABEL, FIBER_WO_STATUS_TONE, getErrorMessage } from '@/utils/fiberWorkOrder'
import type { StatusTone } from '@/types'
import { formatDateTime } from '@/utils/common'
import { todayString } from '@/utils/fiberSalesOrderAllocation'

type ModalMode = 'view' | 'create' | 'edit'
type FormField = 'productItemCode' | 'inputs' | 'outputQty' | 'residueQty' | 'workDate'
type FormErrors = Partial<Record<FormField, string>>

interface FiberPerformanceModalProps {
  initialMode: ModalMode
  /** create 모드에서는 필수, view/edit 모드에서는 없으면 필요 시 조회 */
  initialWorkOrderDetail?: FiberWorkOrderDetailResponse | null
  performance?: FiberWorkPerformanceResponse | null
  onClose: () => void
  onSaved: () => void
}

export function FiberPerformanceModal({
  initialMode,
  initialWorkOrderDetail = null,
  performance = null,
  onClose,
  onSaved,
}: FiberPerformanceModalProps) {
  const [mode, setMode] = useState<ModalMode>(initialMode)
  const [editFetchResult, setEditFetchResult] = useState<{
    key: string
    receipts: FiberInputReceiptResponse[]
    detail: FiberWorkOrderDetailResponse | null
    error: string | null
  } | null>(null)

  const today = todayString()
  const [productItemCode, setProductItemCode] = useState(
    initialMode === 'edit' && performance ? performance.productItemCode : '',
  )
  const [lotInputs, setLotInputs] = useState<Record<number, number | null>>(() => {
    if (initialMode === 'edit' && performance) {
      return Object.fromEntries(performance.inputs.map((inp) => [inp.receiptId, inp.inputQty]))
    }
    return {}
  })
  const [outputQty, setOutputQty] = useState<number | null>(
    initialMode === 'edit' && performance ? performance.outputQty : null,
  )
  const [residueQty, setResidueQty] = useState<number | null>(
    initialMode === 'edit' && performance ? performance.residueQty : null,
  )
  const [workDate, setWorkDate] = useState(
    initialMode === 'edit' && performance ? performance.workDate : today,
  )
  const [note, setNote] = useState(initialMode === 'edit' && performance ? (performance.note ?? '') : '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [initialSnapshot, setInitialSnapshot] = useState(() => ({
    productItemCode: initialMode === 'edit' && performance ? performance.productItemCode : '',
    lotInputs:
      initialMode === 'edit' && performance
        ? Object.fromEntries(performance.inputs.map((inp) => [inp.receiptId, inp.inputQty]))
        : ({} as Record<number, number | null>),
    outputQty: initialMode === 'edit' && performance ? performance.outputQty : null,
    residueQty: initialMode === 'edit' && performance ? performance.residueQty : null,
    workDate: initialMode === 'edit' && performance ? performance.workDate : today,
    note: initialMode === 'edit' && performance ? (performance.note ?? '') : '',
  }))

  const outputRef = useRef<HTMLInputElement>(null)
  const residueRef = useRef<HTMLInputElement>(null)
  const workDateRef = useRef<HTMLInputElement>(null)
  const firstProductBtnRef = useRef<HTMLButtonElement>(null)
  const firstLotInputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)

  const baseWorkId = initialWorkOrderDetail?.workOrder.workId ?? performance?.workId ?? ''
  const editFetchKey = mode !== 'view' && baseWorkId ? `${mode}:${baseWorkId}` : null
  const needsDetailFetch = !initialWorkOrderDetail || initialWorkOrderDetail.products.length === 0
  const isLoadingEditData = editFetchKey !== null && editFetchResult?.key !== editFetchKey
  const inputReceipts = useMemo(
    () => (editFetchKey !== null && editFetchResult?.key === editFetchKey ? editFetchResult.receipts : []),
    [editFetchKey, editFetchResult],
  )
  const loadError = editFetchKey !== null && editFetchResult?.key === editFetchKey ? editFetchResult.error : null
  const workOrderDetail =
    editFetchResult?.key === editFetchKey && editFetchResult.detail
      ? editFetchResult.detail
      : initialWorkOrderDetail

  const workId = workOrderDetail?.workOrder.workId ?? performance?.workId ?? ''
  const workStatus = workOrderDetail?.workOrder.status ?? performance?.workStatus ?? ''
  const bpNm = workOrderDetail?.workOrder.bpNm ?? performance?.bpNm ?? '-'
  const startAt = workOrderDetail?.workOrder.startAt ?? null
  const startDate = startAt ? startAt.slice(0, 10) : ''

  useEffect(() => {
    mountedRef.current = true
    const prevFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      mountedRef.current = false
      if (prevFocused?.isConnected) prevFocused.focus()
    }
  }, [])

  // 추가/수정 모드 진입 시 투입 가능 원물 LOT 목록 (및 제품 정보가 없는 경우 작업지시 상세) 로드
  useEffect(() => {
    if (!editFetchKey || !baseWorkId) return
    let ignore = false

    const receiptsPromise = FiberWorkOrderApi.getInputReceipts(baseWorkId)
    const detailPromise = needsDetailFetch ? FiberWorkOrderApi.getDetail(baseWorkId) : Promise.resolve(null)

    Promise.all([receiptsPromise, detailPromise])
      .then(([receiptsRes, detailRes]) => {
        if (ignore) return
        setEditFetchResult({
          key: editFetchKey,
          receipts: receiptsRes.data ?? [],
          detail: detailRes?.data ?? null,
          error: null,
        })
      })
      .catch((error) => {
        if (ignore) return
        console.error('실적 입력 데이터 조회 실패:', error)
        setEditFetchResult({
          key: editFetchKey,
          receipts: [],
          detail: null,
          error: getErrorMessage(error, '원물 LOT 정보를 불러오지 못했습니다.'),
        })
      })

    return () => {
      ignore = true
    }
  }, [editFetchKey, baseWorkId, needsDetailFetch])

  // 수정 중인 실적 줄이 기존에 투입했던 LOT별 중량 (수정 시 투입 가능 상한 계산용)
  const ownInputMap = useMemo(() => {
    const map = new Map<number, number>()
    if (mode === 'edit' && performance) {
      for (const inp of performance.inputs) {
        map.set(inp.receiptId, (map.get(inp.receiptId) ?? 0) + Number(inp.inputQty ?? 0))
      }
    }
    return map
  }, [mode, performance])

  const receiptAllowanceMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of inputReceipts) {
      const own = ownInputMap.get(r.receiptId) ?? 0
      map.set(r.receiptId, Math.round((Number(r.remainingQty ?? 0) + own) * 100) / 100)
    }
    return map
  }, [inputReceipts, ownInputMap])

  const totalInputQty = useMemo(
    () =>
      Object.values(lotInputs).reduce<number>(
        (sum, val) => sum + (val != null && val > 0 ? val : 0),
        0,
      ),
    [lotInputs],
  )

  const isDirty = useMemo(() => {
    if (mode === 'view') return false
    const init = initialSnapshot
    if (
      productItemCode !== init.productItemCode ||
      outputQty !== init.outputQty ||
      residueQty !== init.residueQty ||
      workDate !== init.workDate ||
      note !== init.note
    ) {
      return true
    }
    const keys = new Set([...Object.keys(lotInputs), ...Object.keys(init.lotInputs)])
    for (const k of keys) {
      const id = Number(k)
      if ((lotInputs[id] ?? null) !== (init.lotInputs[id] ?? null)) return true
    }
    return false
  }, [mode, initialSnapshot, productItemCode, lotInputs, outputQty, residueQty, workDate, note])

  const isBusy = isSaving || isDeleting

  const handleClose = () => {
    if (isBusy) return
    onClose()
  }

  const handleDismiss = () => {
    if (isBusy) return
    if (isDirty && !window.confirm('작성 중인 내용을 취소할까요?')) return
    onClose()
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const enterEditMode = () => {
    if (!performance) return
    const nextLotInputs = Object.fromEntries(performance.inputs.map((inp) => [inp.receiptId, inp.inputQty]))
    setProductItemCode(performance.productItemCode)
    setLotInputs(nextLotInputs)
    setOutputQty(performance.outputQty)
    setResidueQty(performance.residueQty)
    setWorkDate(performance.workDate)
    setNote(performance.note ?? '')
    setErrors({})
    setInitialSnapshot({
      productItemCode: performance.productItemCode,
      lotInputs: nextLotInputs,
      outputQty: performance.outputQty,
      residueQty: performance.residueQty,
      workDate: performance.workDate,
      note: performance.note ?? '',
    })
    setMode('edit')
  }

  const clearFieldError = (field: FormField) => {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validateAll = (): FormErrors => {
    const next: FormErrors = {}
    if (!productItemCode) {
      next.productItemCode = '만든 제품을 선택해 주세요.'
    }

    const activeInputs = Object.entries(lotInputs)
      .map(([id, qty]) => ({ receiptId: Number(id), inputQty: qty }))
      .filter((item): item is { receiptId: number; inputQty: number } => item.inputQty != null && item.inputQty !== 0)

    if (activeInputs.length === 0) {
      next.inputs = '투입한 원물 LOT을 1개 이상 입력해 주세요.'
    } else {
      for (const item of activeInputs) {
        if (item.inputQty <= 0) {
          next.inputs = '투입 중량은 0보다 커야 합니다.'
          break
        }
        const allow = receiptAllowanceMap.get(item.receiptId)
        if (allow != null && item.inputQty > allow) {
          const lot = inputReceipts.find((r) => r.receiptId === item.receiptId)?.receiptLotCode ?? `#${item.receiptId}`
          next.inputs = `입고 LOT ${lot}의 투입 가능 중량(${formatNum(allow)} kg)을 초과했습니다.`
          break
        }
      }
    }

    if (outputQty == null) {
      next.outputQty = '실제 생산 중량을 입력해 주세요.'
    } else if (outputQty <= 0) {
      next.outputQty = '실제 생산 중량은 0보다 커야 합니다.'
    }

    if (residueQty != null && residueQty < 0) {
      next.residueQty = '잔재 중량은 0 이상이어야 합니다.'
    }

    const effectiveDate = workDate || today
    if (effectiveDate > today) {
      next.workDate = `작업일(${effectiveDate})은 미래일 수 없습니다.`
    } else if (startDate && effectiveDate < startDate) {
      next.workDate = `작업일(${effectiveDate})은 작업 시작일(${startDate})보다 빠를 수 없습니다.`
    }

    return next
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'view' || isBusy) return

    const nextErrors = validateAll()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      if (nextErrors.productItemCode) firstProductBtnRef.current?.focus()
      else if (nextErrors.inputs) firstLotInputRef.current?.focus()
      else if (nextErrors.outputQty) outputRef.current?.focus()
      else if (nextErrors.residueQty) residueRef.current?.focus()
      else if (nextErrors.workDate) workDateRef.current?.focus()
      return
    }
    if (outputQty == null) return

    const inputsPayload = Object.entries(lotInputs)
      .map(([id, qty]) => ({ receiptId: Number(id), inputQty: qty ?? 0 }))
      .filter((item) => item.inputQty > 0)

    const effectiveDate = workDate || today
    const trimmedNote = note.trim()

    setIsSaving(true)
    try {
      if (mode === 'create') {
        const res = await FiberWorkPerformanceApi.create({
          workId,
          productItemCode,
          workDate: effectiveDate,
          inputs: inputsPayload,
          outputQty,
          residueQty,
          note: trimmedNote || null,
        })
        if (!mountedRef.current) return
        const lot = res.data?.productLotCode
        window.alert(
          lot ? `실적 줄이 등록되었습니다. (제품 LOT: ${lot})` : res.message || '실적 줄이 등록되었습니다.',
        )
      } else if (performance) {
        const res = await FiberWorkPerformanceApi.update(performance.perfId, {
          productItemCode,
          workDate: effectiveDate,
          inputs: inputsPayload,
          outputQty,
          residueQty,
          note: trimmedNote || null,
        })
        if (!mountedRef.current) return
        window.alert(res.message || '실적 줄을 수정했습니다.')
      }
      onSaved()
    } catch (error) {
      if (!mountedRef.current) return
      console.error(mode === 'create' ? '섬유 실적 등록 실패:' : '섬유 실적 수정 실패:', error)
      window.alert(
        getErrorMessage(error, mode === 'create' ? '실적 줄 등록에 실패했습니다.' : '실적 줄 수정에 실패했습니다.'),
      )
    } finally {
      if (mountedRef.current) setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!performance || isBusy) return
    const confirmed = window.confirm(
      `${performance.productLotCode} 실적 줄을 삭제할까요?\n` +
        `원물 ${formatKg(performance.inputQty)}은 재고로 돌아가고 제품 ${formatKg(performance.outputQty)}은 재고에서 차감됩니다.`,
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      const res = await FiberWorkPerformanceApi.delete(performance.perfId)
      if (!mountedRef.current) return
      window.alert(res.message || '실적 줄을 삭제했습니다.')
      onSaved()
    } catch (error) {
      if (!mountedRef.current) return
      console.error('섬유 실적 삭제 실패:', error)
      window.alert(getErrorMessage(error, '실적 줄 삭제에 실패했습니다.'))
    } finally {
      if (mountedRef.current) setIsDeleting(false)
    }
  }

  const statusLabel = FIBER_WO_STATUS_LABEL[workStatus] ?? (workStatus || '-')
  const statusTone: StatusTone = FIBER_WO_STATUS_TONE[workStatus] ?? 'muted'
  const isLocked = workStatus !== 'IN_PROGRESS'
  const products = workOrderDetail?.products ?? []

  // 상세 보기 중량 구성 바 계산
  const viewInputQty = performance ? Number(performance.inputQty ?? 0) : 0
  const viewOutputQty = performance ? Number(performance.outputQty ?? 0) : 0
  const viewResidueQty = performance?.residueQty != null ? Number(performance.residueQty) : null
  const viewLossQty =
    viewResidueQty != null ? Math.round((viewInputQty - viewOutputQty - viewResidueQty) * 100) / 100 : null
  const pctOfInput = (val: number) => (viewInputQty > 0 ? Math.max(0, Math.min(100, (val / viewInputQty) * 100)) : 0)

  const modalTitle =
    mode === 'view' && performance
      ? `실적 줄 · ${performance.productLotCode}`
      : mode === 'edit' && performance
        ? `실적 줄 수정 · ${performance.productLotCode}`
        : '실적 줄 추가'

  return (
    <>
      <div className="modalOverlay" onClick={handleDismiss} />
      <form
        className="detailModal inpiPerfModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inpi-perf-modal-title"
        noValidate
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault()
          }
        }}
      >
        <div className="detailModalHeader">
          <div>
            <h3 id="inpi-perf-modal-title">{modalTitle}</h3>
          </div>
          <button
            type="button"
            className="detailModalClose"
            aria-label="닫기"
            disabled={isBusy}
            onClick={handleClose}
          >
            &times;
          </button>
        </div>

        <div className="inpiPerfModalBody">
          <dl className="inpiPerfReadGrid">
            <div>
              <dt>거래처</dt>
              <dd>{bpNm}</dd>
            </div>
            <div>
              <dt>작업지시</dt>
              <dd className="inpiPerfCode">{workId}</dd>
            </div>
            <div>
              <dt>상태{startAt ? ' · 시작' : ''}</dt>
              <dd className="inpiPerfStatusInline">
                <Badge tone={statusTone}>{statusLabel}</Badge>
                {startAt && <span className="inpiPerfMuted">{formatDateTime(startAt).slice(5)}</span>}
              </dd>
            </div>
          </dl>

          {mode === 'view' && performance ? (
            <>
              <dl className="inpiPerfReadGrid">
                <div>
                  <dt>제품</dt>
                  <dd>{performance.productItemNm || performance.productItemCode}</dd>
                </div>
                <div>
                  <dt>작업일</dt>
                  <dd>{performance.workDate}</dd>
                </div>
                <div>
                  <dt>작업자</dt>
                  <dd>{performance.registeredByNm || performance.registeredBy || '-'}</dd>
                </div>
                <div className="inpiPerfReadGrid__wide">
                  <dt>원물 투입 (LOT별)</dt>
                  <dd>
                    {performance.inputs.length > 0 ? (
                      performance.inputs.map((inp) => (
                        <span key={inp.receiptId} className="inpiPerfLotChip">
                          {inp.receiptLotCode} · {formatNum(inp.inputQty)} kg
                        </span>
                      ))
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>투입 합계</dt>
                  <dd>{formatKg(performance.inputQty)}</dd>
                </div>
                <div>
                  <dt>생산</dt>
                  <dd>{formatKg(performance.outputQty)}</dd>
                </div>
                <div>
                  <dt>잔재</dt>
                  <dd>{performance.residueQty == null ? '미계량' : formatKg(performance.residueQty)}</dd>
                </div>
                <div className="inpiPerfReadGrid__wide">
                  <dt>작업내용</dt>
                  <dd>{performance.note || '-'}</dd>
                </div>
              </dl>

              <div className="inpiPerfMassSection">
                <p className="inpiPerfSectionLabel">중량 구성</p>
                {(() => {
                  const outPct = pctOfInput(viewOutputQty)
                  const resPct = viewResidueQty != null ? pctOfInput(viewResidueQty) : 0
                  const unmeasuredRest = Math.max(0, viewInputQty - viewOutputQty)
                  const lossVal = viewResidueQty != null ? Math.max(0, viewLossQty ?? 0) : unmeasuredRest
                  const lossPct = pctOfInput(lossVal)
                  return (
                    <>
                      <div className="inpiPerfMassBar" aria-label="투입 중량 구성">
                        <span
                          className="inpiPerfMassBar__out"
                          style={{ width: `${outPct}%` }}
                          title={`생산 ${formatKg(viewOutputQty)} (${formatNum(outPct, 1)}%)`}
                        >
                          {outPct >= 14 ? `생산 ${formatNum(viewOutputQty, 1)}` : ''}
                        </span>
                        {viewResidueQty != null ? (
                          <>
                            <span
                              className="inpiPerfMassBar__res"
                              style={{ width: `${resPct}%` }}
                              title={`잔재 ${formatKg(viewResidueQty)} (${formatNum(resPct, 1)}%)`}
                            >
                              {resPct >= 10 ? '잔재' : ''}
                            </span>
                            <span
                              className="inpiPerfMassBar__loss"
                              style={{ width: `${lossPct}%` }}
                              title={`손실 ${formatKg(viewLossQty)} (${formatNum(lossPct, 1)}%)`}
                            >
                              {lossPct >= 10 ? '손실' : ''}
                            </span>
                          </>
                        ) : (
                          <span
                            className="inpiPerfMassBar__loss"
                            style={{ width: `${lossPct}%` }}
                            title={`잔재·손실 ${formatKg(unmeasuredRest)} (${formatNum(lossPct, 1)}%)`}
                          >
                            {lossPct >= 20
                              ? `잔재·손실 ${formatNum(unmeasuredRest, 1)}`
                              : lossPct >= 12
                                ? '잔재·손실'
                                : ''}
                          </span>
                        )}
                      </div>
                      <div className="inpiPerfMassLegend">
                        <span className="inpiPerfMassLegendItem">
                          <i className="inpiPerfMassSwatch is-out" />
                          생산 <b>{formatKg(viewOutputQty)}</b> ({formatNum(outPct, 1)}%)
                        </span>
                        {viewResidueQty != null ? (
                          <>
                            <span className="inpiPerfMassLegendItem">
                              <i className="inpiPerfMassSwatch is-res" />
                              잔재 <b>{formatKg(viewResidueQty)}</b> ({formatNum(resPct, 1)}%)
                            </span>
                            <span className="inpiPerfMassLegendItem">
                              <i className="inpiPerfMassSwatch is-loss" />
                              손실 <b>{formatKg(viewLossQty)}</b> ({formatNum(lossPct, 1)}%)
                            </span>
                          </>
                        ) : (
                          <span className="inpiPerfMassLegendItem">
                            <i className="inpiPerfMassSwatch is-loss" />
                            잔재·손실 <b>{formatKg(unmeasuredRest)}</b> ({formatNum(lossPct, 1)}%)
                          </span>
                        )}
                      </div>
                    </>
                  )
                })()}
                <p className="inpiPerfLegend">
                  {viewResidueQty != null
                    ? `투입 ${formatKg(viewInputQty)} = 생산 ${formatKg(viewOutputQty)} + 잔재 ${formatKg(viewResidueQty)} + 계량되지 않은 손실(먼지·수분 등) ${formatKg(viewLossQty)}`
                    : `잔재를 계량하지 않아 투입 ${formatKg(viewInputQty)} 중 생산 ${formatKg(viewOutputQty)}을 뺀 ${formatKg(Math.max(0, viewInputQty - viewOutputQty))}이 잔재와 손실을 합친 양입니다.`}
                </p>
              </div>

              {isLocked && (
                <div className="inpiPerfWarnNote">
                  작업지시가 {statusLabel} 상태라 이 줄을 고치거나 지울 수 없습니다. 고쳐야 하면 작업지시 화면에서 완료 취소 후 수정합니다.
                </div>
              )}
            </>
          ) : isLoadingEditData ? (
            <div className="inpiPerfModalLoading">
              <Spinner />
            </div>
          ) : loadError ? (
            <div className="inpiPerfErrorBox" role="alert">
              {loadError}
            </div>
          ) : (
            <div className="inpiPerfFormBody">
              <div className="inpiPerfField">
                <span className="inpiPerfLabel inpiPerfRequired">만든 제품</span>
                <div className="inpiPerfProdPick" role="group" aria-label="제품 선택">
                  {products.map((prod, idx) => {
                    const ownProductQty =
                      mode === 'edit' && performance && performance.productItemCode === prod.productItemCode
                        ? Number(performance.inputQty ?? 0)
                        : 0
                    const remainAlloc = Math.round((Number(prod.remainingQty ?? 0) + ownProductQty) * 100) / 100
                    return (
                      <button
                        key={prod.productItemCode}
                        ref={idx === 0 ? firstProductBtnRef : undefined}
                        type="button"
                        className="inpiPerfProdOpt"
                        aria-pressed={productItemCode === prod.productItemCode}
                        disabled={isBusy}
                        onClick={() => {
                          setProductItemCode(prod.productItemCode)
                          clearFieldError('productItemCode')
                        }}
                      >
                        <b>{prod.productItemNm || prod.productItemCode}</b>
                        <small>
                          배분 {formatNum(prod.allocatedQty, 1)} · 남은 {formatNum(remainAlloc, 1)} kg
                        </small>
                      </button>
                    )
                  })}
                </div>
                {errors.productItemCode && (
                  <span className="inpiPerfFieldError" role="alert">
                    {errors.productItemCode}
                  </span>
                )}
                <span className="inpiPerfHint">
                  수주에 배분된 제품만 나옵니다. 원료와 제품이 맞는지(표백 원료 → 표백 솜 등)는 직접 확인해 주세요.
                </span>
              </div>

              <div className="inpiPerfField">
                <span className="inpiPerfLabel inpiPerfRequired">
                  원물 투입 <span className="inpiPerfSubLabel">· 실제로 쓴 LOT에만 kg을 적습니다 (여러 LOT 가능)</span>
                </span>
                <div className="tableWrap">
                  <table className="inpiPerfLotTable">
                    <thead>
                      <tr>
                        <th>입고 LOT</th>
                        <th className="inpiPerfNum">입고량</th>
                        <th className="inpiPerfNum">남은 양</th>
                        <th className="inpiPerfNum">이번 투입</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputReceipts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="inpiPerfEmptyCell">
                            이 수주로 들어온 입고가 없습니다. 입고 후 실적을 남길 수 있습니다.
                          </td>
                        </tr>
                      ) : (
                        inputReceipts.map((r, idx) => {
                          const allow = receiptAllowanceMap.get(r.receiptId) ?? Number(r.remainingQty ?? 0)
                          const val = lotInputs[r.receiptId] ?? null
                          const isDisabled = allow <= 0 && (val == null || val === 0)
                          return (
                            <tr key={r.receiptId} className={val != null && val > 0 ? 'is-active' : undefined}>
                              <td>
                                <span className="inpiPerfCode">{r.receiptLotCode}</span>
                              </td>
                              <td className="inpiPerfNum">{formatKg(r.receiptQty)}</td>
                              <td className="inpiPerfNum">{formatKg(allow)}</td>
                              <td className="inpiPerfNum">
                                <NumberInput
                                  ref={idx === 0 ? firstLotInputRef : undefined}
                                  wrapClassName="inpiPerfSuffixWrap"
                                  className="tableInput"
                                  aria-label={`${r.receiptLotCode} 투입 중량`}
                                  aria-invalid={errors.inputs ? true : undefined}
                                  decimalScale={2}
                                  placeholder={allow <= 0 ? '소진' : '0'}
                                  disabled={isDisabled || isBusy}
                                  value={val}
                                  onValueChange={(next) => {
                                    setLotInputs((prev) => ({ ...prev, [r.receiptId]: next }))
                                    clearFieldError('inputs')
                                  }}
                                  suffix={<span>kg</span>}
                                />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}>투입 합계</td>
                        <td className="inpiPerfNum">{formatKg(totalInputQty)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {errors.inputs && (
                  <span className="inpiPerfFieldError" role="alert">
                    {errors.inputs}
                  </span>
                )}
              </div>

              <div className="inpiPerfFormGrid">
                <div className="inpiPerfField">
                  <label className="inpiPerfLabel inpiPerfRequired" htmlFor="inpi-perf-output">
                    생산 중량
                  </label>
                  <NumberInput
                    id="inpi-perf-output"
                    ref={outputRef}
                    wrapClassName="inpiPerfSuffixWrap"
                    className="tableInput"
                    aria-invalid={errors.outputQty ? true : undefined}
                    aria-describedby={errors.outputQty ? 'inpi-perf-err-output' : undefined}
                    decimalScale={2}
                    placeholder="0"
                    disabled={isBusy}
                    value={outputQty}
                    onValueChange={(next) => {
                      setOutputQty(next)
                      clearFieldError('outputQty')
                    }}
                    suffix={<span>kg</span>}
                  />
                  {errors.outputQty && (
                    <span id="inpi-perf-err-output" className="inpiPerfFieldError" role="alert">
                      {errors.outputQty}
                    </span>
                  )}
                </div>

                <div className="inpiPerfField">
                  <label className="inpiPerfLabel" htmlFor="inpi-perf-residue">
                    잔재 중량
                  </label>
                  <NumberInput
                    id="inpi-perf-residue"
                    ref={residueRef}
                    wrapClassName="inpiPerfSuffixWrap"
                    className="tableInput"
                    aria-invalid={errors.residueQty ? true : undefined}
                    aria-describedby={errors.residueQty ? 'inpi-perf-err-residue' : undefined}
                    decimalScale={2}
                    placeholder="미계량"
                    disabled={isBusy}
                    value={residueQty}
                    onValueChange={(next) => {
                      setResidueQty(next)
                      clearFieldError('residueQty')
                    }}
                    suffix={<span>kg</span>}
                  />
                  {errors.residueQty ? (
                    <span id="inpi-perf-err-residue" className="inpiPerfFieldError" role="alert">
                      {errors.residueQty}
                    </span>
                  ) : (
                    <span className="inpiPerfHint">계량하지 않았으면 비워 둡니다</span>
                  )}
                </div>

                <div className="inpiPerfField">
                  <label className="inpiPerfLabel" htmlFor="inpi-perf-date">
                    작업일
                  </label>
                  <input
                    id="inpi-perf-date"
                    ref={workDateRef}
                    type="date"
                    className="tableInput"
                    min={startDate || undefined}
                    max={today}
                    aria-invalid={errors.workDate ? true : undefined}
                    aria-describedby={errors.workDate ? 'inpi-perf-err-date' : undefined}
                    disabled={isBusy}
                    value={workDate}
                    onChange={(e) => {
                      setWorkDate(e.target.value)
                      clearFieldError('workDate')
                    }}
                  />
                  {errors.workDate ? (
                    <span id="inpi-perf-err-date" className="inpiPerfFieldError" role="alert">
                      {errors.workDate}
                    </span>
                  ) : (
                    <span className="inpiPerfHint">
                      {startDate ? `작업 시작일(${startDate})부터 오늘까지` : '비워 두면 오늘 날짜'}
                    </span>
                  )}
                </div>

                <div className="inpiPerfField inpiPerfField--full">
                  <label className="inpiPerfLabel" htmlFor="inpi-perf-note">
                    작업내용 · 특이사항
                  </label>
                  <textarea
                    id="inpi-perf-note"
                    className="tableInput"
                    rows={3}
                    maxLength={255}
                    placeholder="예) 솜 베일 1개(80×40×60), 카딩기 2호기"
                    disabled={isBusy}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              <p className="inpiPerfInfoNote">
                {mode === 'edit'
                  ? '저장하면 이 줄의 기존 재고 반영분을 되돌리고 수정한 값으로 다시 반영합니다. 제품 LOT 번호는 바뀌지 않습니다.'
                  : '저장하면 이 줄에 제품 LOT이 새로 발급됩니다(베일·캔 라벨용). 원물 재고는 투입 합계만큼 빠지고, 제품 재고는 생산량만큼 늘어납니다. 작업지시는 작업 중 그대로입니다.'}
              </p>
            </div>
          )}
        </div>

        <div className="detailModalFooter">
          {mode === 'view' ? (
            <>
              {!isLocked && (
                <button
                  type="button"
                  className="miniButton danger detailModalDangerAction"
                  disabled={isBusy}
                  onClick={() => void handleDelete()}
                >
                  {isDeleting ? '삭제 중...' : '이 줄 삭제'}
                </button>
              )}
              <div className="detailModalFooterRight">
                <button type="button" className="inpiPerfPlainBtn" disabled={isBusy} onClick={handleClose}>
                  닫기
                </button>
                {!isLocked && (
                  <button type="button" className="primaryButton" disabled={isBusy} onClick={enterEditMode}>
                    수정
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="detailModalFooterRight">
              <button type="button" className="inpiPerfPlainBtn" disabled={isBusy} onClick={handleClose}>
                닫기
              </button>
              <button
                type="submit"
                className="primaryButton"
                disabled={isBusy || isLoadingEditData || !!loadError}
              >
                {isSaving ? '저장 중...' : mode === 'edit' ? '수정 저장' : '실적 줄 저장'}
              </button>
            </div>
          )}
        </div>
      </form>
    </>
  )
}
