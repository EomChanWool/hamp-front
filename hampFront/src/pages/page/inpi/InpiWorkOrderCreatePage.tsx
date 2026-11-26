import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserApi, type UserOptionResponse } from '@/api/User'
import {
  FiberSalesOrderApi,
  type FiberSalesOrderDetailResponse,
  type FiberSalesOrderOptionResponse,
} from '@/api/sales/FiberSalesOrder'
import { FiberWorkOrderApi } from '@/api/FiberWorkOrder'
import { SelectBox, type SelectBoxOption } from '@/components/common/SelectBox'
import { focusField } from '@/utils/common'
import { todayString } from '@/utils/fiberSalesOrderAllocation'
import { CLOSED_ORDER_STATUSES, calcPct, fmtKg, getErrorMessage } from '@/utils/fiberWorkOrder'
import '@/pages/layout/Layout.css'
import '@/pages/page/inpiSales/InpiSales.css'
import '@/pages/page/inpi/Inpi.css'

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

  /** 작업지시가 아직 배정되지 않은 수주 옵션 */
  const [orders, setOrders] = useState<FiberSalesOrderOptionResponse[]>([])
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([])
  /** 선택한 수주의 상세 (납기·투입량·제품별 배분 표시용) */
  const [orderDetail, setOrderDetail] = useState<FiberSalesOrderDetailResponse | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const orderSelectRef = useRef<HTMLButtonElement>(null)
  const workDateRef = useRef<HTMLInputElement>(null)

  // 미배정 수주 옵션 + 담당자 옵션 조회
  useEffect(() => {
    let ignore = false
    Promise.allSettled([FiberSalesOrderApi.getOptions({ unassignedOnly: true }), UserApi.getOptions()]).then(
      ([orderRes, userRes]) => {
        if (ignore) return
        if (orderRes.status === 'fulfilled') {
          setOrders((orderRes.value.data ?? []).filter((o) => !CLOSED_ORDER_STATUSES.includes(o.status)))
        } else {
          console.error('섬유 수주 옵션 조회 실패:', orderRes.reason)
          window.alert(getErrorMessage(orderRes.reason, '수주 목록을 불러오지 못했습니다.'))
        }
        if (userRes.status === 'fulfilled') setUserOptions(userRes.value.data ?? [])
      },
    )
    return () => {
      ignore = true
    }
  }, [])

  // 수주 선택 시 상세 조회 (옵션 응답에는 납기·수량·배분이 없음)
  useEffect(() => {
    if (!form.orderCode) {
      setOrderDetail(null)
      setIsDetailLoading(false)
      return
    }
    let ignore = false
    setOrderDetail(null)
    setIsDetailLoading(true)
    FiberSalesOrderApi.getDetail(form.orderCode)
      .then((res) => {
        if (!ignore) setOrderDetail(res.data ?? null)
      })
      .catch((error) => {
        if (ignore) return
        console.error('섬유 수주 상세 조회 실패:', error)
        window.alert(getErrorMessage(error, '수주 상세를 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!ignore) setIsDetailLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [form.orderCode])

  const orderSelectOptions = useMemo<SelectBoxOption[]>(
    () =>
      orders.map((order) => ({
        value: order.orderCode,
        label: `${order.orderCode} · ${order.bpNm ?? '-'}`,
        description: order.rawItemNm ?? order.rawItemCode ?? '-',
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

  const selectedOption = orders.find((o) => o.orderCode === form.orderCode) ?? null
  const selectedManager = userOptions.find((u) => u.userId === form.managerId)

  // 상세가 오기 전에는 옵션 정보로 먼저 보여준다
  const bpNm = orderDetail?.bpNm ?? selectedOption?.bpNm ?? ''
  const rawItemNm = orderDetail?.rawItemNm ?? selectedOption?.rawItemNm ?? orderDetail?.rawItemCode ?? selectedOption?.rawItemCode ?? ''
  const detailLines = orderDetail?.lines ?? []

  const handleOrderChange = (orderCode: string) => {
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
    { label: '거래처', value: bpNm },
    { label: '수주', value: selectedOption?.orderCode ?? '' },
    {
      label: '원물',
      value: selectedOption
        ? `${rawItemNm} ${orderDetail ? `${fmtKg(orderDetail.requestInputQty)}kg` : ''}`.trim()
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
                    작업할 거래처 수주를 고릅니다. 섬유동은 임가공이라 수주 1건당 작업지시는 1개이며, 아직 작업지시가 없는
                    미배정 수주만 표시됩니다. 제품·원물 LOT·수량은 여기서 정하지 않고, 작업하면서 현장 PC에서 실적 줄로
                    남깁니다.
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
                  {orders.length === 0 && <span className="fwo-sub">작업지시를 등록할 수 있는 미배정 수주가 없습니다.</span>}
                </div>
              </div>

              {selectedOption && (
                <dl className="fwo-readGrid" style={{ marginTop: 16 }}>
                  <div><dt>거래처</dt><dd>{bpNm || '-'}</dd></div>
                  <div><dt>투입원료</dt><dd>{rawItemNm || '-'}</dd></div>
                  <div><dt>납기</dt><dd>{isDetailLoading ? '불러오는 중...' : orderDetail?.dueDate ?? '-'}</dd></div>
                  <div>
                    <dt>수주 원물</dt>
                    <dd>
                      {isDetailLoading ? '불러오는 중...' : orderDetail ? `${fmtKg(orderDetail.requestInputQty)} kg` : '-'}
                    </dd>
                  </div>
                  <div className="is-wide">
                    <dt>제품별 배분 (수주에서 가져옴)</dt>
                    <dd>
                      {isDetailLoading
                        ? '불러오는 중...'
                        : detailLines.length > 0 && orderDetail
                          ? detailLines
                              .map(
                                (line) =>
                                  `${line.productItemNm || line.productItemCode} ${fmtKg(line.allocatedInputQty)}kg (${calcPct(
                                    line.allocatedInputQty,
                                    orderDetail.requestInputQty,
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
              <button type="submit" className="primaryButton" disabled={isSubmitting || isDetailLoading}>
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
