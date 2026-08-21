import { randomInt } from 'crypto';

/**
 * Collision-resistant 10-digit numeric document number generator.
 * Strategy: 7 digits from epoch ms (changes every ms) + 3 crypto-random digits.
 * Collision is checked against the specified model via existsCheck callback.
 */

const generateDigits = (): string => {
  const now = Date.now();
  const msPart = (now % 10000000).toString().padStart(7, '0');
  const randomPart = randomInt(0, 1000).toString().padStart(3, '0');
  return `${msPart}${randomPart}`;
};

export async function generateUniqueDocumentNumber(
  shopId: string,
  existsCheck: (number: string) => Promise<boolean>,
  maxRetries: number = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateDigits();
    const exists = await existsCheck(candidate);
    if (!exists) return candidate;
    await new Promise(resolve => setTimeout(resolve, 5 * (attempt + 1)));
  }
  return Date.now().toString().slice(-10);
}