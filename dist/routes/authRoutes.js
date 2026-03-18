"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// One-time setup route (disabled after first user is created)
router.post('/setup', authController_1.setup);
// Public routes
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
// Protected routes
router.get('/profile', auth_1.authenticateToken, authController_1.getProfile);
exports.default = router;
