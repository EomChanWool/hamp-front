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
  onSave: (data: Record<string, string>) => void | Promise<void>;
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

  // 1. data 객체의 내용이 실제로 바뀔 때만 form 동기화
  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [JSON.stringify(data)]);

  // 2. 모달이 닫히거나 수정 모드가 종료될 때 form 상태를 원본 데이터로 리셋
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setForm(data); // 모달 닫힐 때 Form 롤백
    } else if (!isEditing) {
      setForm(data); // 수정 모드 빠져나올 때 Form 롤백
    }
  }, [isOpen, isEditing, data]);

  // 3. 비동기 저장이 완료된 후 또는 부모 흐름에 맞춰 setIsEditing 처리
  const handleSave = async () => {
    await onSave(form);
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

        {/* 푸터 영역 */}
        <div className="detailModalFooter">
          {/* 좌측: 수정 모드일 때만 나오는 위험 동작 (회원 비활성화) */}
          <div className="detailModalFooterLeft">
            {isEditing && dangerAction && (
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
          </div>

          {/* 우측: 일반 액션 (수정 모드: 취소/저장, 조회 모드: 닫기/수정) */}
          <div className="detailModalFooterRight">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="ghostButton"
                  onClick={() => {
                    setForm(data);
                    setIsEditing(false);
                  }}
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
                <button
                  type="button"
                  className="ghostButton"
                  onClick={handleClose}
                >
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
      </div>
    </>
  );
}