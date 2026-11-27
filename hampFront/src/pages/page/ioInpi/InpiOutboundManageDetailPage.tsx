import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import Barcode from 'react-barcode'
import { Badge } from '@/components/common/Badge'
import Spinner from '@/components/common/Spinner'
import { SelectBox, type SelectBoxOption } from '@/components/common/SelectBox'
import { formatDateTime } from '@/utils/common'
import { UserApi, type UserOptionResponse } from '@/api/User'
import {
  FiberShipmentApi,
  type FiberShipmentDetailResponse,
  type FiberShippableLotResponse,
} from '@/api/ioInpi/FiberShipment'
import { fmtKg, getErrorMessage } from '@/utils/fiberWorkOrder'
import {
  FIBER_SHIP_STATUS_LABEL,
  FIBER_SHIP_STATUS_TONE,
  buildShipLines,
  canCancelShip,
  canConfirmShip,
  canDeleteShip,
  canEditShip,
  canPrintShip,
  canRevertScan,
  canRevertShip,
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

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** 바코드 SVG 문자열 생성 (작업지시서 인쇄와 같은 방식) */
async function buildBarcodeSvg(value: string): Promise<string> {
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    flushSync(() => {
      root.render(<Barcode value={value} width={1.8} height={64} margin={0} displayValue={false} />)
    })
    if (!host.querySelector('svg rect, svg path')) {
      await new Promise((resolve) => window.setTimeout(resolve, 50))
    }
    return host.innerHTML
  } catch (error) {
    console.error('바코드 생성 실패:', error)
    return ''
  } finally {
    root.unmount()
  }
}

/** 출고지시서 인쇄 (새 창에 A4 양식을 그려 인쇄 대화상자를 연다) */
async function printShipmentSheet(detail: FiberShipmentDetailResponse) {
  const { shipment: s, lines } = detail

  const lineRows = lines.length
    ? lines
        .map(
          (l) =>
            `<tr><td></td><td class="mono">${esc(l.productLotCode)}</td><td>${esc(l.productItemNm || l.productItemCode)}</td>` +
            `<td class="num">${fmtKg(l.shipQty)} kg${l.shipQty < l.outputQty ? ` <small>(LOT ${fmtKg(l.outputQty)} kg 중 일부)</small>` : ''}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="4">실을 제품 LOT 없음</td></tr>'

  const win = window.open('', '_blank', 'width=860,height=960')
  if (!win) {
    window.alert('팝업이 차단되어 인쇄 창을 열 수 없습니다. 팝업 허용 후 다시 시도해 주세요.')
    return
  }
  // 팝업은 클릭 직후 동기적으로 먼저 열고(차단 방지), 바코드는 그 뒤에 만든다
  const barcode = await buildBarcodeSvg(s.shipId)
  win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(s.shipId)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Noto Sans KR','Malgun Gothic',sans-serif; color: #111; font-size: 13px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 12px; }
  .barcode { text-align: center; padding: 10px; border: 1px dashed #bbb; margin-bottom: 12px; }
  .barcode svg { max-width: 100%; height: auto; }
  .barcode b { display: block; margin-top: 4px; font-family: monospace; letter-spacing: .12em; }
  .bp { border: 2px solid #111; padding: 10px 14px; margin-bottom: 12px; }
  .bp small { color: #555; }
  .bp strong { display: block; font-size: 24px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #eee; }
  td.num { text-align: right; }
  td.mono { font-family: monospace; }
  td small { color: #555; }
  tfoot td { font-weight: 700; }
  ol { line-height: 1.7; padding-left: 18px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sign div { border: 1px solid #999; height: 56px; padding: 6px 8px; font-size: 12px; color: #666; }
</style></head><body>
  <h1>섬유동 출고지시서</h1>
  <div class="meta">상태 ${esc(FIBER_SHIP_STATUS_LABEL[s.status] ?? s.status)} · 출고 예정일 ${esc(s.shipDate)} · 출고 담당 ${esc(s.managerNm || s.managerId || '미지정')}</div>
  <div class="barcode">${barcode}<b>${esc(s.shipId)}</b></div>
  <div class="bp"><small>거래처 (이 거래처 제품만 싣습니다)</small><strong>${esc(s.bpNm)}</strong>
    <small>${esc(s.orderCode)} · 출고 예정일 ${esc(s.shipDate)}</small></div>
  <table><tbody>
    <tr><th style="width:110px">인도 장소</th><td>${esc(s.shipDest) || '-'}</td></tr>
    <tr><th>인수자 · 특이사항</th><td>${esc(s.note) || '-'}</td></tr>
  </tbody></table>
  <table><thead><tr><th style="width:40px">확인</th><th>제품 LOT</th><th>제품</th><th>출고 중량</th></tr></thead>
    <tbody>${lineRows}</tbody>
    <tfoot><tr><td colspan="3">합계 ${lines.length}개</td><td class="num">${fmtKg(s.totalShipQty)} kg</td></tr></tfoot>
  </table>
  <ol>
    <li>위 표의 제품 LOT 라벨과 실물을 대조하고 확인란에 체크합니다.</li>
    <li>차량에 다 실었으면 <b>위 바코드를 한 번</b> 스캔합니다. 사무실 PC의 출고 확인 대기 목록에 올라갑니다.</li>
    <li>일부 LOT이 못 나갔으면 스캔하지 말고 사무실에 알려 지시서를 고친 뒤 출고합니다.</li>
  </ol>
  <div class="sign"><div>출고 담당자</div><div>인수자 서명</div></div>
</body></html>`)
  win.document.close()
  win.focus()
  window.setTimeout(() => win.print(), 300)
}

type FormState = { shipDate: string; shipDest: string; managerId: string; note: string }

export function InpiOutboundManageDetailPage() {
  const { shipId: rawShipId } = useParams<{ shipId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const shipId = useMemo(() => {
    if (!rawShipId) return ''
    try {
      return decodeURIComponent(rawShipId).trim()
    } catch {
      return rawShipId.trim()
    }
  }, [rawShipId])

  const [detail, setDetail] = useState<FiberShipmentDetailResponse | null>(null)
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({ shipDate: '', shipDest: '', managerId: '', note: '' })
  const [formError, setFormError] = useState('')

  // 수정 모드
  const [editing, setEditing] = useState(false)
  const [lots, setLots] = useState<FiberShippableLotResponse[]>([])
  const [isLotLoading, setIsLotLoading] = useState(false)
  const [picks, setPicks] = useState<LotPicks>({})

  const goList = () => navigate({ pathname: LIST_PATH, search: location.search })

  const fillForm = (data: FiberShipmentDetailResponse) =>
    setForm({
      shipDate: data.shipment.shipDate ?? '',
      shipDest: data.shipment.shipDest ?? '',
      managerId: data.shipment.managerId ?? '',
      note: data.shipment.note ?? '',
    })

  const load = useCallback(async () => {
    if (!shipId) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await FiberShipmentApi.getDetail(shipId)
      setDetail(res.data)
      fillForm(res.data)
      setEditing(false)
      setFormError('')
    } catch (error) {
      console.error('섬유 출고지시서 상세 조회 실패:', error)
      setLoadError(getErrorMessage(error, '출고지시서 상세 정보를 불러오는 중 오류가 발생했습니다.'))
    } finally {
      setIsLoading(false)
    }
  }, [shipId])

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
  const runAction = async (
    confirmMessage: string | null,
    action: () => Promise<unknown>,
    doneMessage: string,
    after?: () => void,
  ) => {
    if (isBusy) return
    if (confirmMessage && !window.confirm(confirmMessage)) return
    setIsBusy(true)
    try {
      await action()
      window.alert(doneMessage)
      if (after) after()
      else await load()
    } catch (error) {
      console.error('섬유 출고지시서 처리 실패:', error)
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
          <h1 className="formPageTitle">{shipId}</h1>
          <p style={{ margin: '16px 0' }}>{loadError ?? '출고지시서를 찾을 수 없습니다.'}</p>
          <div className="formActions">
            <button type="button" className="ghostButton" onClick={goList}>목록으로</button>
            <button type="button" className="primaryButton" onClick={load}>다시 시도</button>
          </div>
        </div>
      </section>
    )
  }

  const { shipment: s, lines } = detail
  const status = s.status
  const fieldsDisabled = !editing || isBusy

  // ── 수정 ──
  const startEdit = async () => {
    if (isBusy) return
    setEditing(true)
    setFormError('')
    setPicks(Object.fromEntries(lines.map((l) => [l.perfId, String(l.shipQty)])))
    setLots([])
    setIsLotLoading(true)
    try {
      // 자기 지시서에 잡힌 양은 빼고 계산해야 기존 수량을 그대로 둘 수 있다
      const res = await FiberShipmentApi.getShippableLots(s.orderCode, s.shipId)
      setLots(res.data ?? [])
    } catch (error) {
      console.error('출고 가능 제품 LOT 조회 실패:', error)
      window.alert(getErrorMessage(error, '제품 LOT 목록을 불러오지 못했습니다.'))
      setEditing(false)
    } finally {
      setIsLotLoading(false)
    }
  }

  const stopEdit = () => {
    setEditing(false)
    setFormError('')
    fillForm(detail)
  }

  const handleSave = () => {
    if (!form.shipDate) {
      setFormError('출고 예정일을 입력해 주세요.')
      return
    }
    const lineError = validateShipLines(lots, picks)
    if (lineError) {
      setFormError(lineError)
      return
    }
    setFormError('')
    runAction(
      null,
      () =>
        FiberShipmentApi.update(s.shipId, {
          shipDate: form.shipDate,
          shipDest: form.shipDest.trim() || undefined,
          managerId: form.managerId || undefined,
          note: form.note.trim() || undefined,
          lines: buildShipLines(picks),
        }),
      '수정되었습니다. (지시서 번호는 그대로)',
    )
  }

  // ── 상태 액션 ──
  const handleDelete = () =>
    runAction(
      `${s.shipId} 출고지시서를 삭제할까요?\n출고 전이라 재고 변동 없이 기록이 지워집니다.`,
      () => FiberShipmentApi.remove(s.shipId),
      '삭제되었습니다.',
      goList,
    )

  const handleCancel = () =>
    runAction(
      `${s.shipId} 출고지시서를 취소할까요?\n기록은 남고, 이 지시서에 잡혀 있던 제품 LOT 양은 다른 지시서에 다시 넣을 수 있게 풀립니다.`,
      () => FiberShipmentApi.cancel(s.shipId),
      '취소되었습니다.',
    )

  const handleConfirm = () =>
    runAction(
      `${s.shipId} (${fmtKg(s.totalShipQty)} kg)를 출고 처리할까요?\n제품 재고가 빠지고, 출고일시는 스캔 시각(${s.scannedAt ? formatDateTime(s.scannedAt) : '-'}), 출고자는 지금 로그인한 사람으로 기록됩니다.`,
      () => FiberShipmentApi.confirm([s.shipId]),
      '출고 처리했습니다.',
    )

  const handleRevertScan = () =>
    runAction(
      `${s.shipId}를 출고 대기로 되돌릴까요?\n현장에서 잘못 찍은 경우입니다. 재고는 아직 안 빠졌으므로 변동이 없습니다.`,
      () => FiberShipmentApi.revertScan(s.shipId),
      '출고 대기로 되돌렸습니다.',
    )

  const handleRevertShip = () =>
    runAction(
      `${s.shipId}를 스캔됨(출고 확인 대기)으로 되돌릴까요?\n빠졌던 제품 재고 ${fmtKg(s.totalShipQty)} kg이 다시 들어오고, 출고일시와 확인자가 지워집니다.\n스캔 자체가 잘못이었다면 이어서 스캔 취소를 누르세요.`,
      () => FiberShipmentApi.revertShip(s.shipId),
      '스캔됨으로 되돌렸습니다.',
    )

  // ── 진행 단계 ──
  const steps: { name: string; desc: string; tone: 'done' | 'now' | 'off' }[] = [
    { name: '① 지시서 등록', desc: s.createdAt ? formatDateTime(s.createdAt) : '-', tone: 'done' },
    {
      name: '② 인쇄 · 작업자 전달',
      desc: status === 'WAITING' ? '현장 스캔 대기 중' : '전달 완료',
      tone: status === 'WAITING' ? 'now' : 'done',
    },
    {
      name: '③ 현장 바코드 스캔',
      desc: s.scannedAt
        ? `${formatDateTime(s.scannedAt)}${status === 'SCANNED' ? ' · PC 확인 대기' : ''}`
        : '재고 변동 없음',
      tone: status === 'WAITING' ? 'off' : status === 'SCANNED' ? 'now' : 'done',
    },
    {
      name: '④ PC 출고 확인',
      desc:
        status === 'SHIPPED'
          ? `출고 ${s.shippedAt ? formatDateTime(s.shippedAt) : '-'} · 확인 ${s.shippedByNm || s.shippedBy || '-'}`
          : '확인하면 제품 재고 차감',
      tone: status === 'SHIPPED' ? 'done' : 'off',
    },
  ]

  // ── 요약 ──
  const selectedManager = userOptions.find((u) => u.userId === form.managerId)
  const lineCount = editing ? Object.keys(picks).length : lines.length
  const totalQty = editing ? sumPicks(picks) : s.totalShipQty ?? 0
  const productSums = editing
    ? sumByProduct(
        Object.entries(picks).map(([perfId, qty]) => {
          const lot = lots.find((l) => l.perfId === Number(perfId))
          const line = lines.find((l) => l.perfId === Number(perfId))
          return {
            name: lot?.productItemNm || line?.productItemNm || lot?.productItemCode || line?.productItemCode || '-',
            qty: Number(qty),
          }
        }),
      )
    : sumByProduct(lines.map((l) => ({ name: l.productItemNm || l.productItemCode, qty: l.shipQty })))

  const summaryRows: { label: string; value: string }[] = [
    { label: '지시서', value: s.shipId },
    { label: '거래처', value: s.bpNm },
    { label: '수주', value: s.orderCode },
    { label: '예정일', value: form.shipDate },
    { label: '담당자', value: selectedManager ? selectedManager.userNm ?? selectedManager.userId : s.managerNm ?? '' },
    { label: '제품 LOT', value: lineCount ? `${lineCount}개` : '' },
    ...(s.shippedAt
      ? [{ label: '출고', value: `${formatDateTime(s.shippedAt)} · ${s.shippedByNm || s.shippedBy || '-'}` }]
      : []),
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
            <span className="fwo-code" style={{ fontSize: 20 }}>{s.shipId}</span>
            <Badge tone={FIBER_SHIP_STATUS_TONE[status] ?? 'muted'}>{FIBER_SHIP_STATUS_LABEL[status] ?? status}</Badge>
            {editing && <span className="fsh-editTag">수정 중</span>}
          </h1>
          <span className="formPageMeta">
            등록 {s.createdAt ? formatDateTime(s.createdAt) : '-'} · 수정 {s.updatedAt ? formatDateTime(s.updatedAt) : '-'}
          </span>
        </div>

        {/* 진행 단계 */}
        <div className={`fwo-flow ${status === 'CANCELLED' ? '' : 'fsh-flow4'}`} style={{ marginBottom: 16 }}>
          {status === 'CANCELLED' ? (
            <div className="fwo-flowStep is-off" style={{ gridColumn: '1 / -1' }}>
              <b>취소된 출고지시서</b>
              <span>잡혀 있던 제품 LOT 양이 풀려 다른 지시서에 다시 넣을 수 있습니다.</span>
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
                  <p className="formCardDesc">수주는 바꿀 수 없습니다. 다른 수주면 지시서를 새로 등록합니다.</p>
                </div>
              </div>
              <dl className="fwo-readGrid">
                <div><dt>수주</dt><dd className="fwo-code">{s.orderCode}</dd></div>
                <div><dt>거래처</dt><dd>{s.bpNm || '-'}</dd></div>
                <div><dt>거래처 코드</dt><dd>{s.bpCode || '-'}</dd></div>
                <div><dt>제품 LOT</dt><dd>{s.lineCount ?? lines.length}개</dd></div>
                <div><dt>출고 중량</dt><dd>{fmtKg(s.totalShipQty)} kg</dd></div>
                <div><dt>스캔 시각</dt><dd>{s.scannedAt ? formatDateTime(s.scannedAt) : '-'}</dd></div>
              </dl>
            </section>

            {/* 제품 LOT */}
            <section className="formCard">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle">실을 제품 LOT</h2>
                  <p className="formCardDesc">
                    {editing
                      ? '체크하면 남은 양 전부가 채워지고, 일부만 보낼 때는 kg을 줄이면 됩니다. 이 지시서에 원래 잡혀 있던 양은 남은 양에 다시 포함됩니다. 저장하면 기존 라인이 이 목록으로 바뀝니다.'
                      : canEditShip(status)
                        ? '이 지시서에 실린 제품 LOT입니다. 출고 대기일 때 수정할 수 있습니다.'
                        : '이 지시서에 실린 제품 LOT입니다. 현장 스캔 후에는 고칠 수 없습니다.'}
                  </p>
                </div>
              </div>

              {editing ? (
                <FiberShipmentLotPicker
                  lots={lots}
                  picks={picks}
                  onChange={(next) => {
                    setPicks(next)
                    setFormError('')
                  }}
                  loading={isLotLoading}
                  disabled={isBusy}
                />
              ) : (
                <div className="fwo-tableWrap">
                  <table className="fwo-table">
                    <thead>
                      <tr>
                        <th>제품 LOT · 작업일</th>
                        <th>제품</th>
                        <th className="is-num">LOT 생산량</th>
                        <th className="is-num">이번 출고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="fwo-empty">실린 제품 LOT이 없습니다.</td>
                        </tr>
                      ) : (
                        lines.map((l) => (
                          <tr key={l.shipLineId}>
                            <td>
                              <span className="fwo-code">{l.productLotCode}</span>
                              <span className="fwo-sub">{l.workDate || '-'}</span>
                            </td>
                            <td>{l.productItemNm || l.productItemCode}</td>
                            <td className="is-num">{fmtKg(l.outputQty)} kg</td>
                            <td className="is-num">
                              <b>{fmtKg(l.shipQty)} kg</b>
                              {l.shipQty < l.outputQty && <span className="fsh-partial">일부</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {lines.length > 0 && (
                      <tfoot>
                        <tr className="fsh-tfoot">
                          <td colSpan={3}>합계 {lines.length}개</td>
                          <td className="is-num">{fmtKg(s.totalShipQty)} kg</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </section>

            {/* 출고 정보 */}
            <section className="formCard">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle">출고 정보</h2>
                  <p className="formCardDesc">
                    담당자는 지시서에 인쇄되는 사람입니다(선택). 실제 출고자는 PC에서 출고 확인을 누른 사람으로 기록됩니다.
                    출고 예정일을 바꿔도 지시서 번호는 처음 예정일 그대로입니다.
                  </p>
                </div>
              </div>
              <div className="formGrid">
                <div className="formField col3">
                  <label className="formLabel" htmlFor="fsh-d-date">
                    출고 예정일 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="fsh-d-date"
                    type="date"
                    className="formInput"
                    value={form.shipDate}
                    aria-invalid={(editing && !form.shipDate) || undefined}
                    disabled={fieldsDisabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, shipDate: e.target.value }))}
                  />
                </div>
                <div className="formField col3">
                  <label className="formLabel" htmlFor="fsh-d-manager">출고 담당자</label>
                  <SelectBox
                    id="fsh-d-manager"
                    value={form.managerId}
                    options={managerOptions}
                    placeholder="미지정"
                    searchPlaceholder="담당자 이름 또는 아이디 검색"
                    searchable
                    disabled={fieldsDisabled}
                    onChange={(v) => setForm((prev) => ({ ...prev, managerId: v }))}
                  />
                </div>
                <div className="formField col6">
                  <label className="formLabel" htmlFor="fsh-d-dest">인도 장소</label>
                  <input
                    id="fsh-d-dest"
                    className="formInput"
                    maxLength={255}
                    value={form.shipDest}
                    disabled={fieldsDisabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, shipDest: e.target.value }))}
                  />
                </div>
                <div className="formField col6">
                  <label className="formLabel" htmlFor="fsh-d-note">인수자 · 특이사항</label>
                  <textarea
                    id="fsh-d-note"
                    className="formInput"
                    maxLength={255}
                    value={form.note}
                    disabled={fieldsDisabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* 우측 요약 + 액션 */}
          <aside className="formCard formAside" aria-label="출고지시서 요약">
            <h2 className="formCardTitle">출고 요약</h2>
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
                <li className="is-empty">고른 제품 LOT이 없습니다.</li>
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

            {!editing && status === 'WAITING' && (
              <div className="fwo-info">
                인쇄해서 작업자에게 주면, 작업자가 출고할 때 지시서 바코드를 한 번 찍습니다. 찍으면 출고 확인 대기 목록에
                올라가고, 재고는 PC에서 출고 확인할 때 빠집니다.
              </div>
            )}
            {!editing && status === 'SCANNED' && (
              <div className="fwo-info">
                현장에서 {s.scannedAt ? formatDateTime(s.scannedAt) : '-'}에 스캔했습니다. 아직 재고는 그대로입니다. 실제로
                나갔으면 <b>출고 확인</b>을 누르세요. 목록 화면 맨 위에서 여러 건을 한꺼번에 확인할 수도 있습니다.
              </div>
            )}
            {!editing && status === 'SHIPPED' && (
              <div className="fwo-info">
                제품 재고에서 빠졌습니다. 실제로 안 나갔거나 확인을 잘못 눌렀으면 출고 취소로 스캔됨 상태로 되돌립니다.
              </div>
            )}
            {status === 'CANCELLED' && (
              <div className="fwo-info">취소된 출고지시서입니다. 같은 수주로 출고지시서를 새로 만들 수 있습니다.</div>
            )}

            {formError && <div className="fsh-errorBox">{formError}</div>}

            <div className="formActions">
              {editing ? (
                <>
                  <button type="button" className="primaryButton" onClick={handleSave} disabled={isBusy || isLotLoading}>
                    수정 저장
                  </button>
                  <button type="button" className="ghostButton" onClick={stopEdit} disabled={isBusy}>
                    수정 취소
                  </button>
                </>
              ) : (
                <>
                  {canConfirmShip(status) && (
                    <button type="button" className="primaryButton" onClick={handleConfirm} disabled={isBusy}>
                      출고 확인
                    </button>
                  )}
                  {canEditShip(status) && (
                    <button type="button" className="primaryButton" onClick={startEdit} disabled={isBusy}>
                      수정
                    </button>
                  )}
                  {canPrintShip(status) && (
                    <button type="button" className="ghostButton" onClick={() => printShipmentSheet(detail)} disabled={isBusy}>
                      출고지시서 출력
                    </button>
                  )}
                  {canRevertScan(status) && (
                    <button type="button" className="ghostButton" onClick={handleRevertScan} disabled={isBusy}>
                      스캔 취소 (잘못 찍음)
                    </button>
                  )}
                  {canRevertShip(status) && (
                    <button type="button" className="ghostButton" onClick={handleRevertShip} disabled={isBusy}>
                      출고 취소 (스캔됨으로)
                    </button>
                  )}
                  {canCancelShip(status) && (
                    <button type="button" className="ghostButton" onClick={handleCancel} disabled={isBusy}>
                      지시서 취소
                    </button>
                  )}
                  {canDeleteShip(status) && (
                    <button type="button" className="btnDanger" onClick={handleDelete} disabled={isBusy}>
                      삭제
                    </button>
                  )}
                  <button type="button" className="ghostButton" onClick={goList} disabled={isBusy}>
                    목록으로
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
