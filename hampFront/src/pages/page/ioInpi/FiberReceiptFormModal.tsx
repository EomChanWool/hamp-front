import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import axios from 'axios'
import { NumberInput } from '@/components/common/NumberInput'
import { FiberReceiptApi, type FiberReceiptCreateRequest, type FiberReceiptResponse } from '@/api/ioInpi/FiberReceipt'
import {
  FiberSalesOrderApi,
  type FiberSalesOrderDetailResponse,
  type FiberSalesOrderOptionResponse,
} from '@/api/sales/FiberSalesOrder'
import type { BusinessPartnerOptionResponse } from '@/api/sales/BusinessPartner'
import type { ItemOptionResponse } from '@/api/master/Item'
import { formatDateTime } from '@/utils/common'
import { r2 } from '@/utils/fiberSalesOrderAllocation'

/** DB DECIMAL(12,2) 최댓값 */
const MAX_RECEIPT_QTY = 9999999999.99

/** 입고를 연결할 수 있는 수주 상태 (완료·취소 제외) */
const RECEIVABLE_ORDER_STATUSES = ['RECEIVED', 'IN_PROGRESS']

type FormState = {
  bpCode: string
  orderCode: string
  rawItemCode: string
  receiptQty: number | null
  storId: string
  receivedAt: string
  note: string
}

type OrderStatus =
  | { state: 'loading' }
  | { state: 'loaded'; detail: FiberSalesOrderDetailResponse }
  | { state: 'failed' }

type SelectOption = { value: string; label: string }

type Props = {
  bpOptions: BusinessPartnerOptionResponse[]
  itemOptions: ItemOptionResponse[]
  /** 있으면 상세(수정), 없으면 등록 */
  receipt?: FiberReceiptResponse
  onClose: () => void
  onSaved: () => void
  /** 확인 후 삭제. 삭제했으면 true */
  onDelete?: (receipt: FiberReceiptResponse) => Promise<boolean>
}

/** datetime-local 입력값 형식의 현재 시각 (yyyy-MM-ddTHH:mm) */
function nowLocal() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

const toLocalInput = (value: string | null | undefined) => (value ? value.slice(0, 16) : '')

function formatWeight(value: number) {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

function getErrorMessage(error: unknown, fallback: string) {
  const message = axios.isAxiosError(error) ? error.response?.data?.message : null
  return typeof message === 'string' && message ? message : fallback
}

function initialForm(receipt: FiberReceiptResponse | undefined): FormState {
  if (!receipt) {
    return { bpCode: '', orderCode: '', rawItemCode: '', receiptQty: null, storId: '', receivedAt: nowLocal(), note: '' }
  }
  return {
    bpCode: receipt.bpCode,
    orderCode: receipt.orderCode ?? '',
    rawItemCode: receipt.rawItemCode,
    receiptQty: receipt.receiptQty,
    storId: receipt.storId ?? '',
    receivedAt: toLocalInput(receipt.receivedAt),
    note: receipt.note ?? '',
  }
}

/** 인피 입고 등록·상세(수정) 모달 */
export function FiberReceiptFormModal({ bpOptions, itemOptions, receipt, onClose, onSaved, onDelete }: Props) {
  const isEdit = receipt !== undefined
  const titleId = useId()
  const fieldId = useId()
  const bpRef = useRef<HTMLSelectElement>(null)
  const itemRef = useRef<HTMLSelectElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const receivedAtRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const [form, setForm] = useState<FormState>(() => initialForm(receipt))
  const [orderOptions, setOrderOptions] = useState<FiberSalesOrderOptionResponse[]>([])
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(() =>
    receipt?.orderCode ? { state: 'loading' } : null,
  )
  const [isSaving, setIsSaving] = useState(false)

  const optionsRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const prevFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    bpRef.current?.focus()
    return () => {
      if (prevFocused?.isConnected) prevFocused.focus()
    }
  }, [])

  const isLatest = useCallback(
    (ref: { current: number }, requestId: number) => mountedRef.current && requestId === ref.current,
    [],
  )

  const handleClose = () => {
    if (isSaving) return
    onClose()
  }

  useEffect(() => {
    if (isSaving) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSaving, onClose])

  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }))

  const loadOrderOptions = useCallback(
    (bpCode: string) => {
      const requestId = ++optionsRequestRef.current
      FiberSalesOrderApi.getOptions({ bpCode })
        .then((res) => {
          if (!isLatest(optionsRequestRef, requestId)) return
          setOrderOptions((res.data ?? []).filter((order) => RECEIVABLE_ORDER_STATUSES.includes(order.status)))
        })
        .catch((error) => {
          if (!isLatest(optionsRequestRef, requestId)) return
          console.error('섬유 수주 옵션 조회 실패:', error)
          window.alert(getErrorMessage(error, '수주 목록을 불러오지 못했습니다.'))
        })
    },
    [isLatest],
  )

  const loadOrderDetail = useCallback(
    (orderCode: string) => {
      const requestId = ++detailRequestRef.current
      FiberSalesOrderApi.getDetail(orderCode)
        .then((res) => {
          if (!isLatest(detailRequestRef, requestId)) return
          setOrderStatus({ state: 'loaded', detail: res.data })
        })
        .catch((error) => {
          if (!isLatest(detailRequestRef, requestId)) return
          console.error('섬유 수주 상세 조회 실패:', error)
          setOrderStatus({ state: 'failed' })
          window.alert(getErrorMessage(error, '수주 입고 현황을 불러오지 못했습니다.'))
        })
    },
    [isLatest],
  )

  useEffect(() => {
    if (!receipt) return
    loadOrderOptions(receipt.bpCode)
    if (receipt.orderCode) loadOrderDetail(receipt.orderCode)
  }, [receipt, loadOrderOptions, loadOrderDetail])

  const handleBpChange = (bpCode: string) => {
    update({ bpCode, orderCode: '', rawItemCode: '' })
    setOrderOptions([])
    setOrderStatus(null)
    detailRequestRef.current += 1
    if (!bpCode) {
      optionsRequestRef.current += 1
      return
    }
    loadOrderOptions(bpCode)
  }

  const handleOrderChange = (orderCode: string) => {
    const order = orderOptions.find((option) => option.orderCode === orderCode)
    const rawItemCode = order?.rawItemCode ?? (orderCode && orderCode === receipt?.orderCode ? receipt.rawItemCode : '')
    update({ orderCode, rawItemCode })
    if (!orderCode) {
      detailRequestRef.current += 1
      setOrderStatus(null)
      return
    }
    setOrderStatus({ state: 'loading' })
    loadOrderDetail(orderCode)
  }

  const selectedOrder = orderOptions.find((option) => option.orderCode === form.orderCode)
  const isOrderLoading = orderStatus?.state === 'loading'

  // 선택지에 없는 현재 값(완료된 수주 등)도 표시
  const bpSelectOptions: SelectOption[] = bpOptions.map((bp) => ({ value: bp.bpCode, label: `${bp.bpNm} (${bp.bpCode})` }))
  if (receipt && !bpSelectOptions.some((option) => option.value === receipt.bpCode)) {
    bpSelectOptions.push({ value: receipt.bpCode, label: `${receipt.bpNm ?? receipt.bpCode} (${receipt.bpCode})` })
  }

  const orderSelectOptions: SelectOption[] = orderOptions.map((order) => ({ value: order.orderCode, label: order.orderCode }))
  if (
    receipt?.orderCode &&
    form.bpCode === receipt.bpCode &&
    !orderSelectOptions.some((option) => option.value === receipt.orderCode)
  ) {
    orderSelectOptions.push({ value: receipt.orderCode, label: receipt.orderCode })
  }

  const rawItemSelectOptions: SelectOption[] = itemOptions.map((item) => ({
    value: item.itemCode,
    label: `${item.itemNm} (${item.itemCode})`,
  }))
  const rawItemFallback = selectedOrder
    ? { code: selectedOrder.rawItemCode, name: selectedOrder.rawItemNm }
    : receipt && form.rawItemCode === receipt.rawItemCode
      ? { code: receipt.rawItemCode, name: receipt.rawItemNm }
      : null
  if (rawItemFallback && !rawItemSelectOptions.some((option) => option.value === rawItemFallback.code)) {
    rawItemSelectOptions.push({
      value: rawItemFallback.code,
      label: `${rawItemFallback.name ?? rawItemFallback.code} (${rawItemFallback.code})`,
    })
  }

  // 단위: 수주 투입원료 → 원료 품목 → 입고 → kg 순
  const loadedDetail = orderStatus?.state === 'loaded' ? orderStatus.detail : null
  const unit =
    loadedDetail?.rawUnit ||
    itemOptions.find((item) => item.itemCode === form.rawItemCode)?.unit ||
    receipt?.unit ||
    'kg'

  /** 인쇄된 라벨에 찍히는 값을 바꿨으면 저장 전에 확인. false 면 저장 중단 */
  const confirmPrintedChange = () => {
    if (!receipt?.labelPrinted) return true
    const changed =
      form.bpCode !== receipt.bpCode ||
      form.orderCode !== (receipt.orderCode ?? '') ||
      form.rawItemCode !== receipt.rawItemCode ||
      form.receiptQty !== receipt.receiptQty ||
      form.receivedAt !== toLocalInput(receipt.receivedAt)
    if (!changed) return true
    return window.confirm(
      '이미 라벨이 인쇄된 입고입니다.\n' +
        '거래처·수주·원료·중량·입고일시를 바꾸면 붙어 있는 라벨과 내용이 달라집니다. 저장 후 라벨을 다시 인쇄해 주세요.\n' +
        '그대로 저장하시겠습니까?',
    )
  }

  /** 저장 후 누적 입고 중량이 투입원료 총량을 넘으면 확인. false 면 저장 중단 */
  const confirmOverReceipt = (receiptQty: number) => {
    if (orderStatus?.state !== 'loaded') return true
    const { receivedQty, requestInputQty } = orderStatus.detail
    if (requestInputQty == null) return true

    // 같은 수주면 누적 입고에 이 입고의 기존 중량이 이미 포함됨
    const previousQty = receipt?.orderCode && receipt.orderCode === form.orderCode ? receipt.receiptQty : 0
    const overQty = r2((receivedQty ?? 0) - previousQty + receiptQty - requestInputQty)
    if (overQty <= 0) return true

    const overText = `저장하면 누적 입고 중량이 투입원료 총량보다 ${formatWeight(overQty)} ${unit} 많아집니다.`
    if (form.note.trim()) {
      return window.confirm(`${overText}\n그대로 저장하시겠습니까?`)
    }
    const proceed = window.confirm(
      `${overText}\n비고에 초과 사유를 입력하지 않았습니다. 비고 없이 저장하시겠습니까?\n\n[취소]를 누르면 비고 입력칸으로 이동합니다.`,
    )
    if (!proceed) noteRef.current?.focus()
    return proceed
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (isSaving || isOrderLoading) return

    const fail = (message: string, target: HTMLElement | null) => {
      window.alert(message)
      target?.focus()
    }

    if (!form.bpCode) return fail('거래처를 선택해주세요.', bpRef.current)
    if (!form.rawItemCode) return fail('원료 품목을 선택해주세요.', itemRef.current)
    if (form.receiptQty === null) return fail('입고 중량을 입력해주세요.', qtyRef.current)
    if (!(form.receiptQty > 0)) return fail('입고 중량은 0보다 커야 합니다.', qtyRef.current)
    if (!form.receivedAt) return fail('입고일시를 입력해주세요.', receivedAtRef.current)
    if (!confirmPrintedChange()) return
    if (!confirmOverReceipt(form.receiptQty)) return

    // 수정은 전체 덮어쓰기라 빼고 보낸 선택 항목은 서버에서도 비워짐
    const payload: FiberReceiptCreateRequest = {
      bpCode: form.bpCode,
      rawItemCode: form.rawItemCode,
      receiptQty: form.receiptQty,
      receivedAt: form.receivedAt,
    }
    if (form.orderCode) payload.orderCode = form.orderCode
    if (form.storId.trim()) payload.storId = form.storId.trim()
    if (form.note.trim()) payload.note = form.note.trim()

    setIsSaving(true)
    try {
      const res = receipt
        ? await FiberReceiptApi.update(receipt.receiptId, payload)
        : await FiberReceiptApi.create(payload)
      window.alert(res.message || (receipt ? '수정되었습니다.' : '등록되었습니다.'))
      setIsSaving(false)
      onSaved()
    } catch (error) {
      console.error(receipt ? '인피 입고 수정 실패:' : '인피 입고 등록 실패:', error)
      window.alert(getErrorMessage(error, receipt ? '수정에 실패했습니다.' : '등록에 실패했습니다.'))
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!receipt || !onDelete || isSaving) return
    setIsSaving(true)
    const deleted = await onDelete(receipt)
    if (!deleted && mountedRef.current) setIsSaving(false)
  }

  const id = (name: string) => `${fieldId}-${name}`

  return (
    <>
      <div className="modalOverlay" onClick={handleClose} />
      <form className="detailModal" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={handleSubmit} noValidate>
        <div className="detailModalHeader">
          <div>
            <h3 id={titleId}>{receipt ? `인피 입고 상세 · ${receipt.receiptLotCode}` : '인피 입고 등록'}</h3>
            <span>{isEdit ? '입고 LOT 번호는 수정해도 바뀌지 않습니다.' : '입고 LOT 번호는 등록 시 자동으로 부여됩니다.'}</span>
          </div>
          <button type="button" className="detailModalClose" aria-label="닫기" disabled={isSaving} onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="detailModalBody">
          {receipt?.labelPrinted && (
            <div className="inpiFormFull inpiPrintedNotice">
              이미 라벨이 인쇄된 입고입니다. 거래처·수주·원료·중량·입고일시를 바꾸면 붙어 있는 라벨과 내용이 달라집니다.
            </div>
          )}

          {receipt && (
            <dl className="inpiFormFull inpiReceiptMeta">
              <div>
                <dt>입고 LOT</dt>
                <dd className="inpiLotCode">{receipt.receiptLotCode}</dd>
              </div>
              <div>
                <dt>처리자</dt>
                <dd>{receipt.receivedBy || '-'}</dd>
              </div>
              <div>
                <dt>라벨</dt>
                <dd>{receipt.labelPrinted ? '인쇄완료' : '미인쇄'}</dd>
              </div>
              <div>
                <dt>등록 · 수정</dt>
                <dd>
                  {receipt.createdAt ? formatDateTime(receipt.createdAt) : '-'} ·{' '}
                  {receipt.updatedAt ? formatDateTime(receipt.updatedAt) : '-'}
                </dd>
              </div>
            </dl>
          )}

          <div className="detailField">
            <label htmlFor={id('bp')} className="inpiRequired">
              거래처
            </label>
            <select
              id={id('bp')}
              ref={bpRef}
              className="tableInput"
              value={form.bpCode}
              onChange={(e) => handleBpChange(e.target.value)}
            >
              <option value="">거래처 선택</option>
              {bpSelectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="detailField">
            <label htmlFor={id('order')}>섬유 임가공 수주</label>
            <select
              id={id('order')}
              className="tableInput"
              value={form.orderCode}
              disabled={!form.bpCode}
              onChange={(e) => handleOrderChange(e.target.value)}
            >
              <option value="">수주 없음 (나중에 연결)</option>
              {orderSelectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="detailField">
            <label htmlFor={id('item')} className="inpiRequired">
              원료 품목
            </label>
            <select
              id={id('item')}
              ref={itemRef}
              className="tableInput"
              value={form.rawItemCode}
              disabled={!!form.orderCode}
              onChange={(e) => update({ rawItemCode: e.target.value })}
            >
              <option value="">품목 선택</option>
              {rawItemSelectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="detailField">
            <label htmlFor={id('qty')} className="inpiRequired">
              입고 중량
            </label>
            <NumberInput
              id={id('qty')}
              ref={qtyRef}
              className="tableInput"
              placeholder="0.00"
              value={form.receiptQty}
              onValueChange={(receiptQty) => update({ receiptQty })}
              decimalScale={2}
              max={MAX_RECEIPT_QTY}
              wrapClassName="inpiUnitInput"
              suffix={<span aria-hidden="true">{unit}</span>}
            />
          </div>

          {orderStatus && (
            <div className="inpiFormFull inpiOrderStatus" role="status">
              {orderStatus.state === 'loading' && '수주 입고 현황을 불러오는 중입니다…'}
              {orderStatus.state === 'loaded' &&
                `투입원료 총량 ${formatWeight(orderStatus.detail.requestInputQty ?? 0)} ${unit} · 누적 입고 ${formatWeight(
                  orderStatus.detail.receivedQty ?? 0,
                )} ${unit} (${orderStatus.detail.receiptCount ?? 0}건)`}
              {orderStatus.state === 'failed' && (
                <span className="inpiWarnText">입고 현황을 불러오지 못해 초과 입고 확인 없이 {isEdit ? '저장' : '등록'}됩니다.</span>
              )}
            </div>
          )}

          <div className="detailField">
            <label htmlFor={id('stor')}>보관 창고</label>
            <input
              id={id('stor')}
              className="tableInput"
              maxLength={30}
              placeholder="예) WH-FIBER-01"
              value={form.storId}
              onChange={(e) => update({ storId: e.target.value })}
            />
          </div>

          <div className="detailField">
            <label htmlFor={id('receivedAt')} className="inpiRequired">
              입고일시
            </label>
            <input
              id={id('receivedAt')}
              ref={receivedAtRef}
              className="tableInput"
              type="datetime-local"
              value={form.receivedAt}
              onChange={(e) => update({ receivedAt: e.target.value })}
            />
          </div>

          <div className="detailField inpiFormFull">
            <label htmlFor={id('note')}>비고</label>
            <textarea
              id={id('note')}
              ref={noteRef}
              className="tableInput"
              maxLength={255}
              placeholder="메모 (선택)"
              value={form.note}
              onChange={(e) => update({ note: e.target.value })}
            />
          </div>
        </div>

        <div className="detailModalFooter">
          {receipt && onDelete && (
            <button
              type="button"
              className="miniButton danger detailModalDangerAction"
              disabled={isSaving}
              onClick={handleDelete}
            >
              삭제
            </button>
          )}
          <div className="detailModalFooterRight">
            <button type="button" className="inpiPlainButton" disabled={isSaving} onClick={handleClose}>
              취소
            </button>
            <button type="submit" className="primaryButton" disabled={isSaving || isOrderLoading}>
              {isEdit ? '수정 저장' : '등록'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
