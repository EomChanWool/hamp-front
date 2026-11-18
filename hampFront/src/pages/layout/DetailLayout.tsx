import { useId, type FormEvent, type ReactNode } from "react";
import "@/pages/layout/Layout.css";
import { DetailSelect, type SelectOption } from "@/pages/layout/DetailSelect";

export type DetailField<T extends Record<string, any> = Record<string, any>> = {
  label: string;
  key: keyof T | string;
  editable?: boolean;
  fullWidth?: boolean;
  /** 필수 입력 필드일 때 라벨 옆에 * 표시 */
  required?: boolean;
  /** 기본 입력칸의 최대 글자 수 */
  maxLength?: number;
  /**
   * 선택형 필드: options만 넘기면 div 기반 드롭다운(DetailSelect)으로 렌더링되고,
   * 읽기 모드에서는 value 대신 label이 자동 표시됨
   */
  options?: SelectOption[];
  /** options가 많을 때 드롭다운 안에 검색창 표시 */
  searchable?: boolean;
  /** 선택 안 했을 때 표시할 문구 (options 사용 시) */
  placeholder?: string;
  // 주소 검색 등 커스텀 입력 컴포넌트가 필요한 필드에만 넘기면 됨 (options보다 우선)
  // inputId: 라벨 클릭 시 포커스 연결용 (커스텀 컴포넌트의 id로 넘기면 됨)
  renderEditor?: (
    value: string,
    onChange: (val: string) => void,
    disabled: boolean,
    inputId: string
  ) => ReactNode;
  // 라벨 매핑, 뱃지 등 읽기 전용 모드에서 커스텀 표시가 필요한 필드에만 넘기면 됨 (options보다 우선)
  renderValue?: (value: string) => ReactNode;
};

export type DetailSection<T extends Record<string, any> = Record<string, any>> = {
  title: string;
  fields: DetailField<T>[];
};

type DetailLayoutProps<T extends Record<string, any> = Record<string, any>> = {
  /** 헤더 메인 타이틀 (예: 거래처명) */
  title: string;
  /** 헤더 타이틀 옆 보조 텍스트 또는 뱃지 등 커스텀 노드 */
  subtitle?: ReactNode;
  /** 헤더 우측 메타 정보 (예: 등록일자) */
  meta?: string;

  sections: DetailSection<T>[];
  form: Record<string, string>;
  isEditing: boolean;
  isBusy?: boolean;

  onChangeField: (key: string, value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;

  /** 푸터 좌측 영역 (삭제 버튼 등) */
  footerLeft?: ReactNode;
  /** 푸터 우측 영역 (취소/저장/수정/목록 버튼 등) */
  footerRight: ReactNode;

  /** 섹션 아래, 푸터 위에 들어갈 추가 영역 (예: 품목 라인 테이블) */
  children?: ReactNode;
};

export function DetailLayout<T extends Record<string, any> = Record<string, any>>({
  title,
  subtitle,
  meta,
  sections,
  form,
  isEditing,
  isBusy = false,
  onChangeField,
  onSubmit,
  footerLeft,
  footerRight,
  children,
}: DetailLayoutProps<T>) {
  // 라벨 ↔ 입력 연결용 prefix (같은 페이지에 여러 DetailLayout이 있어도 id 충돌 방지)
  const uid = useId();

  return (
    <div className="detailCard">
      <header className="detailHeader">
        <div className="detailHeaderTitleGroup">
          <h2 className="detailTitle">{title || "-"}</h2>
          {/* JSX 요소(뱃지 등)가 들어올 수 있으므로 감싸는 태그를 유연하게 처리 */}
          {subtitle && <div className="detailCode">{subtitle}</div>}
        </div>
        {meta && <span className="detailMeta">{meta}</span>}
      </header>

      <form className="detailBody" onSubmit={onSubmit}>
        {sections.map((section) => (
          <div key={section.title} className="detailSection">
            <h3 className="detailSectionTitle">{section.title}</h3>
            <div className="detailGrid">
              {section.fields.map((field) => {
                const key = String(field.key);
                const inputId = `${uid}-${key}`;
                const isFieldEditable = isEditing && field.editable !== false;
                const value = form[key] ?? "";

                // 읽기 모드 표시값: renderValue > options 라벨 > 원본 값
                const optionLabel = field.options?.find((o) => o.value === value)?.label;
                const hasCustomValue = !!field.renderValue;
                const displayText = optionLabel ?? value;
                const isEmpty = !hasCustomValue && !displayText;

                return (
                  <div
                    key={key}
                    className={
                      field.fullWidth ? "detailField detailField--full" : "detailField"
                    }
                  >
                    <label
                      htmlFor={isFieldEditable ? inputId : undefined}
                      className={field.required ? "requiredLabel" : undefined}
                    >
                      {field.label}
                      {field.required && isFieldEditable && (
                        <span className="required" aria-hidden="true">
                          {" "}
                          *
                        </span>
                      )}
                    </label>

                    {isFieldEditable ? (
                      field.renderEditor ? (
                        field.renderEditor(
                          value,
                          (val) => onChangeField(key, val),
                          isBusy,
                          inputId
                        )
                      ) : field.options ? (
                        <DetailSelect
                          id={inputId}
                          value={value}
                          onChange={(val) => onChangeField(key, val)}
                          options={field.options}
                          placeholder={field.placeholder}
                          searchable={field.searchable}
                          disabled={isBusy}
                        />
                      ) : (
                        <input
                          id={inputId}
                          className="tableInput"
                          value={value}
                          disabled={isBusy}
                          required={field.required}
                          onChange={(e) => onChangeField(key, e.target.value)}
                          maxLength={field.maxLength}
                        />
                      )
                    ) : (
                      <div
                        className={`detailValue${isEmpty ? " detailValue--empty" : ""}`}
                      >
                        {field.renderValue
                          ? field.renderValue(value)
                          : displayText || "-"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {children}
      </form>

      <footer className="detailFooter">
        <div>{footerLeft}</div>
        <div className="detailFooterActions">{footerRight}</div>
      </footer>
    </div>
  );
}