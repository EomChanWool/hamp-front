import { useEffect, useState } from "react";
import type { EquipmentCreateRequest } from "@/types/equipment/equipment";

interface EquipmentCreateModalProps {
    isOpen: boolean;
    isLoading: boolean;
    onClose: () => void;
    onSubmit: (data: EquipmentCreateRequest) => void;
}

export function EquipmentCreateModal({
    isOpen,
    isLoading,
    onClose,
    onSubmit,
}: EquipmentCreateModalProps) {
    const [form, setForm] = useState<EquipmentCreateRequest>({
        eqCode: "",
        operCode: "",
        eqNm: "",
        eqType: "",
        manufacturer: "",
    });

    useEffect(() => {
        if (!isOpen) {
            setForm({
                eqCode: "",
                operCode: "",
                eqNm: "",
                eqType: "",
                manufacturer: "",
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (key: keyof EquipmentCreateRequest, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        if (!form.eqCode.trim()) {
            window.alert("장비 코드를 입력해주세요.");
            return;
        }

        const payload: EquipmentCreateRequest = {
            eqCode: form.eqCode.trim(),
            operCode: form.operCode?.trim() ? form.operCode.trim() : null,
            eqNm: form.eqNm?.trim() ? form.eqNm.trim() : null,
            eqType: form.eqType?.trim() ? form.eqType.trim() : null,
            manufacturer: form.manufacturer?.trim() ? form.manufacturer.trim() : null,
        };
        onSubmit(payload);
    };

    return (
        <>
            {/* 딤 배경 */}
            <div
                onClick={isLoading ? undefined : onClose}
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
                        <h3>신규 장비 등록</h3>
                        <span>장비 정보 등록</span>
                    </div>
                    <button
                        type="button"
                        className="detailModalClose"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        ✕
                    </button>
                </div>

                <div className="detailModalBody">
                    {/* 장비 코드 (필수) */}
                    <div className="detailField">
                        <label className="requiredLabel">
                            장비코드 <span className="required">*</span>
                        </label>
                        <input
                            className="tableInput"
                            value={form.eqCode}
                            disabled={isLoading}
                            onChange={(e) => handleChange("eqCode", e.target.value)}
                            placeholder="예: EQ001"
                        />
                    </div>

                    {/* 공정코드 */}
                    <div className="detailField">
                        <label>공정코드</label>
                        <input
                            className="tableInput"
                            value={form.operCode ?? ""}
                            disabled={isLoading}
                            onChange={(e) => handleChange("operCode", e.target.value)}
                            placeholder="예: OPER001"
                        />
                    </div>

                    {/* 장비명 */}
                    <div className="detailField">
                        <label>장비명</label>
                        <input
                            className="tableInput"
                            value={form.eqNm ?? ""}
                            disabled={isLoading}
                            onChange={(e) => handleChange("eqNm", e.target.value)}
                            placeholder="예: 혼합기 1호"
                        />
                    </div>

                    {/* 장비 유형 */}
                    <div className="detailField">
                        <label>장비유형</label>
                        <input
                            className="tableInput"
                            value={form.eqType ?? ""}
                            disabled={isLoading}
                            onChange={(e) => handleChange("eqType", e.target.value)}
                            placeholder="예: MIXER"
                        />
                    </div>

                    {/* 제조사 */}
                    <div className="detailField">
                        <label>제조사</label>
                        <input
                            className="tableInput"
                            value={form.manufacturer ?? ""}
                            disabled={isLoading}
                            onChange={(e) => handleChange("manufacturer", e.target.value)}
                            placeholder="예: HEMP Tech"
                        />
                    </div>
                </div>

                <div className="detailModalFooter">
                    <div className="detailModalFooterRight">
                        <button
                            type="button"
                            className="ghostButton"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            className="primaryButton"
                            onClick={handleSubmit}
                            disabled={isLoading}
                        >
                            {isLoading ? "등록 중..." : "등록"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}