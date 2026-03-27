"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAttachment = exports.downloadAttachment = exports.uploadAttachment = exports.getAttachments = void 0;
const prisma_1 = require("../../generated/prisma");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new prisma_1.PrismaClient();
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'xls', 'xlsx'];
// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const getAttachments = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { claimId, patientId, fileType } = req.query;
        const where = {};
        if (claimId && typeof claimId === 'string') {
            where.claimId = claimId;
        }
        if (patientId && typeof patientId === 'string') {
            where.patientId = patientId;
        }
        if (fileType && typeof fileType === 'string') {
            where.fileType = fileType;
        }
        const [attachments, total] = await prisma.$transaction([
            prisma.attachment.findMany({
                where,
                skip,
                take: limit,
                include: {
                    uploadedBy: { select: { id: true, firstName: true, lastName: true } },
                }
            }),
            prisma.attachment.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: attachments.map((a) => ({
                ...a,
                createdAt: Number(a.createdAt),
            })),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'ATTACHMENT');
    }
};
exports.getAttachments = getAttachments;
const uploadAttachment = async (req, res) => {
    try {
        const { claimId, patientId } = req.body;
        if (!req.file) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('ATTACHMENT'), 'No file provided');
            return;
        }
        if (!claimId && !patientId) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('ATTACHMENT'), 'Either claimId or patientId must be provided');
            return;
        }
        const fileSize = req.file.size;
        if (fileSize > MAX_FILE_SIZE) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('ATTACHMENT'), `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
            return;
        }
        const fileExtension = path.extname(req.file.originalname).toLowerCase().slice(1);
        if (!ALLOWED_TYPES.includes(fileExtension)) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('ATTACHMENT'), `File type .${fileExtension} is not allowed`);
            return;
        }
        // Validate that claim or patient exists
        if (claimId) {
            const claim = await prisma.claim.findUnique({ where: { id: claimId } });
            if (!claim) {
                (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('CLAIM'), 'Claim not found');
                return;
            }
        }
        if (patientId) {
            const patient = await prisma.patient.findUnique({ where: { id: patientId } });
            if (!patient) {
                (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('PATIENT'), 'Patient not found');
                return;
            }
        }
        const now = Math.floor(Date.now() / 1000);
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const filePath = path.join(UPLOAD_DIR, fileId, req.file.originalname);
        const fileDir = path.dirname(filePath);
        // Create directory if it doesn't exist
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }
        // Save file to disk
        fs.writeFileSync(filePath, req.file.buffer);
        const attachment = await prisma.attachment.create({
            data: {
                claim: claimId ? { connect: { id: claimId } } : undefined,
                patient: patientId ? { connect: { id: patientId } } : undefined,
                fileName: req.file.originalname,
                fileType: fileExtension,
                fileSize: fileSize,
                filePath: `/attachments/${fileId}/${req.file.originalname}`,
                uploadedBy: { connect: { id: req.user.userId } },
                createdAt: BigInt(now),
            },
            include: {
                uploadedBy: { select: { id: true, firstName: true, lastName: true } },
            }
        });
        res.status(201).json({
            success: true,
            data: {
                ...attachment,
                createdAt: Number(attachment.createdAt),
            },
        });
    }
    catch (error) {
        console.error('Upload attachment error:', error);
        (0, errors_1.sendError)(res, 500, 'ATTACHMENT_UPLOAD_FAILED', 'Failed to upload attachment');
    }
};
exports.uploadAttachment = uploadAttachment;
const downloadAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        const attachment = await prisma.attachment.findUnique({ where: { id: id } });
        if (!attachment) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('ATTACHMENT'), 'Attachment not found');
            return;
        }
        const filePath = path.join(UPLOAD_DIR, attachment.filePath.replace('/attachments/', ''));
        if (!fs.existsSync(filePath)) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('ATTACHMENT'), 'File not found on disk');
            return;
        }
        res.download(filePath, attachment.fileName);
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'ATTACHMENT');
    }
};
exports.downloadAttachment = downloadAttachment;
const deleteAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        const attachment = await prisma.attachment.findUnique({ where: { id: id } });
        if (!attachment) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('ATTACHMENT'), 'Attachment not found');
            return;
        }
        // Delete file from disk
        const filePath = path.join(UPLOAD_DIR, attachment.filePath.replace('/attachments/', ''));
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        // Delete from database
        await prisma.attachment.delete({ where: { id: id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'ATTACHMENT');
    }
};
exports.deleteAttachment = deleteAttachment;
