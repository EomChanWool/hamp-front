export function formatNum(value: number | null | undefined, maxDigits = 2) {
  if (value == null) return '-'
  return Number(value).toLocaleString('ko-KR', { maximumFractionDigits: maxDigits })
}

export function formatKg(value: number | null | undefined) {
  return value == null ? '-' : `${formatNum(value, 2)} kg`
}
