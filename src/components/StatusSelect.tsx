"use client";

import { ALL_STATUSES, type OrderStatus } from "@/lib/order-status";
import Dropdown from "@/components/Dropdown";

export default function StatusSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: OrderStatus;
  onChange: (status: OrderStatus) => void;
  disabled?: boolean;
}) {
  return (
    <Dropdown
      value={value}
      options={ALL_STATUSES}
      onChange={(v) => onChange(v as OrderStatus)}
      disabled={disabled}
      align="right"
      buttonClassName="text-xs font-bold"
    />
  );
}
