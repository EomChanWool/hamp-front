import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";

type AmountInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
};

/** 입력 중에도 천 단위 쉼표를 표시하는 숫자 입력칸. 값은 쉼표 없는 숫자로 전달한다. */
export function AmountInput({ value, onValueChange, ...inputProps }: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digitsBeforeCaretRef = useRef<number | null>(null);

  // 쉼표가 추가·삭제되어도 커서가 같은 숫자 뒤에 머물도록 복원
  useLayoutEffect(() => {
    const input = inputRef.current;
    const digitsBeforeCaret = digitsBeforeCaretRef.current;
    if (!input || digitsBeforeCaret === null) return;
    digitsBeforeCaretRef.current = null;

    let caret = 0;
    let seen = 0;
    while (caret < input.value.length && seen < digitsBeforeCaret) {
      if (/\d/.test(input.value[caret])) seen++;
      caret++;
    }
    input.setSelectionRange(caret, caret);
  });

  return (
    <input
      {...inputProps}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={value == null ? "" : value.toLocaleString("ko-KR")}
      onChange={(e) => {
        const caret = e.target.selectionStart ?? e.target.value.length;
        const digits = e.target.value.replace(/[^0-9]/g, "");
        const nextValue = digits === "" ? 0 : Number(digits);
        // 0으로 바뀌면 커서를 "0" 뒤에 두어, 이어서 입력한 숫자가 0 앞에 붙지 않게 함
        digitsBeforeCaretRef.current =
          nextValue === 0 ? Infinity : e.target.value.slice(0, caret).replace(/[^0-9]/g, "").length;
        onValueChange(nextValue);
      }}
    />
  );
}
