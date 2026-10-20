import { formatPhp } from "@/lib/format/currency";
import { getGcashConfiguration } from "@/lib/payments/configuration";

type EmailInput = { to: string; subject: string; text: string; html: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function sendEmail(input: EmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, ...input }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendOrderReceivedEmail(input: {
  to: string;
  customerName: string;
  orderNumber: string;
  total: number;
}) {
  const name = escapeHtml(input.customerName);
  const number = escapeHtml(input.orderNumber);
  const total = formatPhp(input.total);
  const gcash = getGcashConfiguration();
  const paymentText = gcash
    ? `Pay ${total} to GCash ${gcash.accountNumber} (${gcash.accountName}), then upload proof from your order page or DM the order number and proof to BAD BATCH on Instagram.`
    : "GCash account details are not configured yet. Please contact BAD BATCH on Instagram for payment instructions.";
  const paymentHtml = gcash
    ? `<p>Pay <strong>${escapeHtml(total)}</strong> to GCash <strong>${escapeHtml(gcash.accountNumber)}</strong> (${escapeHtml(gcash.accountName)}).</p><p>Then upload proof from your order page or DM the order number and proof to BAD BATCH on Instagram.</p>`
    : "<p>GCash account details are not configured yet. Please contact BAD BATCH on Instagram for payment instructions.</p>";

  return sendEmail({
    to: input.to,
    subject: `Order ${input.orderNumber} received — payment pending`,
    text: `Hi ${input.customerName},\n\nOrder ${input.orderNumber} was received. Amount due: ${total}. Payment is still pending and has not been verified. ${paymentText}\n\nPlease wait for manual payment verification.`,
    html: `<p>Hi ${name},</p><p>Order <strong>${number}</strong> was received.</p><p>Amount due: <strong>${escapeHtml(total)}</strong>.</p><p>Payment is still pending and has not been verified.</p>${paymentHtml}<p>Please wait for manual payment verification.</p>`,
  });
}

export async function sendPaymentConfirmedEmail(input: {
  to: string;
  customerName: string;
  orderNumber: string;
  total: number;
}) {
  const name = escapeHtml(input.customerName);
  const number = escapeHtml(input.orderNumber);
  const total = escapeHtml(formatPhp(input.total));
  return sendEmail({
    to: input.to,
    subject: `Payment confirmed for order ${input.orderNumber}`,
    text: `Hi ${input.customerName}, payment for order ${input.orderNumber} (${total}) has been manually verified by BAD BATCH. We will contact you with next steps.`,
    html: `<p>Hi ${name}, payment for order <strong>${number}</strong> (${total}) has been manually verified by BAD BATCH.</p><p>We will contact you with next steps.</p>`,
  });
}
