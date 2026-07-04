// Text-based check since the checkout form takes a free-text address rather
// than a map picker: the customer's address must mention Bahria Town somewhere.
// Not foolproof (someone could type it and still live elsewhere), but it stops
// the common case of someone ordering delivery from outside the service area,
// and staff can still catch anything that slips through when they call to confirm.
export const DELIVERY_AREA_LABEL = "Bahria Town Lahore";

export function isAddressInDeliveryArea(address: string): boolean {
  return /bahria/i.test(address);
}
