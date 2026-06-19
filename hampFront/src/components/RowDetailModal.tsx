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

      {/* 모달 */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 90vw)",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          zIndex: 201,
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <strong style={{ fontSize: 16 }}>{isEditing ? "항목 수정" : "상세 보기"}</strong>
          <button
            onClick={handleClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#64748b",
              fontSize: 16,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* 바디 */}
        <div
          style={{
            display: "grid",
            gap: 14,
            padding: "24px",
          }}
        >
          {fields.map(({ label, key }) => (
            <div key={key} style={{ display: "grid", gap: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                {label}
              </span>
              {isEditing ? (
                <input
                  className="tableInput"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{ height: 36, fontSize: 13 }}
                />
              ) : (
                <span style={{ fontSize: 14, color: "#1e293b" }}>{data[key] || "—"}</span>
              )}
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          {isEditing ? (
            <>
              <button className="miniButton" onClick={() => setIsEditing(false)}>
                취소
              </button>
              <button className="miniButton primary" onClick={handleSave}>
                저장
              </button>
            </>
          ) : (
            <>
              <button className="miniButton" onClick={handleClose}>
                닫기
              </button>
              <button className="miniButton primary" onClick={() => setIsEditing(true)}>
                수정
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
