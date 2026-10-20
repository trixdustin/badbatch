export const maxPaymentProofBytes = 4 * 1024 * 1024;

export type PaymentImageType = "image/jpeg" | "image/png" | "image/webp";

export function detectPaymentImageType(bytes: Uint8Array): PaymentImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validatePaymentImage(bytes: Uint8Array, size: number, declaredType: string): PaymentImageType | null {
  if (!Number.isSafeInteger(size) || size < 1 || size > maxPaymentProofBytes || size !== bytes.byteLength) return null;
  const detectedType = detectPaymentImageType(bytes);
  return detectedType && detectedType === declaredType ? detectedType : null;
}

