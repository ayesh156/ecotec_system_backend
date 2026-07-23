import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';
import { jwtConfig } from '../config/security';
import { AuthRequest, AuthUser } from '../types/express';

// Use secure config instead of hardcoded fallback
const getJwtSecret = () => jwtConfig.secret;

// Re-export AuthRequest for backward compatibility
export type { AuthRequest };

/**
 * Protect middleware - Validates JWT access token from Authorization header
 * Returns 401 with specific error codes for token issues:
 * - TOKEN_MISSING: No token provided
 * - TOKEN_EXPIRED: Token has expired (client should refresh)
 * - TOKEN_INVALID: Token is malformed or invalid
 * - USER_INACTIVE: User account is deactivated
 */
export const protect = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Get token from Authorization header (Bearer token)
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      const error = new AppError('No access token provided', 401);
      (error as AppError & { code: string }).code = 'TOKEN_MISSING';
      throw error;
    }

    // Verify token
    let decoded: { id: string; email: string; role: string; shopId: string | null };
    try {
      decoded = jwt.verify(token, getJwtSecret()) as typeof decoded;
    } catch (jwtError) {
      if (jwtError instanceof TokenExpiredError) {
        const error = new AppError('Access token has expired', 401);
        (error as AppError & { code: string }).code = 'TOKEN_EXPIRED';
        throw error;
      }
      if (jwtError instanceof JsonWebTokenError) {
        const error = new AppError('Invalid access token', 401);
        (error as AppError & { code: string }).code = 'TOKEN_INVALID';
        throw error;
      }
      throw jwtError;
    }

    // Get user from database with shopId
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, shopId: true },
    });

    if (!user) {
      const error = new AppError('User not found', 401);
      (error as AppError & { code: string }).code = 'USER_NOT_FOUND';
      throw error;
    }

    if (!user.isActive) {
      const error = new AppError('User account is deactivated', 401);
      (error as AppError & { code: string }).code = 'USER_INACTIVE';
      throw error;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional auth middleware - Attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(); // Continue without user
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { id: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, name: true, role: true, isActive: true, shopId: true },
      });

      if (user && user.isActive) {
        req.user = user;
      }
    } catch {
      // Token invalid, continue without user
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('Not authorized to perform this action', 403)
      );
    }
    next();
  };
};