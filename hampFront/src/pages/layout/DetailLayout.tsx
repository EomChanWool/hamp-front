import type { FormEvent, ReactNode } from "react";
import "@/pages/layout/Layout.css";

export type DetailField<T extends Record<string, any> = Record<string, any>> = {
  label: string;
  key: keyof T | string;
  editable?: boolean;
  fullWidth?: boolean;
  /** 필수 입력 필드일 때 라벨 옆에 * 표시 */
  required?: boolean;
  // 주소 검색 등 커스텀 입력 컴포넌트가 필요한 필드에만 넘기면 됨
  renderEditor?: (
    value: string,
    onChange: (val: string) => void,
    disabled: boolean
  ) => ReactNode;
  // 라벨 매핑, 뱃지 등 읽기 전용 모드에서 커스텀 표시가 필요한 필드에만 넘기면 됨
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
  subtitle?: ReactNode; // 수정됨: string -> ReactNode
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
                const isFieldEditable = isEditing && field.editable !== false;
                const value = form[key] ?? "";

                return (
                  <div
                    key={key}
                    className={
                      field.fullWidth ? "detailField detailField--full" : "detailField"
                    }
                  >
                    <label className={field.required ? "requiredLabel" : undefined}>
                      {field.label}
                      {field.required && isFieldEditable && <span className="required"> *</span>}
                    </label>
                    {isFieldEditable ? (
                      field.renderEditor ? (
                        field.renderEditor(
                          value,
                          (val) => onChangeField(key, val),
                          isBusy
                        )
                      ) : (
                        <input
                          className="tableInput"
                          value={value}
                          disabled={isBusy}
                          onChange={(e) => onChangeField(key, e.target.value)}
                        />
                      )
                    ) : (
                      <div className="detailValue">
                        {field.renderValue ? field.renderValue(value) : value || "-"}
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