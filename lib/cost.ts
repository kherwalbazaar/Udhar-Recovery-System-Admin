// Mirrors the cost-price rules used by the mobile app (components/MainApp.tsx
// getCostPrice) so both projects compute identical profit for the same sales.
// Product-specific name rules win over the catalog cost; the catalog cost wins
// over the default MRP / 2 fallback.
export function resolveUnitCost(
  productName: string,
  mrp: number,
  catalogCost?: number | null
): number {
  const name = (productName || "").toLowerCase();
  const normalized = name.replace(/[^a-z0-9]/g, "");
  if (normalized.includes("saree100")) {
    return 75;
  }
  if (name.includes("galaxy") || name.includes("essa")) {
    return mrp * 0.6;
  }
  const catalog = Number(catalogCost);
  if (Number.isFinite(catalog) && catalog > 0) {
    return catalog;
  }
  return isNaN(mrp) ? 0 : mrp / 2;
}
