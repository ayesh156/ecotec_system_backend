/**
 * Singleton utility for Single-Shop mode.
 * Returns the DEFAULT_SHOP_ID from environment variables.
 * This replaces the multi-tenant getEffectiveShopId pattern.
 */
export const getShopId = (): string => {
  const shopId = process.env.DEFAULT_SHOP_ID;
  if (!shopId) {
    throw new Error('DEFAULT_SHOP_ID environment variable is not set. Please set it in your .env file.');
  }
  return shopId;
};