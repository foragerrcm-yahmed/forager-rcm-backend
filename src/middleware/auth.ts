import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
    // Always return 401 (not 403) for any token verification failure so the
    // frontend's apiRequest handler clears the stored token and redirects to
    // /login automatically. 403 is reserved for authorisation failures (wrong
    // role), not authentication failures (bad/expired token).
    const message =
      error?.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid or expired token';
    res.status(401).json({ error: message });
  }
};

// Middleware to check if user has specific role
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
