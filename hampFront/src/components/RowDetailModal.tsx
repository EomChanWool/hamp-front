import { useEffect, useState } from "react";
type Field = {
  label: string;
  key: string;
};

type RowDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, string>) => void;
  fields: Field[];
  data: Record<string, string>;
};

export function RowDetailModal({ isOpen, onClose, onSave, fields, data }: RowDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(data);

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

          <button className="detailModalClose" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="detailModalBody">
          {fields.map(({ label, key }) => (
            <div key={key} className="detailField">
              <label>{label}</label>

              {isEditing ? (
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
              <button className="ghostButton" onClick={() => setIsEditing(false)}>
                취소
              </button>

              <button className="primaryButton" onClick={handleSave}>
                저장
              </button>
            </>
          ) : (
            <>
              <button className="ghostButton" onClick={handleClose}>
                닫기
              </button>

              <button className="primaryButton" onClick={() => setIsEditing(true)}>
                수정
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
