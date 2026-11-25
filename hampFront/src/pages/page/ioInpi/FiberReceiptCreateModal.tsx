import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import axios from 'axios'
import { NumberInput } from '@/components/common/NumberInput'
import { FiberReceiptApi, type FiberReceiptCreateRequest } from '@/api/ioInpi/FiberReceipt'
import {
  FiberSalesOrderApi,
  type FiberSalesOrderDetailResponse,
  type FiberSalesOrderOptionResponse,
} from '@/api/sales/FiberSalesOrder'
import type { BusinessPartnerOptionResponse } from '@/api/sales/BusinessPartner'
import type { ItemOptionResponse } from '@/api/master/Item'
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

type Props = {
  bpOptions: BusinessPartnerOptionResponse[]
  itemOptions: ItemOptionResponse[]
  onClose: () => void
  onCreated: () => void
}

/** datetime-local 입력값 형식의 현재 시각 (yyyy-MM-ddTHH:mm) */
function nowLocal() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function formatWeight(value: number) {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

function getErrorMessage(error: unknown, fallback: string) {
  const message = axios.isAxiosError(error) ? error.response?.data?.message : null
  return typeof message === 'string' && message ? message : fallback
}

/** 인피 입고 등록 모달. 열 때마다 새로 마운트되어 입력값이 초기화된다 */
export function FiberReceiptCreateModal({ bpOptions, itemOptions, onClose, onCreated }: Props) {
  const titleId = useId()
  const fieldId = useId()
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const [form, setForm] = useState<FormState>(() => ({
    bpCode: '',
    orderCode: '',
    rawItemCode: '',
    receiptQty: null,
    storId: '',
    receivedAt: nowLocal(),
    note: '',
  }))
  const [orderOptions, setOrderOptions] = useState<FiberSalesOrderOptionResponse[]>([])
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // 거래처·수주를 빠르게 바꿔도 마지막 선택의 응답만 반영
  const optionsRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  // 모달이 닫힌 뒤 도착한 응답은 반영하지도, 알리지도 않는다
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const isLatest = (ref: { current: number }, requestId: number) => mountedRef.current && requestId === ref.current

  // 저장 중에는 어떤 방법으로도 닫히지 않게 한다
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

  const handleBpChange = (bpCode: string) => {
    // 거래처가 바뀌면 이전 거래처의 수주·원료 선택을 비운다
    update({ bpCode, orderCode: '', rawItemCode: '' })
    setOrderOptions([])
    setOrderStatus(null)
    detailRequestRef.current += 1
    const requestId = ++optionsRequestRef.current
    if (!bpCode) return

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
  }

  const handleOrderChange = (orderCode: string) => {
    const order = orderOptions.find((option) => option.orderCode === orderCode)
    // 수주를 고르면 원료는 수주 투입원료로 고정, 수주를 풀면 원료를 비운다
    update({ orderCode, rawItemCode: order?.rawItemCode ?? '' })
    const requestId = ++detailRequestRef.current
    if (!orderCode) {
      setOrderStatus(null)
      return
    }

    setOrderStatus({ state: 'loading' })
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
  }

  const selectedOrder = orderOptions.find((option) => option.orderCode === form.orderCode)
  const isOrderLoading = orderStatus?.state === 'loading'

  // 원료 옵션에 수주 투입원료가 없으면(옵션 조회 실패 등) 수주 응답의 이름으로 채운다
  const rawItemSelectOptions = itemOptions.map((item) => ({ value: item.itemCode, label: `${item.itemNm} (${item.itemCode})` }))
  if (selectedOrder && !rawItemSelectOptions.some((option) => option.value === selectedOrder.rawItemCode)) {
    rawItemSelectOptions.push({
      value: selectedOrder.rawItemCode,
      label: `${selectedOrder.rawItemNm ?? selectedOrder.rawItemCode} (${selectedOrder.rawItemCode})`,
    })
  }

  // 단위는 서버가 준 값을 그대로 쓴다: 수주 투입원료 단위 → 선택한 원료 품목 단위 → 없으면 kg
  const loadedDetail = orderStatus?.state === 'loaded' ? orderStatus.detail : null
  const unit =
    loadedDetail?.rawUnit || itemOptions.find((item) => item.itemCode === form.rawItemCode)?.unit || 'kg'

  /** 저장 후 누적 입고 중량이 투입원료 총량을 넘으면 확인. false 면 저장 중단 */
  const confirmOverReceipt = (receiptQty: number) => {
    if (orderStatus?.state !== 'loaded') return true
    const { receivedQty, requestInputQty } = orderStatus.detail
    if (requestInputQty == null) return true

    const overQty = r2((receivedQty ?? 0) + receiptQty - requestInputQty)
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

    if (!form.bpCode) return window.alert('거래처를 선택해주세요.')
    if (!form.rawItemCode) return window.alert('원료 품목을 선택해주세요.')
    if (form.receiptQty === null) return window.alert('입고 중량을 입력해주세요.')
    if (!(form.receiptQty > 0)) return window.alert('입고 중량은 0보다 커야 합니다.')
    if (!form.receivedAt) return window.alert('입고일시를 입력해주세요.')
    if (!confirmOverReceipt(form.receiptQty)) return

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
      const res = await FiberReceiptApi.create(payload)
      window.alert(res.message || '등록되었습니다.')
      setIsSaving(false)
      onCreated()
    } catch (error) {
      console.error('인피 입고 등록 실패:', error)
      window.alert(getErrorMessage(error, '등록에 실패했습니다.'))
      setIsSaving(false)
    }
  }

  const id = (name: string) => `${fieldId}-${name}`

  return (
    <>
      <div className="modalOverlay" onClick={handleClose} />
      <form className="detailModal" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={handleSubmit} noValidate>
        <div className="detailModalHeader">
          <div>
            <h3 id={titleId}>인피 입고 등록</h3>
            <span>입고 LOT 번호는 등록 시 자동으로 부여됩니다.</span>
          </div>
          <button type="button" className="detailModalClose" aria-label="닫기" disabled={isSaving} onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="detailModalBody">
          <div className="detailField">
            <label htmlFor={id('bp')} className="inpiRequired">
              거래처
            </label>
            <select id={id('bp')} className="tableInput" value={form.bpCode} onChange={(e) => handleBpChange(e.target.value)}>
              <option value="">거래처 선택</option>
              {bpOptions.map((bp) => (
                <option key={bp.bpCode} value={bp.bpCode}>
                  {bp.bpNm} ({bp.bpCode})
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
              {orderOptions.map((order) => (
                <option key={order.orderCode} value={order.orderCode}>
                  {order.orderCode}
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
                <span className="inpiWarnText">입고 현황을 불러오지 못해 초과 입고 확인 없이 등록됩니다.</span>
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
          <div className="detailModalFooterRight">
            <button type="button" className="inpiPlainButton" disabled={isSaving} onClick={handleClose}>
              취소
            </button>
            <button type="submit" className="primaryButton" disabled={isSaving || isOrderLoading}>
              등록
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
