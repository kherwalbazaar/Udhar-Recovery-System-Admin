import { buildKhata, type RawMap } from "./khata";

export type {
  KhataData,
  KhataMetrics,
  KhataCustomer,
  KhataTransaction,
  RawMap,
} from "./khata";

export function buildSuppliers(rawSuppliers: RawMap) {
  return buildKhata(rawSuppliers);
}