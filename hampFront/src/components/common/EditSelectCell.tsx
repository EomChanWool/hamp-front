import { useState } from "react";
import { SelectBox, type SelectBoxOption } from "./SelectBox";

type EditSelectCellProps = {
  initialValue: string;
  options: SelectBoxOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  searchable?: boolean;
};

export function EditSelectCell({
  initialValue,
  options,
  onChange,
  ariaLabel,
  placeholder,
  searchable = false,
}: EditSelectCellProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <SelectBox
      className="selectBox--cell"
      ariaLabel={ariaLabel}
      value={value}
      options={options}
      placeholder={placeholder}
      searchable={searchable}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}