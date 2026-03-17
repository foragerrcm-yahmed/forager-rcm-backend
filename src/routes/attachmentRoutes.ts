import { Router } from 'express';
import { getAttachments, uploadAttachment, downloadAttachment, deleteAttachment } from '../controllers/attachmentController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getAttachments);
router.post('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), uploadAttachment);
router.get('/:id/download', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), downloadAttachment);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteAttachment);

export default router;
