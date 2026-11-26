import { useCallback, useEffect, useMemo, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Barcode from 'react-barcode'
import { Badge } from '@/components/common/Badge'
import Spinner from '@/components/common/Spinner'
import { SelectBox, type SelectBoxOption } from '@/components/common/SelectBox'
import { formatDateTime } from '@/utils/common'
import { UserApi, type UserOptionResponse } from '@/api/User'
import {
  FiberWorkOrderApi,
  type FiberInputReceiptResponse,
  type FiberWorkOrderDetailResponse,
} from '@/api/FiberWorkOrder'
import {
  FIBER_WO_STATUS_LABEL,
  FIBER_WO_STATUS_TONE,
  calcPct,
  canCancelWo,
  canDeleteWo,
  canEditWo,
  canReopenWo,
  canRevertStartWo,
  fmtKg,
  getErrorMessage,
} from '@/utils/fiberWorkOrder'
import '@/pages/layout/Layout.css'
import '@/pages/page/inpiSales/InpiSales.css'
import '@/pages/page/inpi/Inpi.css'

const LIST_PATH = '/inpi/work-orders'

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** 작업지시서 인쇄 (새 창에 A4 양식을 그려 인쇄 대화상자를 연다) */
function printWorkOrderSheet(detail: FiberWorkOrderDetailResponse, receipts: FiberInputReceiptResponse[]) {
  const { workOrder: wo, products } = detail
  const barcode = renderToStaticMarkup(<Barcode value={wo.workId} width={1.8} height={64} fontSize={14} margin={0} />)

  const productRows = products
    .map(
      (p) =>
        `<tr><td>${esc(p.productItemNm || p.productItemCode)}</td><td class="num">${fmtKg(p.allocatedQty)} kg</td><td></td></tr>`,
    )
    .join('')
  const receiptRows = receipts.length
    ? receipts
        .map((r) => `<tr><td>${esc(r.receiptLotCode)}</td><td class="num">${fmtKg(r.receiptQty)} kg</td></tr>`)
        .join('')
    : '<tr><td colspan="2">입고 없음</td></tr>'

  const win = window.open('', '_blank', 'width=860,height=960')
  if (!win) {
    window.alert('팝업이 차단되어 인쇄 창을 열 수 없습니다. 팝업 허용 후 다시 시도해 주세요.')
    return
  }
  win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(wo.workId)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Noto Sans KR','Malgun Gothic',sans-serif; color: #111; font-size: 13px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 12px; }
  .barcode { text-align: center; padding: 10px; border: 1px dashed #bbb; margin-bottom: 12px; }
  .barcode b { display: block; margin-top: 4px; font-family: monospace; letter-spacing: .12em; }
  .bp { border: 2px solid #111; padding: 10px 14px; margin-bottom: 12px; }
  .bp small { color: #555; }
  .bp strong { display: block; font-size: 24px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #eee; }
  td.num { text-align: right; }
  ol { line-height: 1.7; padding-left: 18px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sign div { border: 1px solid #999; height: 56px; padding: 6px 8px; font-size: 12px; color: #666; }
</style></head><body>
  <h1>섬유동 작업지시서</h1>
  <div class="meta">상태 ${esc(FIBER_WO_STATUS_LABEL[wo.status] ?? wo.status)} · 예정 시작일 ${esc(wo.workDate)} · 담당 ${esc(wo.managerNm || wo.managerId || '미지정')}</div>
  <div class="barcode">${barcode}<b>${esc(wo.workId)}</b></div>
  <div class="bp"><small>거래처 (이 거래처 원물만 사용)</small><strong>${esc(wo.bpNm)}</strong>
    <small>${esc(wo.orderCode)} · ${esc(wo.rawItemNm || wo.rawItemCode)} ${fmtKg(wo.requestInputQty)} kg · 납기 ${esc(wo.dueDate)}</small></div>
  <table><thead><tr><th>제품</th><th>배분 원물</th><th>비고</th></tr></thead><tbody>${productRows}</tbody></table>
  <table><thead><tr><th>입고 LOT (출력 시점)</th><th>입고량</th></tr></thead><tbody>${receiptRows}</tbody></table>
  <table><tbody><tr><th style="width:110px">지시사항</th><td>${esc(wo.note) || '-'}</td></tr></tbody></table>
  <ol>
    <li>작업 시작 전 위 바코드를 한 번 스캔합니다. (작업 시작 기록)</li>
    <li>베일·캔이 하나 나올 때마다 현장 PC에 실적 줄을 남깁니다. 쓴 원물 LOT과 kg을 같이 적습니다.</li>
    <li>이 거래처 작업이 모두 끝나면 현장 PC에서 <b>작업 완료</b>를 누르고 숙성 기간·가습 여부를 입력합니다.</li>
  </ol>
  <div class="sign"><div>작업자</div><div>확인</div></div>
</body></html>`)
  win.document.close()
  win.focus()
  window.setTimeout(() => win.print(), 300)
}

export function InpiWorkOrderDetailPage() {
  const { workId: rawWorkId } = useParams<{ workId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const workId = useMemo(() => {
    if (!rawWorkId) return ''
    try {
      return decodeURIComponent(rawWorkId).trim()
    } catch {
      return rawWorkId.trim()
    }
  }, [rawWorkId])

  const [detail, setDetail] = useState<FiberWorkOrderDetailResponse | null>(null)
  const [receipts, setReceipts] = useState<FiberInputReceiptResponse[]>([])
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState({ workDate: '', managerId: '', note: '' })
  const [formError, setFormError] = useState('')

  const goList = () => navigate({ pathname: LIST_PATH, search: location.search })

  const load = useCallback(async () => {
    if (!workId) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await FiberWorkOrderApi.getDetail(workId)
      const data = res.data
      setDetail(data)
      setForm({
        workDate: data.workOrder.workDate ?? '',
        managerId: data.workOrder.managerId ?? '',
        note: data.workOrder.note ?? '',
      })
      // 입고 LOT 조회 실패는 화면 전체를 막지 않는다
      FiberWorkOrderApi.getInputReceipts(workId)
        .then((r) => setReceipts(r.data ?? []))
        .catch((error) => {
          console.error('투입 가능 원물 LOT 조회 실패:', error)
          setReceipts([])
        })
    } catch (error) {
      console.error('섬유 작업지시 상세 조회 실패:', error)
      setLoadError(getErrorMessage(error, '작업지시 상세 정보를 불러오는 중 오류가 발생했습니다.'))
    } finally {
      setIsLoading(false)
    }
  }, [workId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    UserApi.getOptions()
      .then((res) => setUserOptions(res.data ?? []))
      .catch((error) => console.error('회원 옵션 조회 실패:', error))
  }, [])

  const managerOptions = useMemo<SelectBoxOption[]>(
    () => [
      { value: '', label: '미지정' },
      ...userOptions.map((user) => ({ value: user.userId, label: user.userNm ?? user.userId, description: user.userId })),
    ],
    [userOptions],
  )

  /** 서버 액션 공통 처리 (확인 → 호출 → 성공 안내 → 재조회) */
  const runAction = async (confirmMessage: string | null, action: () => Promise<unknown>, doneMessage: string, after?: () => void) => {
    if (isBusy) return
    if (confirmMessage && !window.confirm(confirmMessage)) return
    setIsBusy(true)
    try {
      await action()
      window.alert(doneMessage)
      if (after) after()
      else await load()
    } catch (error) {
      console.error('섬유 작업지시 처리 실패:', error)
      window.alert(getErrorMessage(error, '처리 중 오류가 발생했습니다.'))
    } finally {
      setIsBusy(false)
    }
  }

  if (isLoading && !detail) {
    return (
      <section className="screenStack">
        <div className="formCard">
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        </div>
      </section>
    )
  }

  if (loadError || !detail) {
    return (
      <section className="screenStack">
        <div className="formCard">
          <h1 className="formPageTitle">{workId}</h1>
          <p style={{ margin: '16px 0' }}>{loadError ?? '작업지시를 찾을 수 없습니다.'}</p>
          <div className="formActions">
            <button type="button" className="ghostButton" onClick={goList}>목록으로</button>
            <button type="button" className="primaryButton" onClick={load}>다시 시도</button>
          </div>
        </div>
      </section>
    )
  }

  const { workOrder: wo, products } = detail
  const status = wo.status
  const perfCount = wo.performanceCount ?? 0
  const editable = canEditWo(status)

  const handleSave = () => {
    if (!form.workDate) {
      setFormError('예정 작업 시작일을 입력해 주세요.')
      return
    }
    setFormError('')
    runAction(
      null,
      () =>
        FiberWorkOrderApi.update(wo.workId, {
          workDate: form.workDate,
          managerId: form.managerId || null,
          note: form.note.trim() || null,
        }),
      '수정되었습니다.',
    )
  }

  const handleDelete = () =>
    runAction(
      `${wo.workId} 작업지시를 삭제할까요?\n시작 전(대기)이라 기록 없이 삭제됩니다.`,
      () => FiberWorkOrderApi.delete(wo.workId),
      '삭제되었습니다.',
      goList,
    )

  const handleCancel = () =>
    runAction(
      `${wo.workId} 작업지시를 취소할까요?\n취소하면 같은 수주(${wo.orderCode})로 작업지시를 새로 만들 수 있습니다.`,
      () => FiberWorkOrderApi.cancel(wo.workId),
      '취소되었습니다.',
    )

  const handleRevertStart = () =>
    runAction(
      `${wo.workId}를 잘못 스캔한 경우입니다.\n작업 중 → 대기로 되돌리고 시작 시각(${wo.startAt ? formatDateTime(wo.startAt) : '-'})을 지웁니다.`,
      () => FiberWorkOrderApi.revertStart(wo.workId),
      '대기로 되돌렸습니다.',
    )

  const handleReopen = () =>
    runAction(
      `${wo.workId}를 작업 중으로 되돌릴까요?\n종료 시각이 지워지고 실적을 다시 수정·추가할 수 있습니다. 숙성 기간·가습 여부는 다시 완료할 때 새로 입력합니다.`,
      () => FiberWorkOrderApi.reopen(wo.workId),
      '작업 중으로 되돌렸습니다.',
    )

  const steps: { name: string; desc: string; tone: 'done' | 'now' | 'off' }[] = [
    { name: '대기', desc: '작업지시서 출력', tone: status === 'WAITING' ? 'now' : 'done' },
    {
      name: '작업 중',
      desc: wo.startAt ? `바코드 스캔 ${formatDateTime(wo.startAt)} · 실적 ${perfCount}줄` : '현장에서 바코드 스캔',
      tone: status === 'IN_PROGRESS' ? 'now' : status === 'COMPLETED' ? 'done' : 'off',
    },
    {
      name: '완료',
      desc: wo.endAt ? `PC에서 완료 ${formatDateTime(wo.endAt)}` : 'PC에서 작업 완료 + 숙성 기록',
      tone: status === 'COMPLETED' ? 'done' : 'off',
    },
  ]

  const selectedManager = userOptions.find((u) => u.userId === form.managerId)
  const summaryRows: { label: string; value: string }[] = [
    { label: '거래처', value: wo.bpNm },
    { label: '수주', value: wo.orderCode },
    { label: '원물', value: `${wo.rawItemNm || wo.rawItemCode} ${fmtKg(wo.requestInputQty)}kg` },
    { label: '시작일', value: form.workDate },
    { label: '담당자', value: selectedManager ? selectedManager.userNm ?? selectedManager.userId : wo.managerNm ?? '' },
    { label: '실적', value: `${perfCount}줄 · 투입 ${fmtKg(wo.inputQty)}kg · 생산 ${fmtKg(wo.outputQty)}kg` },
  ]

  return (
    <section className="screenStack relative">
      {(isLoading || isBusy) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(255,255,255,.5)' }}>
          <Spinner />
        </div>
      )}

      <div className="formPage">
        <div className="formPageHead">
          <h1 className="formPageTitle">
            <span className="fwo-code" style={{ fontSize: 20 }}>{wo.workId}</span>
            <Badge tone={FIBER_WO_STATUS_TONE[status] ?? 'muted'}>{FIBER_WO_STATUS_LABEL[status] ?? status}</Badge>
          </h1>
          <span className="formPageMeta">등록 {wo.createdAt ? formatDateTime(wo.createdAt) : '-'}</span>
        </div>

        {/* 진행 단계 */}
        <div className="fwo-flow" style={{ marginBottom: 16 }}>
          {status === 'CANCELLED' ? (
            <div className="fwo-flowStep is-off" style={{ gridColumn: '1 / -1' }}>
              <b>취소된 작업지시</b>
              <span>같은 수주로 작업지시를 새로 만들 수 있습니다.</span>
            </div>
          ) : (
            steps.map((step) => (
              <div key={step.name} className={`fwo-flowStep is-${step.tone}`}>
                <b>{step.name}</b>
                <span>{step.desc}</span>
              </div>
            ))
          )}
        </div>

        <div className="formLayout">
          <div className="formMain">
            {/* 수주 */}
            <section className="formCard">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle">수주</h2>
                  <p className="formCardDesc">
                    이 작업지시의 수주입니다. 등록 후에는 바꿀 수 없습니다(다른 수주로 옮기려면 취소 후 새로 등록).
                  </p>
                </div>
              </div>
              <dl className="fwo-readGrid">
                <div><dt>수주</dt><dd className="fwo-code">{wo.orderCode}</dd></div>
                <div><dt>거래처</dt><dd>{wo.bpNm}</dd></div>
                <div><dt>납기</dt><dd>{wo.dueDate || '-'}</dd></div>
                <div><dt>투입원료</dt><dd>{wo.rawItemNm || wo.rawItemCode}</dd></div>
                <div><dt>수주 원물</dt><dd>{fmtKg(wo.requestInputQty)} kg</dd></div>
                <div><dt>입고 LOT</dt><dd>{receipts.length}건 · {fmtKg(receipts.reduce((s, r) => s + r.receiptQty, 0))} kg</dd></div>
              </dl>
            </section>

            {/* 제품별 배분 대비 실적 */}
            <section className="formCard">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle">제품별 배분 대비 실적</h2>
                  <p className="formCardDesc">
                    계획은 수주에서 제품별로 배분한 원물(kg)입니다. 실적 줄이 쌓이면 실제 투입량이 채워지고, 계획보다 많이
                    투입하면 100%를 넘어도 그대로 표시합니다.
                  </p>
                </div>
              </div>
              <div className="fwo-prodList">
                {products.length === 0 && <p className="fwo-empty">배분된 제품이 없습니다.</p>}
                {products.map((p) => {
                  const pct = calcPct(p.inputQty, p.allocatedQty)
                  return (
                    <div className="fwo-prodRow" key={p.productItemCode}>
                      <div className="fwo-prodRow__nm">
                        {p.productItemNm || p.productItemCode}
                        <small>배분 {fmtKg(p.allocatedQty)} kg</small>
                      </div>
                      <div className="fwo-prodBar" role="img" aria-label={`${p.productItemNm} ${pct}%`}>
                        <span className={pct > 100 ? 'is-over' : ''} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div className="fwo-prodRow__val">
                        <b>{fmtKg(p.inputQty)}</b> / {fmtKg(p.allocatedQty)} kg 투입 · {pct}%
                        <br />
                        <span className="is-muted">
                          생산 {fmtKg(p.outputQty)} kg · 남은 배분 {fmtKg(p.remainingQty)} kg
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 입고 LOT */}
            <section className="formCard">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle">이 수주로 들어온 원물 LOT</h2>
                  <p className="formCardDesc">
                    미리 배정하지 않습니다. 현장 PC에서 실적 줄을 남길 때 실제로 쓴 LOT과 kg을 적습니다(여러 LOT을 섞어도
                    됨).
                  </p>
                </div>
              </div>
              <div className="fwo-tableWrap">
                <table className="fwo-table">
                  <thead>
                    <tr>
                      <th>입고 LOT</th>
                      <th>원료</th>
                      <th>입고일시</th>
                      <th className="is-num">입고량</th>
                      <th className="is-num">실적 투입</th>
                      <th className="is-num">남은 양</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="fwo-empty">이 수주로 들어온 입고가 아직 없습니다.</td>
                      </tr>
                    ) : (
                      receipts.map((r) => (
                        <tr key={r.receiptId}>
                          <td><span className="fwo-code">{r.receiptLotCode}</span></td>
                          <td>{r.rawItemNm || r.rawItemCode}</td>
                          <td>{r.receivedAt ? formatDateTime(r.receivedAt) : '-'}</td>
                          <td className="is-num">{fmtKg(r.receiptQty)} kg</td>
                          <td className="is-num">{fmtKg(r.usedQty)} kg</td>
                          <td className="is-num"><b>{fmtKg(r.remainingQty)} kg</b></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 지시 내용 */}
            <section className="formCard">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle">지시 내용</h2>
                  <p className="formCardDesc">
                    {editable
                      ? '예정 시작일·담당자·지시사항은 대기와 작업 중일 때 고칠 수 있습니다(작업 내용은 실적 줄에 있어서 현장과 충돌하지 않음).'
                      : '완료/취소된 작업지시는 고칠 수 없습니다.'}
                  </p>
                </div>
              </div>
              <div className="formGrid">
                <div className="formField col3">
                  <label className="formLabel" htmlFor="fwo-d-date">
                    예정 시작일 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="fwo-d-date"
                    type="date"
                    className="formInput"
                    value={form.workDate}
                    aria-invalid={!!formError || undefined}
                    disabled={!editable || isBusy}
                    onChange={(e) => setForm((prev) => ({ ...prev, workDate: e.target.value }))}
                  />
                  {formError && <span className="fwo-fieldError">{formError}</span>}
                </div>
                <div className="formField col3">
                  <label className="formLabel" htmlFor="fwo-d-manager">담당자</label>
                  <SelectBox
                    id="fwo-d-manager"
                    value={form.managerId}
                    options={managerOptions}
                    placeholder="미지정"
                    searchPlaceholder="담당자 이름 또는 아이디 검색"
                    searchable
                    disabled={!editable || isBusy}
                    onChange={(v) => setForm((prev) => ({ ...prev, managerId: v }))}
                  />
                </div>
                <div className="formField col6">
                  <label className="formLabel" htmlFor="fwo-d-note">작업 지시사항</label>
                  <textarea
                    id="fwo-d-note"
                    className="formInput"
                    maxLength={255}
                    value={form.note}
                    disabled={!editable || isBusy}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            {/* 실적 요약 (실적 줄 입력/수정은 생산실적관리 화면) */}
            <section className="formCard">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle">실적 요약</h2>
                  <p className="formCardDesc">
                    실적 줄 입력과 수정은 현장 PC의 생산실적관리 화면에서 합니다. 여기서는 합계만 확인합니다.
                  </p>
                </div>
              </div>
              <dl className="fwo-readGrid">
                <div><dt>실적 줄 수</dt><dd>{perfCount}줄</dd></div>
                <div><dt>원물 투입 합계</dt><dd>{fmtKg(wo.inputQty)} kg</dd></div>
                <div><dt>생산 합계</dt><dd>{fmtKg(wo.outputQty)} kg</dd></div>
              </dl>
            </section>

            {/* 작업 완료 기록 */}
            {status === 'COMPLETED' && (
              <section className="formCard">
                <div className="formCardHead">
                  <div>
                    <h2 className="formCardTitle">작업 완료 기록</h2>
                    <p className="formCardDesc">현장 PC에서 작업 완료할 때 입력한 값입니다. 숙성은 시작/종료 없이 결과만 남깁니다.</p>
                  </div>
                </div>
                <dl className="fwo-readGrid">
                  <div><dt>작업 종료</dt><dd>{wo.endAt ? formatDateTime(wo.endAt) : '-'}</dd></div>
                  <div><dt>숙성 기간</dt><dd>{wo.agingDays ?? 0}일</dd></div>
                  <div><dt>가습</dt><dd>{wo.humidified ? '함' : '안 함'}</dd></div>
                </dl>
              </section>
            )}
          </div>

          {/* 우측 요약 + 액션 */}
          <aside className="formCard formAside" aria-label="작업지시 요약">
            <h2 className="formCardTitle">작업지시 요약</h2>
            <dl className="formSummaryList">
              {summaryRows.map((row) => (
                <div className="formSummaryRow" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className={row.value ? undefined : 'isEmpty'}>{row.value || '미입력'}</dd>
                </div>
              ))}
            </dl>

            {status === 'IN_PROGRESS' && (
              <div className="fwo-info">
                실적 줄 입력과 <b>작업 완료</b>(숙성 기간·가습 여부 입력)는 현장 PC의 생산실적관리 화면에서 합니다.
              </div>
            )}
            {status === 'COMPLETED' && (
              <div className="fwo-info">
                완료된 작업지시는 실적을 고칠 수 없습니다. 고쳐야 하면 완료 취소 후 생산실적관리 화면에서 수정합니다. 수주
                완료는 별도로 처리합니다.
              </div>
            )}
            {status === 'CANCELLED' && (
              <div className="fwo-info">취소된 작업지시입니다. 같은 수주로 작업지시를 새로 만들 수 있습니다.</div>
            )}

            <div className="formActions">
              {editable && (
                <button type="button" className="primaryButton" onClick={handleSave} disabled={isBusy}>
                  수정 저장
                </button>
              )}
              {canReopenWo(status) && (
                <button type="button" className="primaryButton" onClick={handleReopen} disabled={isBusy}>
                  완료 취소 (작업 중으로)
                </button>
              )}
              {status !== 'CANCELLED' && (
                <button type="button" className="ghostButton" onClick={() => printWorkOrderSheet(detail, receipts)} disabled={isBusy}>
                  작업지시서 출력
                </button>
              )}
              {status === 'IN_PROGRESS' && (
                <button
                  type="button"
                  className="ghostButton"
                  onClick={handleRevertStart}
                  disabled={isBusy || !canRevertStartWo(status, perfCount)}
                >
                  시작 취소 (잘못 스캔)
                </button>
              )}
              {(status === 'WAITING' || status === 'IN_PROGRESS') && (
                <button
                  type="button"
                  className="ghostButton"
                  onClick={handleCancel}
                  disabled={isBusy || !canCancelWo(status, perfCount)}
                >
                  작업지시 취소
                </button>
              )}
              {status === 'IN_PROGRESS' && perfCount > 0 && (
                <p className="fwo-disabledReason">
                  실적 줄이 {perfCount}개 있어 시작 취소/작업지시 취소를 할 수 없습니다. 실적을 먼저 삭제해야 합니다.
                </p>
              )}
              {canDeleteWo(status) && (
                <button type="button" className="btnDanger" onClick={handleDelete} disabled={isBusy}>
                  삭제
                </button>
              )}
              <button type="button" className="ghostButton" onClick={goList} disabled={isBusy}>
                목록으로
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
