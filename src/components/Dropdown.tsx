"use client";

import { useEffect, useRef, useState } from "react";

export type DropdownOption = { value: string; label: string; color?: string };

export default function Dropdown({
  value,
  options,
  onChange,
  disabled = false,
  align = "left",
  buttonClassName = "",
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  align?: "left" | "right";
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={ref} className="print:hidden relative inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-text transition-opacity disabled:opacity-50 ${buttonClassName}`}
      >
        {current?.label ?? value}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-muted">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1 w-44 overflow-hidden rounded-lg border border-white/10 bg-[#17120d] shadow-[0_12px_30px_-8px_rgba(0,0,0,0.6)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="block w-full px-3 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-mustard/15"
              style={{
                color: o.value === value ? "var(--color-mustard)" : "var(--color-text)",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
