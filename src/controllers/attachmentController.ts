import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, forbidden } from '../utils/errors';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'xls', 'xlsx'];

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const getAttachments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { claimId, patientId, fileType } = req.query;

    const where: any = {};

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
      data: attachments.map(a => ({
        ...a,
        uploadedAt: Number(a.uploadedAt),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get attachments error:', error);
    sendError(res, 500, 'ATTACHMENT_INTERNAL_ERROR', 'Internal server error');
  }
};

export const uploadAttachment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimId, patientId } = req.body;

    if (!req.file) {
      sendError(res, 400, validationError('ATTACHMENT'), 'No file provided');
      return;
    }

    if (!claimId && !patientId) {
      sendError(res, 400, validationError('ATTACHMENT'), 'Either claimId or patientId must be provided');
      return;
    }

    const fileSize = req.file.size;
    if (fileSize > MAX_FILE_SIZE) {
      sendError(res, 400, validationError('ATTACHMENT'), `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return;
    }

    const fileExtension = path.extname(req.file.originalname).toLowerCase().slice(1);
    if (!ALLOWED_TYPES.includes(fileExtension)) {
      sendError(res, 400, validationError('ATTACHMENT'), `File type .${fileExtension} is not allowed`);
      return;
    }

    // Validate that claim or patient exists
    if (claimId) {
      const claim = await prisma.claim.findUnique({ where: { id: claimId as string } });
      if (!claim) {
        sendError(res, 404, notFound('CLAIM'), 'Claim not found');
        return;
      }
    }

    if (patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: patientId as string } });
      if (!patient) {
        sendError(res, 404, notFound('PATIENT'), 'Patient not found');
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
        claim: claimId ? { connect: { id: claimId as string } } : undefined,
        patient: patientId ? { connect: { id: patientId as string } } : undefined,
        fileName: req.file.originalname,
        fileType: fileExtension,
        fileSize: fileSize,
        filePath: `/attachments/${fileId}/${req.file.originalname}`,
        uploadedBy: { connect: { id: req.user!.userId } },
        uploadedAt: BigInt(now),
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...attachment,
        uploadedAt: Number(attachment.uploadedAt),
      },
    });
  } catch (error) {
    console.error('Upload attachment error:', error);
    sendError(res, 500, 'ATTACHMENT_UPLOAD_FAILED', 'Failed to upload attachment');
  }
};

export const downloadAttachment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const attachment = await prisma.attachment.findUnique({ where: { id: id as string } });
    if (!attachment) {
      sendError(res, 404, notFound('ATTACHMENT'), 'Attachment not found');
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.filePath.replace('/attachments/', ''));

    if (!fs.existsSync(filePath)) {
      sendError(res, 404, notFound('ATTACHMENT'), 'File not found on disk');
      return;
    }

    res.download(filePath, attachment.fileName);
  } catch (error) {
    console.error('Download attachment error:', error);
    sendError(res, 500, 'ATTACHMENT_INTERNAL_ERROR', 'Internal server error');
  }
};

export const deleteAttachment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const attachment = await prisma.attachment.findUnique({ where: { id: id as string } });
    if (!attachment) {
      sendError(res, 404, notFound('ATTACHMENT'), 'Attachment not found');
      return;
    }

    // Delete file from disk
    const filePath = path.join(UPLOAD_DIR, attachment.filePath.replace('/attachments/', ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await prisma.attachment.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete attachment error:', error);
    sendError(res, 500, 'ATTACHMENT_INTERNAL_ERROR', 'Internal server error');
  }
};
