"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stediWebhookController_1 = require("../controllers/stediWebhookController");
const router = (0, express_1.Router)();
// No JWT auth — Stedi calls this endpoint directly with a shared secret
// The controller validates STEDI_WEBHOOK_SECRET if set
router.post('/', stediWebhookController_1.handleStediWebhook);
exports.default = router;
