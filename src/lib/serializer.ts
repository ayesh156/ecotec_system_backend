import { Prisma } from '@prisma/client';

/**
 * Shared response serializer for Prisma.Decimal instances.
 * Recursively walks any object/array and converts Prisma.Decimal values
 * into plain JS numbers so the frontend never sees Decimal objects.
 */
export function serializeDecimals<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (value instanceof Prisma.Decimal) {
    return Number(value.toString()) as unknown as T;
  }

  if (value instanceof Date) {
    return value as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => serializeDecimals(item)) as unknown as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeDecimals(val);
    }
    return result as T;
  }

  return value;
}

/**
 * Helper to serialize a Prisma result (or array of results) into a
 * plain JSON-compatible object with all Decimal fields as numbers.
 */
export function toJSON<T>(data: T): T {
  return serializeDecimals(data);
}