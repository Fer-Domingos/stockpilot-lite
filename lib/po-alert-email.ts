export type PurchaseOrderAlertEmailPayload = {
  ownerEmail: string;
  poNumber: string;
  invoiceNumber: string;
  relatedJobLabel?: string | null;
  materialLabel?: string | null;
  quantity?: number | null;
};

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM_EMAIL = "StockPilot Alerts <onboarding@resend.dev>";

export async function sendPurchaseOrderAlertEmail(
  payload: PurchaseOrderAlertEmailPayload,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      "Skipping PO alert email because RESEND_API_KEY is not configured.",
      {
        ownerEmail: payload.ownerEmail,
        poNumber: payload.poNumber,
        invoiceNumber: payload.invoiceNumber,
      },
    );
    return false;
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;
  const displayNumber = payload.invoiceNumber || payload.poNumber;
  const subject = `PO Alert Triggered - Invoice ${displayNumber}`;

  const lines = [
    "A tracked PO alert was triggered in StockPilot Lite.",
    "",
    `PO / Invoice: ${displayNumber}`,
    `Tracked PO: ${payload.poNumber}`,
    payload.relatedJobLabel ? `Related job: ${payload.relatedJobLabel}` : null,
    payload.materialLabel ? `Material: ${payload.materialLabel}` : null,
    typeof payload.quantity === "number" ? `Quantity: ${payload.quantity}` : null,
    "",
    "Message: The tracked PO has been received and matched.",
    "",
    "— StockPilot",
  ].filter((line): line is string => Boolean(line));

  const html = lines.map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<br />")).join("");

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [payload.ownerEmail],
      subject,
      text: lines.join("\n"),
      html,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API request failed (${response.status}): ${errorBody}`);
  }

  return true;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
