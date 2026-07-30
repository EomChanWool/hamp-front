import { useEffect, useState } from "react";
type Field = {
  label: string;
  key: string;
  editable?: boolean;
};

type DetailModalAction = {
  label: string;
  loadingLabel?: string;
  onClick: () => void | Promise<void>;
  isLoading?: boolean;
};

type RowDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, string>) => void;
  fields: Field[];
  data: Record<string, string>;
  dangerAction?: DetailModalAction;
};

/** 테이블 행 클릭 시 상세 정보를 보여주고, 수정 모드로 전환해 저장/취소할 수 있는 모달 */
export function RowDetailModal({
  isOpen,
  onClose,
  onSave,
  fields,
  data,
  dangerAction,
}: RowDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(data);
  const isBusy = dangerAction?.isLoading === true;

  // ...컴포넌트 안에서
  useEffect(() => {
    setForm(data);
    setIsEditing(false);
  }, [data]);

  const handleSave = () => {
    onSave(form);
    setIsEditing(false);
  };

  const handleClose = () => {
    if (isBusy) return;

    setForm(data); // 변경사항 롤백
    setIsEditing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 오버레이 */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)",
          zIndex: 200,
        }}
      />

      <div className="detailModal">
        <div className="detailModalHeader">
          <div>
            <h3>{isEditing ? "정보 수정" : "상세 정보"}</h3>
            <span>사용자 정보 조회</span>
          </div>

          <button
            type="button"
            className="detailModalClose"
            onClick={handleClose}
            disabled={isBusy}
          >
            ✕
          </button>
        </div>

        <div className="detailModalBody">
          {fields.map(({ label, key, editable }) => (
            <div key={key} className="detailField">
              <label>{label}</label>

              {isEditing && editable !== false ? (
                <input
                  className="tableInput"
                  value={form[key] ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                />
              ) : (
                <div className="detailValue">{data[key] || "-"}</div>
              )}
            </div>
          ))}
        </div>

        <div className="detailModalFooter">
          {isEditing ? (
            <>
              {dangerAction && (
                <button
                  type="button"
                  className="dangerButton detailModalDangerAction"
                  onClick={() => void dangerAction.onClick()}
                  disabled={isBusy}
                >
                  {isBusy
                    ? (dangerAction.loadingLabel ?? dangerAction.label)
                    : dangerAction.label}
                </button>
              )}

              <button
                type="button"
                className="ghostButton"
                onClick={() => setIsEditing(false)}
                disabled={isBusy}
              >
                취소
              </button>

              <button
                type="button"
                className="primaryButton"
                onClick={handleSave}
                disabled={isBusy}
              >
                저장
              </button>
            </>
          ) : (
            <>
              <button type="button" className="ghostButton" onClick={handleClose}>
                닫기
              </button>

              <button
                type="button"
                className="primaryButton"
                onClick={() => setIsEditing(true)}
              >
                수정
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
