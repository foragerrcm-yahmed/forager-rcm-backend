import { Router } from 'express';
import { handleStediWebhook } from '../controllers/stediWebhookController';

const router = Router();

// No JWT auth — Stedi calls this endpoint directly with a shared secret
// The controller validates STEDI_WEBHOOK_SECRET if set
router.post('/', handleStediWebhook);

export default router;
