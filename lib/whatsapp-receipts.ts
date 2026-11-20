export type AutomaticWhatsAppReceipt = {
  phone: string;
  fileName: string;
  pdf: Blob;
  caption: string;
};

export type AutomaticWhatsAppReceiptSender = (
  receipt: AutomaticWhatsAppReceipt,
) => Promise<void>;

export type AutomaticWhatsAppResult = "sent" | "unavailable" | "failed";

let configuredSender: AutomaticWhatsAppReceiptSender | null = null;

/** Register a provider adapter that calls an authenticated server endpoint. */
export function registerAutomaticWhatsAppReceiptSender(
  sender: AutomaticWhatsAppReceiptSender | null,
): void {
  configuredSender = sender;
}

/** Provider credentials belong behind the registered server-side adapter. */
export async function sendReceiptAutomatically(
  receipt: AutomaticWhatsAppReceipt,
): Promise<AutomaticWhatsAppResult> {
  if (!configuredSender) return "unavailable";
  try {
    await configuredSender(receipt);
    return "sent";
  } catch {
    return "failed";
  }
}
