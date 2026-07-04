export type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";

export const ORDER_STAGES: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "delivered", label: "Delivered" },
];

export const ALL_STATUSES: { value: OrderStatus; label: string }[] = [
  ...ORDER_STAGES,
  { value: "cancelled", label: "Cancelled" },
];

export function stageIndex(status: string): number {
  return ORDER_STAGES.findIndex((s) => s.value === status);
}

export function statusLabel(status: string): string {
  return ALL_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function isValidStatus(status: string): status is OrderStatus {
  return ALL_STATUSES.some((s) => s.value === status);
}
