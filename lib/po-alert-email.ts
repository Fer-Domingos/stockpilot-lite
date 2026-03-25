export type PurchaseOrderAlertEmailPayload = {
  ownerEmail: string;
  poNumber: string;
  invoiceNumber: string | null;
  relatedJob: string;
  materialName: string;
  quantity: number | null;
  message: string;
};

export async function sendPurchaseOrderAlertEmail(
  payload: PurchaseOrderAlertEmailPayload,
): Promise<boolean> {
  try {
    const trimmedRecipient = payload.ownerEmail.trim();
    if (!trimmedRecipient) {
      return false;
    }

    const webhookUrl = process.env.PO_ALERT_EMAIL_WEBHOOK_URL?.trim();
    if (!webhookUrl) {
      console.info("PO alert email (manual):", {
        ...payload,
        ownerEmail: trimmedRecipient,
      });
      return true;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: trimmedRecipient,
        subject: `PO Alert: ${payload.poNumber}`,
        ...payload,
      }),
      cache: "no-store",
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to send purchase order alert email:", error);
    return false;
  }
}
