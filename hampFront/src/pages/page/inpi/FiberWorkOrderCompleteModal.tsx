import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/common/Badge'
import { NumberInput } from '@/components/common/NumberInput'
import { FiberWorkOrderApi, type FiberWorkOrderResponse } from '@/api/FiberWorkOrder'
import { formatKg } from '@/pages/page/inpi/inpiPerfUtils'
import { FIBER_WO_STATUS_LABEL, FIBER_WO_STATUS_TONE, getErrorMessage } from '@/utils/fiberWorkOrder'
import { formatDateTime } from '@/utils/common'

type CompleteField = 'general' | 'agingDays' | 'humidified' | 'endAt'
type CompleteErrors = Partial<Record<CompleteField, string>>

interface FiberWorkOrderCompleteModalProps {
  workOrder: FiberWorkOrderResponse
  onClose: () => void
  onCompleted: () => void
}

export function FiberWorkOrderCompleteModal({
  workOrder,
  onClose,
  onCompleted,
}: FiberWorkOrderCompleteModalProps) {
  const [agingDays, setAgingDays] = useState<number | null>(null)
  const [humidified, setHumidified] = useState<'' | 'true' | 'false'>('')
  const [endAt, setEndAt] = useState('')
  const [errors, setErrors] = useState<CompleteErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const agingRef = useRef<HTMLInputElement>(null)
  const humidYesRef = useRef<HTMLInputElement>(null)
  const endAtRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)

  const hasNoPerformance = (workOrder.performanceCount ?? 0) <= 0

  useEffect(() => {
    mountedRef.current = true
    const prevFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!hasNoPerformance) {
      agingRef.current?.focus()
    }
    return () => {
      mountedRef.current = false
      if (prevFocused?.isConnected) prevFocused.focus()
    }
  }, [hasNoPerformance])

  const isDirty = agingDays !== null || humidified !== '' || endAt !== ''

  const handleClose = () => {
    if (isSubmitting) return
    onClose()
  }

  const handleDismiss = () => {
    if (isSubmitting) return
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

  const clearError = (field: CompleteField) => {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const nextErrors: CompleteErrors = {}
    if ((workOrder.performanceCount ?? 0) <= 0) {
      nextErrors.general = `실적이 한 건도 없는 작업지시는 완료할 수 없습니다: ${workOrder.workId}`
    }
    if (agingDays == null) {
      nextErrors.agingDays = '숙성 기간을 입력해 주세요. 숙성하지 않았으면 0을 입력합니다.'
    } else if (!Number.isInteger(agingDays) || agingDays < 0 || agingDays > 365) {
      nextErrors.agingDays = '숙성 기간은 0~365일 사이 정수로 입력해 주세요.'
    }
    if (humidified === '') {
      nextErrors.humidified = '가습 여부를 선택해 주세요.'
    }
    if (endAt) {
      const endMs = new Date(endAt).getTime()
      const startMs = workOrder.startAt ? new Date(workOrder.startAt).getTime() : Number.NaN
      if (Number.isNaN(endMs)) {
        nextErrors.endAt = '올바른 작업 종료일시를 입력해 주세요.'
      } else if (!Number.isNaN(startMs) && endMs < startMs) {
        nextErrors.endAt = `작업 종료일시는 시작일시(${formatDateTime(workOrder.startAt!)})보다 빠를 수 없습니다.`
      } else if (endMs > Date.now()) {
        nextErrors.endAt = '작업 종료일시는 현재 시각 이후일 수 없습니다.'
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      if (nextErrors.agingDays) agingRef.current?.focus()
      else if (nextErrors.humidified) humidYesRef.current?.focus()
      else if (nextErrors.endAt) endAtRef.current?.focus()
      return
    }
    if (agingDays == null || humidified === '') return

    setIsSubmitting(true)
    try {
      await FiberWorkOrderApi.complete(workOrder.workId, {
        agingDays,
        humidified: humidified === 'true',
        endAt: endAt ? `${endAt}:00` : null,
      })
      if (!mountedRef.current) return
      window.alert(`${workOrder.workId} 작업을 완료했습니다.`)
      onCompleted()
    } catch (error) {
      if (!mountedRef.current) return
      console.error('섬유 작업 완료 실패:', error)
      window.alert(getErrorMessage(error, '작업 완료 처리에 실패했습니다.'))
    } finally {
      if (mountedRef.current) setIsSubmitting(false)
    }
  }

  const statusLabel = FIBER_WO_STATUS_LABEL[workOrder.status] ?? workOrder.status
  const statusTone = FIBER_WO_STATUS_TONE[workOrder.status] ?? 'muted'

  return (
    <>
      <div className="modalOverlay" onClick={handleDismiss} />
      <form
        className="detailModal inpiPerfModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inpi-done-modal-title"
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
            <h3 id="inpi-done-modal-title">작업 완료 · {workOrder.bpNm || workOrder.bpCode}</h3>
          </div>
          <button
            type="button"
            className="detailModalClose"
            aria-label="닫기"
            disabled={isSubmitting}
            onClick={handleClose}
          >
            &times;
          </button>
        </div>

        <div className="inpiPerfModalBody">
          <dl className="inpiPerfReadGrid">
            <div>
              <dt>거래처</dt>
              <dd>{workOrder.bpNm || workOrder.bpCode}</dd>
            </div>
            <div>
              <dt>작업지시</dt>
              <dd className="inpiPerfCode">{workOrder.workId}</dd>
            </div>
            <div>
              <dt>상태 · 시작</dt>
              <dd className="inpiPerfStatusInline">
                <Badge tone={statusTone}>{statusLabel}</Badge>
                {workOrder.startAt && (
                  <span className="inpiPerfMuted">{formatDateTime(workOrder.startAt).slice(5)}</span>
                )}
              </dd>
            </div>
          </dl>

          <dl className="inpiPerfReadGrid">
            <div>
              <dt>실적 줄</dt>
              <dd>{workOrder.performanceCount ?? 0}줄</dd>
            </div>
            <div>
              <dt>투입 합계</dt>
              <dd>
                {formatKg(workOrder.inputQty)} / {formatKg(workOrder.requestInputQty)}
              </dd>
            </div>
            <div>
              <dt>생산 합계</dt>
              <dd>{formatKg(workOrder.outputQty)}</dd>
            </div>
          </dl>

          {hasNoPerformance ? (
            <div className="inpiPerfWarnNote" role="alert">
              등록된 실적 줄이 없어 작업을 완료할 수 없습니다. 먼저 실적 줄을 1건 이상 등록해 주세요.
            </div>
          ) : (
            errors.general && (
              <div className="inpiPerfErrorBox" role="alert">
                {errors.general}
              </div>
            )
          )}

          <div className="inpiPerfFormGrid">
            <div className="inpiPerfField">
              <label className="inpiPerfLabel inpiPerfRequired" htmlFor="inpi-done-aging">
                숙성 기간
              </label>
              <NumberInput
                id="inpi-done-aging"
                ref={agingRef}
                wrapClassName="inpiPerfSuffixWrap"
                className="tableInput"
                aria-invalid={errors.agingDays ? true : undefined}
                aria-describedby={errors.agingDays ? 'inpi-done-err-aging' : undefined}
                decimalScale={0}
                max={365}
                placeholder="0"
                disabled={isSubmitting || hasNoPerformance}
                value={agingDays}
                onValueChange={(next) => {
                  setAgingDays(next)
                  clearError('agingDays')
                }}
                suffix={<span>일</span>}
              />
              {errors.agingDays ? (
                <span id="inpi-done-err-aging" className="inpiPerfFieldError" role="alert">
                  {errors.agingDays}
                </span>
              ) : (
                <span className="inpiPerfHint">숙성하지 않았으면 0</span>
              )}
            </div>

            <div className="inpiPerfField">
              <span className="inpiPerfLabel inpiPerfRequired">가습 여부</span>
              <div className="inpiPerfRadioRow" role="radiogroup" aria-label="가습 여부">
                <label>
                  <input
                    ref={humidYesRef}
                    type="radio"
                    name="inpiDoneHumid"
                    value="true"
                    checked={humidified === 'true'}
                    disabled={isSubmitting || hasNoPerformance}
                    onChange={() => {
                      setHumidified('true')
                      clearError('humidified')
                    }}
                  />
                  함
                </label>
                <label>
                  <input
                    type="radio"
                    name="inpiDoneHumid"
                    value="false"
                    checked={humidified === 'false'}
                    disabled={isSubmitting || hasNoPerformance}
                    onChange={() => {
                      setHumidified('false')
                      clearError('humidified')
                    }}
                  />
                  안 함
                </label>
              </div>
              {errors.humidified && (
                <span className="inpiPerfFieldError" role="alert">
                  {errors.humidified}
                </span>
              )}
            </div>

            <div className="inpiPerfField">
              <label className="inpiPerfLabel" htmlFor="inpi-done-end">
                작업 종료일시
              </label>
              <input
                id="inpi-done-end"
                ref={endAtRef}
                type="datetime-local"
                className="tableInput"
                aria-invalid={errors.endAt ? true : undefined}
                aria-describedby={errors.endAt ? 'inpi-done-err-end' : undefined}
                disabled={isSubmitting || hasNoPerformance}
                value={endAt}
                onChange={(e) => {
                  setEndAt(e.target.value)
                  clearError('endAt')
                }}
              />
              {errors.endAt ? (
                <span id="inpi-done-err-end" className="inpiPerfFieldError" role="alert">
                  {errors.endAt}
                </span>
              ) : (
                <span className="inpiPerfHint">비워 두면 지금 시각</span>
              )}
            </div>
          </div>

          <p className="inpiPerfInfoNote">
            완료하면 이 작업지시에는 실적 줄을 더 넣거나 고칠 수 없습니다. 고쳐야 하면 작업지시 화면에서 완료 취소를 합니다.
          </p>
        </div>

        <div className="detailModalFooter">
          <div className="detailModalFooterRight">
            <button type="button" className="inpiPerfPlainBtn" disabled={isSubmitting} onClick={handleClose}>
              닫기
            </button>
            <button type="submit" className="primaryButton" disabled={isSubmitting || hasNoPerformance}>
              {isSubmitting ? '처리 중...' : '작업 완료'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
