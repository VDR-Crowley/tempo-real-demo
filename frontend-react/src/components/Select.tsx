import { useEffect, useRef, useState } from "react";

export interface SelectOption<T extends string | number> {
  label: string;
  value: T;
}

interface SelectProps<T extends string | number> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}

export default function Select<T extends string | number>({ value, options, onChange }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="select" ref={rootRef}>
      <button type="button" className="select__trigger" onClick={() => setOpen((o) => !o)}>
        {current?.label ?? ""}
      </button>
      {open ? (
        <ul className="select__menu">
          {options.map((option) => (
            <li
              key={option.value}
              className={`select__option${option.value === value ? " select__option--selected" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
