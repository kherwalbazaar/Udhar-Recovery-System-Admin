import { createCustomer, fetchCustomers, type CustomerSummary } from "./store";

/**
 * Customers typed on the Sales page are kept on this device first so the bill
 * can be built instantly and offline. They are written to Firebase only when the
 * bill is completed (see `pushLocalCustomer`).
 */

const STORAGE_KEY = "udhar_local_customers_v1";

export type LocalCustomerDraft = {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt: number;
};

const LOCAL_ID_PREFIX = "local_";

export function isLocalCustomer(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith(LOCAL_ID_PREFIX));
}

export function readLocalCustomerDrafts(): LocalCustomerDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is LocalCustomerDraft =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as LocalCustomerDraft).id === "string" &&
        (entry as LocalCustomerDraft).id.startsWith(LOCAL_ID_PREFIX) &&
        typeof (entry as LocalCustomerDraft).name === "string" &&
        typeof (entry as LocalCustomerDraft).phone === "string"
    );
  } catch {
    return [];
  }
}

function writeLocalCustomerDrafts(drafts: LocalCustomerDraft[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Storage full or blocked - the customer still works for this bill.
  }
}

export function draftToCustomer(draft: LocalCustomerDraft): CustomerSummary {
  return {
    id: draft.id,
    name: draft.name,
    phone: draft.phone,
    address: draft.address,
    totalAmount: 0,
  };
}

export function saveLocalCustomerDraft(input: {
  name: string;
  phone: string;
  address: string;
}): LocalCustomerDraft {
  const phoneDigits = input.phone.replace(/\D/g, "");
  const draft: LocalCustomerDraft = {
    id: `${LOCAL_ID_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    createdAt: Date.now(),
  };
  const others = readLocalCustomerDrafts().filter(
    (entry) => !phoneDigits || entry.phone.replace(/\D/g, "") !== phoneDigits
  );
  writeLocalCustomerDrafts([draft, ...others]);
  return draft;
}

export function removeLocalCustomerDraft(id: string): void {
  writeLocalCustomerDrafts(readLocalCustomerDrafts().filter((draft) => draft.id !== id));
}

/**
 * Persist a device-only customer to Firebase when the bill is completed.
 * An existing Firebase customer with the same mobile number is reused so the
 * khata stays under one ledger.
 */
export async function pushLocalCustomer(customer: CustomerSummary): Promise<CustomerSummary> {
  if (!isLocalCustomer(customer.id)) return customer;

  const draft = readLocalCustomerDrafts().find((entry) => entry.id === customer.id);
  const name = draft?.name ?? customer.name;
  const phone = draft?.phone ?? customer.phone;
  const address = draft?.address ?? customer.address ?? "";
  const phoneDigits = phone.replace(/\D/g, "");

  let remote: CustomerSummary[] = [];
  try {
    remote = await fetchCustomers();
  } catch {
    remote = [];
  }
  const existing = phoneDigits
    ? remote.find((entry) => entry.phone.replace(/\D/g, "") === phoneDigits)
    : undefined;
  if (existing) {
    removeLocalCustomerDraft(customer.id);
    return existing;
  }

  const created = await createCustomer({ name, phone, address });
  removeLocalCustomerDraft(customer.id);
  return created;
}
