"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticateToken = void 0;
const jwt_1 = require("../utils/jwt");
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }
        const payload = (0, jwt_1.verifyToken)(token);
        req.user = payload;
        next();
    }
    catch (error) {
        // Always return 401 (not 403) for any token verification failure so the
        // frontend's apiRequest handler clears the stored token and redirects to
        // /login automatically. 403 is reserved for authorisation failures (wrong
        // role), not authentication failures (bad/expired token).
        const message = error?.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid or expired token';
        res.status(401).json({ error: message });
    }
};
exports.authenticateToken = authenticateToken;
// Middleware to check if user has specific role
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
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
exports.requireRole = requireRole;
