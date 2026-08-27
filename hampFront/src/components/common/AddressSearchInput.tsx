import { useState, useEffect } from "react";

declare global {
  interface Window {
    daum: any;
  }
}

interface AddressSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AddressSearchInput({
  value,
  onChange,
  disabled = false,
  placeholder = "주소 검색 버튼을 클릭하세요",
}: AddressSearchInputProps) {
  const [baseAddress, setBaseAddress] = useState("");
  const [detailAddress, setDetailAddress] = useState("");

  // 부모의 전체 주소(value)를 받아와서 기본주소와 상세주소로 분리
  useEffect(() => {
    if (!value) {
      setBaseAddress("");
      setDetailAddress("");
      return;
    }

    const currentCombined = detailAddress ? `${baseAddress} ${detailAddress}` : baseAddress;
    if (value === currentCombined) return;

    // [수정된 파싱 로직]
    // 1. 가장 마지막에 있는 닫는 괄호 ')' 위치를 찾습니다.
    const lastParenIndex = value.lastIndexOf(")");

    if (lastParenIndex !== -1) {
      // 괄호가 있다면 괄호까지를 기본주소로
      setBaseAddress(value.substring(0, lastParenIndex + 1).trim());
      setDetailAddress(value.substring(lastParenIndex + 1).trim());
    } else {
      // 괄호가 없다면, 전체를 기본주소로 보고 상세주소는 비움
      // (이미 이전 데이터가 상세주소를 가지고 있었다면 보존됨)
      setBaseAddress(value);
      setDetailAddress("");
    }
  }, [value]);

  // 최종 주소를 부모에게 전달하는 함수
  const updateParentValue = (base: string, detail: string) => {
    const trimmedBase = base.trim();
    const trimmedDetail = detail.trim();

    if (!trimmedBase) {
      onChange("");
      return;
    }

    const finalAddress = trimmedDetail ? `${trimmedBase} ${trimmedDetail}` : trimmedBase;
    onChange(finalAddress);
  };

  const handleOpenPostcode = () => {
    if (!window.daum || !window.daum.Postcode) {
      alert("주소 검색 스크립트를 불러오지 못했습니다.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data: any) => {
        let fullAddress = data.roadAddress || data.jibunAddress;
        let extraAddress = "";

        if (data.addressType === "R") {
          if (data.bname !== "") {
            extraAddress += data.bname;
          }
          if (data.buildingName !== "") {
            extraAddress += extraAddress !== "" ? `, ${data.buildingName}` : data.buildingName;
          }
          fullAddress += extraAddress !== "" ? ` (${extraAddress})` : "";
        }

        setBaseAddress(fullAddress);
        // 새 주소를 검색하면 상세주소는 초기화하거나 유지할 수 있음 (여기서는 기존 상세주소 유지하며 합침)
        updateParentValue(fullAddress, detailAddress);
      },
    }).open();
  };

  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDetail = e.target.value;
    setDetailAddress(newDetail);
    updateParentValue(baseAddress, newDetail);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
        <input
          className="tableInput"
          value={baseAddress}
          disabled={disabled}
          readOnly
          placeholder={placeholder}
        />
        <button
          type="button"
          className="ghostButton"
          onClick={handleOpenPostcode}
          disabled={disabled}
          style={{ whiteSpace: "nowrap" }}
        >
          주소 검색
        </button>
      </div>

      <input
        className="tableInput"
        value={detailAddress}
        disabled={disabled || !baseAddress}
        onChange={handleDetailChange}
        placeholder="상세주소를 입력하세요 (예: 101동 102호)"
        maxLength={100}
      />
    </div>
  );
}