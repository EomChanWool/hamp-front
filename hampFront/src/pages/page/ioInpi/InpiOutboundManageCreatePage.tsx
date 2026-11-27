import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserApi, type UserOptionResponse } from '@/api/User'
import { FiberWorkOrderApi, type FiberWorkOrderResponse } from '@/api/FiberWorkOrder'
import { FiberShipmentApi, type FiberShippableLotResponse } from '@/api/ioInpi/FiberShipment'
import { SelectBox, type SelectBoxOption } from '@/components/common/SelectBox'
import { focusField, formatDateTime } from '@/utils/common'
import { todayString } from '@/utils/fiberSalesOrderAllocation'
import { fmtKg, getErrorMessage } from '@/utils/fiberWorkOrder'
import {
  buildShipLines,
  round2,
  sumByProduct,
  sumPicks,
  validateShipLines,
  type LotPicks,
} from '@/utils/fiberShipment'
import { FiberShipmentLotPicker } from '@/pages/page/ioInpi/FiberShipmentLotPicker'
import '@/pages/layout/Layout.css'
import '@/pages/page/inpiSales/InpiSales.css'
import '@/pages/page/inpi/Inpi.css'
import '@/pages/page/ioInpi/InpiOutbound.css'

const LIST_PATH = '/io/inpi-outbound-manage'
/** 완료된 작업지시를 한 번에 가져올 개수 (출고 가능한 수주 후보) */
const ORDER_FETCH_SIZE = 500
// 필수: 수주 · 출고 예정일 · 제품 LOT
const REQUIRED_TOTAL = 3

export function InpiOutboundManageCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRequiredErrors, setShowRequiredErrors] = useState(false)
  const [formError, setFormError] = useState('')

  const [form, setForm] = useState({
    orderCode: '',
    shipDate: todayString(),
    shipDest: '',
    managerId: '',
    note: '',
  })

  /** 출고 가능한 수주 = 작업지시가 완료된 수주 (완료된 작업지시 목록에서 뽑는다) */
  const [orders, setOrders] = useState<FiberWorkOrderResponse[]>([])
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([])
  const [lots, setLots] = useState<FiberShippableLotResponse[]>([])
  const [isLotLoading, setIsLotLoading] = useState(false)
  const [picks, setPicks] = useState<LotPicks>({})

  const orderSelectRef = useRef<HTMLButtonElement>(null)
  const shipDateRef = useRef<HTMLInputElement>(null)

  // 완료 작업지시(=출고 가능 수주) + 담당자 옵션
  useEffect(() => {
    let ignore = false
    Promise.allSettled([
      FiberWorkOrderApi.getList({ status: 'COMPLETED', page: 0, size: ORDER_FETCH_SIZE }),
      UserApi.getOptions(),
    ]).then(([woRes, userRes]) => {
      if (ignore) return
      if (woRes.status === 'fulfilled') {
        // 수주 1건당 작업지시 1개지만, 혹시 몰라 수주번호로 중복 제거
        const map = new Map<string, FiberWorkOrderResponse>()
        ;(woRes.value.data?.content ?? []).forEach((wo) => {
          if (!map.has(wo.orderCode)) map.set(wo.orderCode, wo)
        })
        setOrders([...map.values()])
      } else {
        console.error('출고 가능 수주(완료 작업지시) 조회 실패:', woRes.reason)
        window.alert(getErrorMessage(woRes.reason, '출고할 수 있는 수주 목록을 불러오지 못했습니다.'))
      }
      if (userRes.status === 'fulfilled') setUserOptions(userRes.value.data ?? [])
    })
    return () => {
      ignore = true
    }
  }, [])

  // 수주 선택 시 실을 수 있는 제품 LOT 조회
  useEffect(() => {
    setPicks({})
    if (!form.orderCode) {
      setLots([])
      setIsLotLoading(false)
      return
    }
    let ignore = false
    setLots([])
    setIsLotLoading(true)
    FiberShipmentApi.getShippableLots(form.orderCode)
      .then((res) => {
        if (!ignore) setLots(res.data ?? [])
      })
      .catch((error) => {
        if (ignore) return
        console.error('출고 가능 제품 LOT 조회 실패:', error)
        window.alert(getErrorMessage(error, '제품 LOT 목록을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!ignore) setIsLotLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [form.orderCode])

  const orderSelectOptions = useMemo<SelectBoxOption[]>(
    () =>
      orders.map((wo) => ({
        value: wo.orderCode,
        label: `${wo.orderCode} · ${wo.bpNm ?? '-'}`,
        description: `${wo.rawItemNm || wo.rawItemCode || '-'} · 납기 ${wo.dueDate || '-'}`,
      })),
    [orders],
  )

  const managerSelectOptions = useMemo<SelectBoxOption[]>(
    () => [
      { value: '', label: '미지정' },
      ...userOptions.map((user) => ({ value: user.userId, label: user.userNm ?? user.userId, description: user.userId })),
    ],
    [userOptions],
  )

  const selectedOrder = orders.find((o) => o.orderCode === form.orderCode) ?? null
  const selectedManager = userOptions.find((u) => u.userId === form.managerId)

  const pickCount = Object.keys(picks).length
  const totalQty = sumPicks(picks)
  const producedQty = round2(lots.reduce((sum, l) => sum + l.outputQty, 0))
  const remainingQty = round2(lots.reduce((sum, l) => sum + Math.max(0, l.remainingQty), 0))
  const productSums = sumByProduct(
    Object.entries(picks).map(([perfId, qty]) => {
      const lot = lots.find((l) => l.perfId === Number(perfId))
      return { name: lot?.productItemNm || lot?.productItemCode || '-', qty: Number(qty) }
    }),
  )

  const missing = { orderCode: !form.orderCode, shipDate: !form.shipDate, lines: pickCount === 0 }
  const isInvalid = (key: keyof typeof missing) => (showRequiredErrors && missing[key]) || undefined
  const requiredDone = [!missing.orderCode, !missing.shipDate, !missing.lines].filter(Boolean).length

  const handleCancel = () => {
    const qs = searchParams.toString()
    navigate(qs ? `${LIST_PATH}?${qs}` : LIST_PATH)
  }

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    setFormError('')

    if (missing.orderCode || missing.shipDate) {
      setShowRequiredErrors(true)
      if (missing.orderCode) {
        window.alert('섬유 수주를 선택해 주세요.')
        focusField(orderSelectRef.current)
      } else {
        window.alert('출고 예정일을 입력해 주세요.')
        focusField(shipDateRef.current)
      }
      return
    }
    const lineError = validateShipLines(lots, picks)
    if (lineError) {
      setShowRequiredErrors(true)
      setFormError(lineError)
      window.alert(lineError)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await FiberShipmentApi.create({
        orderCode: form.orderCode,
        shipDate: form.shipDate,
        shipDest: form.shipDest.trim() || undefined,
        managerId: form.managerId || undefined,
        note: form.note.trim() || undefined,
        lines: buildShipLines(picks),
      })
      const shipId = res.data?.shipId
      window.alert(`출고지시서${shipId ? ` ${shipId}` : ''}가 등록되었습니다. (출고 대기)`)
      navigate(shipId ? `${LIST_PATH}/${encodeURIComponent(shipId)}` : LIST_PATH, { replace: true })
    } catch (error) {
      console.error('섬유 출고지시서 등록 실패:', error)
      const message = getErrorMessage(error, '섬유 출고지시서 등록 중 오류가 발생했습니다.')
      setFormError(message)
      window.alert(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const summaryRows: { label: string; value: string }[] = [
    { label: '지시서', value: '등록 시 발급' },
    { label: '거래처', value: selectedOrder?.bpNm ?? '' },
    { label: '수주', value: selectedOrder?.orderCode ?? '' },
    { label: '예정일', value: form.shipDate },
    { label: '담당자', value: selectedManager ? selectedManager.userNm ?? selectedManager.userId : '' },
    { label: '제품 LOT', value: pickCount ? `${pickCount}개` : '' },
  ]

  return (
    <section className="screenStack">
      <form className="formPage" onSubmit={handleSubmit} noValidate>
        <div className="formPageHead">
          <h1 className="formPageTitle">신규 섬유 출고지시서 등록</h1>
          <span className="formPageMeta">
            <span className="required" aria-hidden="true">*</span> 표시는 필수 입력 항목입니다 · 번호는 출고 예정일 기준으로
            발급됩니다
          </span>
        </div>

        <div className="formLayout">
          <div className="formMain">
            {/* 1. 수주 */}
            <section className="formCard" aria-labelledby="fsh-sec-order">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="fsh-sec-order">수주</h2>
                  <p className="formCardDesc">
                    출고할 거래처 수주를 고릅니다. 작업지시가 완료된 수주만 표시되고, 한 수주를 여러 장으로 나눠 출고해도
                    됩니다.
                  </p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col6">
                  <label className="formLabel" htmlFor="fsh-order">
                    섬유 수주 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <SelectBox
                    ref={orderSelectRef}
                    id="fsh-order"
                    value={form.orderCode}
                    options={orderSelectOptions}
                    placeholder="수주를 선택해주세요"
                    searchPlaceholder="수주번호 또는 거래처 검색"
                    searchable
                    disabled={isSubmitting}
                    invalid={isInvalid('orderCode')}
                    onChange={(orderCode) => setForm((prev) => ({ ...prev, orderCode }))}
                  />
                  {orders.length === 0 && (
                    <span className="fwo-sub">작업지시가 완료된 수주가 없습니다. 작업 완료 후 출고할 수 있습니다.</span>
                  )}
                </div>
              </div>

              {selectedOrder && (
                <dl className="fwo-readGrid" style={{ marginTop: 16 }}>
                  <div><dt>거래처</dt><dd>{selectedOrder.bpNm || '-'}</dd></div>
                  <div>
                    <dt>작업지시</dt>
                    <dd>
                      <span className="fwo-code">{selectedOrder.workId}</span>
                      <span className="fwo-sub">완료 {selectedOrder.endAt ? formatDateTime(selectedOrder.endAt) : '-'}</span>
                    </dd>
                  </div>
                  <div><dt>납기</dt><dd>{selectedOrder.dueDate || '-'}</dd></div>
                  <div><dt>투입원료</dt><dd>{selectedOrder.rawItemNm || selectedOrder.rawItemCode || '-'}</dd></div>
                  <div><dt>제품 LOT 생산 합계</dt><dd>{isLotLoading ? '불러오는 중...' : `${fmtKg(producedQty)} kg`}</dd></div>
                  <div><dt>더 출고할 수 있는 양</dt><dd>{isLotLoading ? '불러오는 중...' : `${fmtKg(remainingQty)} kg`}</dd></div>
                </dl>
              )}
            </section>

            {/* 2. 제품 LOT */}
            {selectedOrder && (
              <section className="formCard" aria-labelledby="fsh-sec-lot">
                <div className="formCardHead">
                  <div>
                    <h2 className="formCardTitle" id="fsh-sec-lot">
                      실을 제품 LOT <span className="required" aria-hidden="true">*</span>
                    </h2>
                    <p className="formCardDesc">
                      실적 줄마다 발급된 제품 LOT(베일·캔)입니다. 체크하면 남은 양 전부가 채워지고, 일부만 보낼 때는 kg을
                      줄이면 됩니다. 다른 지시서에 잡힌 양은 남은 양에서 빠집니다.
                    </p>
                  </div>
                </div>
                <FiberShipmentLotPicker
                  lots={lots}
                  picks={picks}
                  onChange={(next) => {
                    setPicks(next)
                    setFormError('')
                  }}
                  loading={isLotLoading}
                  disabled={isSubmitting}
                />
                {isInvalid('lines') && <p className="fwo-fieldError fsh-blockError">출고할 제품 LOT을 1개 이상 선택해 주세요.</p>}
              </section>
            )}

            {/* 3. 출고 정보 */}
            <section className="formCard" aria-labelledby="fsh-sec-info">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="fsh-sec-info">출고 정보</h2>
                  <p className="formCardDesc">
                    담당자는 지시서에 인쇄되는 사람입니다(선택). 실제 출고자는 PC에서 출고 확인을 누른 사람으로 기록됩니다.
                  </p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col3">
                  <label className="formLabel" htmlFor="fsh-date">
                    출고 예정일 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={shipDateRef}
                    id="fsh-date"
                    type="date"
                    className="formInput"
                    value={form.shipDate}
                    aria-invalid={isInvalid('shipDate')}
                    disabled={isSubmitting}
                    onChange={(e) => setForm((prev) => ({ ...prev, shipDate: e.target.value }))}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="fsh-manager">출고 담당자</label>
                  <SelectBox
                    id="fsh-manager"
                    value={form.managerId}
                    options={managerSelectOptions}
                    placeholder="미지정"
                    searchPlaceholder="담당자 이름 또는 아이디 검색"
                    searchable
                    disabled={isSubmitting}
                    onChange={(v) => setForm((prev) => ({ ...prev, managerId: v }))}
                  />
                </div>

                <div className="formField col6">
                  <label className="formLabel" htmlFor="fsh-dest">인도 장소</label>
                  <input
                    id="fsh-dest"
                    className="formInput"
                    maxLength={255}
                    placeholder="예) 거래처 본사 창고 (경기 평택시 …)"
                    value={form.shipDest}
                    disabled={isSubmitting}
                    onChange={(e) => setForm((prev) => ({ ...prev, shipDest: e.target.value }))}
                  />
                </div>

                <div className="formField col6">
                  <label className="formLabel" htmlFor="fsh-note">인수자 · 특이사항</label>
                  <textarea
                    id="fsh-note"
                    className="formInput"
                    maxLength={255}
                    placeholder="예) 인수자 홍길동 과장, 1톤 화물차 2대, 베일 랩핑 상태 확인"
                    value={form.note}
                    disabled={isSubmitting}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* 우측 요약 */}
          <aside className="formCard formAside" aria-label="출고지시서 등록 요약">
            <h2 className="formCardTitle">출고 요약</h2>

            <div className="formProgress">
              <div className="formProgressText">
                <span>필수 입력</span>
                <strong>{requiredDone}/{REQUIRED_TOTAL}</strong>
              </div>
              <div
                className="formProgressBar"
                role="progressbar"
                aria-label="필수 입력 진행률"
                aria-valuemin={0}
                aria-valuemax={REQUIRED_TOTAL}
                aria-valuenow={requiredDone}
              >
                <div className="formProgressFill" style={{ width: `${(requiredDone / REQUIRED_TOTAL) * 100}%` }} />
              </div>
            </div>

            <dl className="formSummaryList">
              {summaryRows.map((row) => (
                <div className="formSummaryRow" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className={row.value ? undefined : 'isEmpty'}>{row.value || '미입력'}</dd>
                </div>
              ))}
            </dl>

            <ul className="fsh-prodSum">
              {productSums.length === 0 ? (
                <li className="is-empty">아직 고른 제품 LOT이 없습니다.</li>
              ) : (
                productSums.map((p) => (
                  <li key={p.name}>
                    <span>{p.name}</span>
                    <b>{fmtKg(p.qty)} kg</b>
                  </li>
                ))
              )}
            </ul>
            <div className="fsh-total">
              <span>출고 중량 합계</span>
              <strong>{fmtKg(totalQty)} kg</strong>
            </div>

            {formError && <div className="fsh-errorBox">{formError}</div>}

            <div className="formActions">
              <button type="submit" className="primaryButton" disabled={isSubmitting || isLotLoading}>
                {isSubmitting ? '등록 중...' : '출고지시서 등록'}
              </button>
              <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>
                취소
              </button>
            </div>
          </aside>
        </div>
      </form>
    </section>
  )
}
