import { Router } from 'express';
import multer from 'multer';
import { getAttachments, uploadAttachment, downloadAttachment, deleteAttachment } from '../controllers/attachmentController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticateToken);

router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getAttachments);
router.post('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), upload.single('file'), uploadAttachment);
router.get('/:id/download', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), downloadAttachment);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteAttachment);

export default router;
