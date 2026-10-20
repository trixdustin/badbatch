export function getGcashConfiguration() {
  const accountName = process.env.GCASH_ACCOUNT_NAME?.trim() ?? "";
  const accountNumber = process.env.GCASH_ACCOUNT_NUMBER?.trim() ?? "";
  return accountName && accountNumber ? { accountName, accountNumber } : null;
}
