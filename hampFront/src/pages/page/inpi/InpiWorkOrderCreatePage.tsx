import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserApi, type UserOptionResponse } from '@/api/User'
import {
  FiberSalesOrderApi,
  type FiberSalesOrderLineResponse,
  type FiberSalesOrderResponse,
} from '@/api/sales/FiberSalesOrder'
import { FiberWorkOrderApi } from '@/api/FiberWorkOrder'
import { SelectBox, type SelectBoxOption } from '@/components/common/SelectBox'
import { focusField } from '@/utils/common'
import { todayString } from '@/utils/fiberSalesOrderAllocation'
import { CLOSED_ORDER_STATUSES, calcPct, fmtKg, getErrorMessage } from '@/utils/fiberWorkOrder'
import '@/pages/layout/Layout.css'
import '@/pages/page/inpiSales/InpiSales.css'
import '@/pages/page/inpi/Inpi.css'

/** 수주 목록 응답에 제품별 배분(lines)이 포함된다 */
type FiberOrderRow = FiberSalesOrderResponse & { lines?: FiberSalesOrderLineResponse[] }

const LIST_PATH = '/inpi/work-orders'
// 필수: 수주 · 예정 시작일
const REQUIRED_TOTAL = 2

export function InpiWorkOrderCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRequiredErrors, setShowRequiredErrors] = useState(false)

  const [form, setForm] = useState({
    orderCode: '',
    workDate: todayString(),
    managerId: '',
    note: '',
  })

  const [orders, setOrders] = useState<FiberOrderRow[]>([])
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([])
  /** 이미 유효한 작업지시가 있는 수주 (orderCode → workId). 수주 1건당 작업지시 1개 */
  const [assignedMap, setAssignedMap] = useState<Record<string, string>>({})

  const orderSelectRef = useRef<HTMLButtonElement>(null)
  const workDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let ignore = false
    Promise.allSettled([
      FiberSalesOrderApi.getList({ page: 0, size: 200, sort: 'orderDate,desc' }),
      FiberWorkOrderApi.getList({ page: 0, size: 500 }),
      UserApi.getOptions(),
    ]).then(([orderRes, woRes, userRes]) => {
      if (ignore) return
      if (orderRes.status === 'fulfilled') {
        setOrders((orderRes.value.data?.content ?? []).filter((o) => !CLOSED_ORDER_STATUSES.includes(o.status)))
      } else {
        console.error('섬유 수주 조회 실패:', orderRes.reason)
        window.alert(getErrorMessage(orderRes.reason, '수주 목록을 불러오지 못했습니다.'))
      }
      if (woRes.status === 'fulfilled') {
        const map: Record<string, string> = {}
        ;(woRes.value.data?.content ?? [])
          .filter((wo) => wo.status !== 'CANCELLED')
          .forEach((wo) => {
            map[wo.orderCode] = wo.workId
          })
        setAssignedMap(map)
      }
      if (userRes.status === 'fulfilled') setUserOptions(userRes.value.data ?? [])
    })
    return () => {
      ignore = true
    }
  }, [])

  const orderSelectOptions = useMemo<SelectBoxOption[]>(
    () =>
      orders.map((order) => ({
        value: order.orderCode,
        label: `${order.orderCode} · ${order.bpNm ?? '-'}`,
        description: assignedMap[order.orderCode]
          ? `작업지시 있음 (${assignedMap[order.orderCode]})`
          : `${order.rawItemNm ?? order.rawItemCode ?? '-'} ${fmtKg(order.requestInputQty)}kg${order.dueDate ? ` · 납기 ${order.dueDate}` : ''}`,
      })),
    [orders, assignedMap],
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

  const handleOrderChange = (orderCode: string) => {
    const dup = assignedMap[orderCode]
    if (dup) {
      window.alert(`이 수주에는 이미 작업지시(${dup})가 있습니다. 섬유 작업지시는 수주 1건당 1개입니다.`)
      return
    }
    setForm((prev) => ({ ...prev, orderCode }))
  }

  const missing = { orderCode: !form.orderCode, workDate: !form.workDate }
  const isInvalid = (key: keyof typeof missing) => (showRequiredErrors && missing[key]) || undefined
  const requiredDone = [!!form.orderCode, !!form.workDate].filter(Boolean).length

  const handleCancel = () => {
    const qs = searchParams.toString()
    navigate(qs ? `${LIST_PATH}?${qs}` : LIST_PATH)
  }

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()

    if (missing.orderCode || missing.workDate) {
      setShowRequiredErrors(true)
      if (missing.orderCode) {
        window.alert('섬유 수주를 선택해 주세요.')
        focusField(orderSelectRef.current)
      } else {
        window.alert('예정 작업 시작일을 입력해 주세요.')
        focusField(workDateRef.current)
      }
      return
    }

    setIsSubmitting(true)
    try {
      const res = await FiberWorkOrderApi.create({
        orderCode: form.orderCode,
        workDate: form.workDate,
        managerId: form.managerId || null,
        note: form.note.trim() || null,
      })
      window.alert('작업지시가 등록되었습니다. (대기)')
      const workId = res.data?.workId
      navigate(workId ? `${LIST_PATH}/${encodeURIComponent(workId)}` : LIST_PATH, { replace: true })
    } catch (error) {
      console.error('섬유 작업지시 등록 실패:', error)
      window.alert(getErrorMessage(error, '섬유 작업지시 등록 중 오류가 발생했습니다.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const summaryRows: { label: string; value: string }[] = [
    { label: '거래처', value: selectedOrder?.bpNm ?? '' },
    { label: '수주', value: selectedOrder?.orderCode ?? '' },
    {
      label: '원물',
      value: selectedOrder
        ? `${selectedOrder.rawItemNm ?? selectedOrder.rawItemCode ?? ''} ${fmtKg(selectedOrder.requestInputQty)}kg`
        : '',
    },
    { label: '시작일', value: form.workDate },
    { label: '담당자', value: selectedManager ? selectedManager.userNm ?? selectedManager.userId : '' },
  ]

  return (
    <section className="screenStack">
      <form className="formPage" onSubmit={handleSubmit} noValidate>
        <div className="formPageHead">
          <h1 className="formPageTitle">신규 섬유 작업지시 등록</h1>
          <span className="formPageMeta">
            <span className="required" aria-hidden="true">*</span> 표시는 필수 입력 항목입니다
          </span>
        </div>

        <div className="formLayout">
          <div className="formMain">
            {/* 1. 수주 */}
            <section className="formCard" aria-labelledby="fwo-sec-order">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="fwo-sec-order">수주</h2>
                  <p className="formCardDesc">
                    작업할 거래처 수주를 고릅니다. 섬유동은 임가공이라 수주 1건당 작업지시는 1개입니다(취소한 건 제외).
                    제품·원물 LOT·수량은 여기서 정하지 않고, 작업하면서 현장 PC에서 실적 줄로 남깁니다.
                  </p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col6">
                  <label className="formLabel" htmlFor="fwo-order">
                    섬유 수주 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <SelectBox
                    ref={orderSelectRef}
                    id="fwo-order"
                    value={form.orderCode}
                    options={orderSelectOptions}
                    placeholder="수주를 선택해주세요"
                    searchPlaceholder="수주번호 또는 거래처 검색"
                    searchable
                    disabled={isSubmitting}
                    invalid={isInvalid('orderCode')}
                    onChange={handleOrderChange}
                  />
                  {Object.keys(assignedMap).length > 0 && (
                    <span className="fwo-sub">작업지시가 이미 있는 수주는 고를 수 없습니다(수주 1건당 1개).</span>
                  )}
                </div>
              </div>

              {selectedOrder && (
                <dl className="fwo-readGrid" style={{ marginTop: 16 }}>
                  <div><dt>거래처</dt><dd>{selectedOrder.bpNm ?? '-'}</dd></div>
                  <div><dt>투입원료</dt><dd>{selectedOrder.rawItemNm ?? selectedOrder.rawItemCode ?? '-'}</dd></div>
                  <div><dt>납기</dt><dd>{selectedOrder.dueDate ?? '-'}</dd></div>
                  <div><dt>수주 원물</dt><dd>{fmtKg(selectedOrder.requestInputQty)} kg</dd></div>
                  <div className="is-wide">
                    <dt>제품별 배분 (수주에서 가져옴)</dt>
                    <dd>
                      {(selectedOrder.lines ?? []).length > 0
                        ? (selectedOrder.lines ?? [])
                            .map(
                              (line) =>
                                `${line.productItemNm || line.productItemCode} ${fmtKg(line.allocatedInputQty)}kg (${calcPct(
                                  line.allocatedInputQty,
                                  selectedOrder.requestInputQty,
                                )}%)`,
                            )
                            .join(' / ')
                        : '-'}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            {/* 2. 지시 내용 */}
            <section className="formCard" aria-labelledby="fwo-sec-plan">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="fwo-sec-plan">지시 내용</h2>
                  <p className="formCardDesc">
                    작업지시번호는 FWO-예정 시작일-NN 형식으로 서버가 붙입니다. 등록하면 대기 상태로 시작합니다.
                  </p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col3">
                  <label className="formLabel" htmlFor="fwo-date">
                    예정 시작일 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={workDateRef}
                    id="fwo-date"
                    type="date"
                    className="formInput"
                    value={form.workDate}
                    aria-invalid={isInvalid('workDate')}
                    disabled={isSubmitting}
                    onChange={(e) => setForm((prev) => ({ ...prev, workDate: e.target.value }))}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="fwo-manager">담당자</label>
                  <SelectBox
                    id="fwo-manager"
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
                  <label className="formLabel" htmlFor="fwo-note">작업 지시사항</label>
                  <textarea
                    id="fwo-note"
                    className="formInput"
                    maxLength={255}
                    placeholder="예) 솜 베일 80~100kg 단위, 슬라이버는 캔 단위로 실적 줄 입력"
                    value={form.note}
                    disabled={isSubmitting}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* 우측 요약 */}
          <aside className="formCard formAside" aria-label="작업지시 등록 요약">
            <h2 className="formCardTitle">등록 요약</h2>

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

            <div className="formActions">
              <button type="submit" className="primaryButton" disabled={isSubmitting}>
                {isSubmitting ? '등록 중...' : '등록'}
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
