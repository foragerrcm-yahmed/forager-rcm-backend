"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const attachmentController_1 = require("../controllers/attachmentController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(auth_1.authenticateToken);
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), attachmentController_1.getAttachments);
router.post('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), upload.single('file'), attachmentController_1.uploadAttachment);
router.get('/:id/download', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), attachmentController_1.downloadAttachment);
router.delete('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), attachmentController_1.deleteAttachment);
exports.default = router;
