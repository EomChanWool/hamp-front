import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import "./NumberInput.css";

type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode" | "min" | "max"
> & {
  ref?: Ref<HTMLInputElement>;
  /** 빈 칸이면 null */
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  /** 소수점 아래 허용 자릿수 (0이면 정수만) */
  decimalScale?: number;
  allowNegative?: boolean;
  max?: number;
  /** max 초과 시 표시할 안내 문구 (미지정 시 기본 문구 사용) */
  maxMessage?: string;
  /** 입력 중에도 천 단위 쉼표 표시 */
  thousandSeparator?: boolean;
  /** 입력칸과 suffix를 감싸는 요소의 클래스 (예: formInputWrap) */
  wrapClassName?: string;
  /** 입력칸 안쪽 단위 표시 등 */
  suffix?: ReactNode;
};

type ParseResult = { ok: true; text: string; value: number | null } | { ok: false; message: string };

// 붙여넣은 값 끝에 붙어 있어도 값의 뜻이 바뀌지 않는 단위
const TRAILING_UNIT = /(\d)(kg|g|l|ml|ea|개|원|%)$/i;
const SIGNIFICANT_CHAR = /[\d.-]/;

/** 뜻을 바꾸지 않는 문자(공백·쉼표·전각 문자)만 정리한다 */
const normalize = (text: string) =>
  text
    .replace(/[０-９．－，]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[−–]/g, "-")
    .replace(/[\s,]/g, "");

const toNumber = (text: string) => (text === "" || text === "-" || text === "." || text === "-." ? null : Number(text));

const countSignificant = (text: string) => [...text].filter((c) => SIGNIFICANT_CHAR.test(c)).length;

/** 쉼표 없는 숫자 문자열을 표시용으로 바꾼다. 입력 중인 "5." 같은 끝 소수점은 그대로 둔다 */
const formatText = (text: string, thousandSeparator: boolean) => {
  const negative = text.startsWith("-");
  const [intPart, fracPart] = (negative ? text.slice(1) : text).split(".");
  let int = intPart.replace(/^0+(?=\d)/, "");
  if (thousandSeparator) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${int}${fracPart === undefined ? "" : `.${fracPart}`}`;
};

/**
 * 숫자 입력칸. 공백·쉼표·전각 숫자(붙여넣을 때는 끝 단위까지)는 정리해서 받고,
 * 음수·형식 오류·자릿수/최대값 초과처럼 값의 뜻이 바뀌는 입력은 반영하지 않고 안내 문구를 띄운다.
 */
export function NumberInput({
  ref,
  value,
  onValueChange,
  decimalScale = 0,
  allowNegative = false,
  max,
  maxMessage,
  thousandSeparator = true,
  wrapClassName,
  suffix,
  onBlur,
  ...inputProps
}: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);
  const hintId = useId();
  // "5."처럼 숫자로 바꾸면 사라지는 입력 중간 모양을 유지하기 위한 원문 (포커스를 벗어나면 비움)
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const caretRef = useRef<{ significantBefore: number } | { position: number } | null>(null);
  // 값·상태가 그대로인 입력(쉼표만 지움, 거부된 입력 등)에도 다시 렌더링해 커서를 복원한다
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  const currentValue = value ?? null;
  const display =
    draft !== null && toNumber(draft) === currentValue
      ? formatText(draft, thousandSeparator)
      : currentValue === null
        ? ""
        : formatText(String(currentValue), thousandSeparator);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const pending = caretRef.current;
    if (!input || pending === null) return;
    caretRef.current = null;

    let caret = 0;
    if ("position" in pending) {
      caret = Math.max(0, Math.min(pending.position, input.value.length));
    } else {
      let seen = 0;
      while (caret < input.value.length && seen < pending.significantBefore) {
        if (SIGNIFICANT_CHAR.test(input.value[caret])) seen++;
        caret++;
      }
    }
    input.setSelectionRange(caret, caret);
  });

  const parse = (raw: string, pasted: boolean): ParseResult => {
    const normalized = normalize(raw);
    // 끝 단위(kg, 원 등)는 붙여넣을 때만 정리한다 (직접 친 단위 글자는 다른 문자처럼 안내)
    const text = pasted ? normalized.replace(TRAILING_UNIT, "$1") : normalized;
    if (!/^-?\d*\.?\d*$/.test(text)) return { ok: false, message: "숫자만 입력할 수 있습니다." };
    if (text.startsWith("-") && !allowNegative) return { ok: false, message: "음수는 입력할 수 없습니다." };
    if (text.includes(".")) {
      if (decimalScale === 0) return { ok: false, message: "소수는 입력할 수 없습니다." };
      if (text.split(".")[1].length > decimalScale) {
        return { ok: false, message: `소수점 아래 ${decimalScale}자리까지 입력할 수 있습니다.` };
      }
    }
    const next = toNumber(text);
    if (next !== null) {
      if (max != null && next > max) {
        return { ok: false, message: maxMessage ?? `${max.toLocaleString("ko-KR")} 이하로 입력해주세요.` };
      }
      if (Math.abs(next) > Number.MAX_SAFE_INTEGER) return { ok: false, message: "입력할 수 있는 범위를 넘었습니다." };
    }
    return { ok: true, text, value: next };
  };

  const input = (
    <input
      {...inputProps}
      ref={inputRef}
      type="text"
      inputMode={decimalScale > 0 ? "decimal" : "numeric"}
      value={display}
      aria-invalid={error ? true : inputProps["aria-invalid"]}
      aria-describedby={
        [inputProps["aria-describedby"], error ? hintId : undefined].filter(Boolean).join(" ") || undefined
      }
      onChange={(e) => {
        const raw = e.target.value;
        const caret = e.target.selectionStart ?? raw.length;
        const inputType = (e.nativeEvent as InputEvent).inputType;
        const result = parse(raw, inputType === "insertFromPaste" || inputType === "insertFromDrop");
        forceRender();
        if (!result.ok) {
          // 값은 그대로 두고, 커서는 입력 전 자리로 되돌린다
          caretRef.current = { position: caret - (raw.length - display.length) };
          setError(result.message);
          return;
        }
        caretRef.current = {
          // 0으로 바뀌면 커서를 "0" 뒤에 두어, 이어서 입력한 숫자가 0 앞에 붙지 않게 함
          significantBefore:
            result.value === 0 && !result.text.includes(".")
              ? Infinity
              : countSignificant(normalize(raw.slice(0, caret))),
        };
        setError(null);
        setDraft(result.text);
        onValueChange(result.value);
      }}
      onBlur={(e) => {
        setDraft(null);
        setError(null);
        onBlur?.(e);
      }}
    />
  );

  return (
    <>
      {wrapClassName !== undefined || suffix !== undefined ? (
        <div className={wrapClassName}>
          {input}
          {suffix}
        </div>
      ) : (
        input
      )}
      {error && (
        <span className="numberInputHint" id={hintId} role="alert">
          {error}
        </span>
      )}
    </>
  );
}
