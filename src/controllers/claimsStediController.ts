import { Request, Response } from 'express';
import { submitClaim, getClaimStatus, StediError } from '../services/stedi.service';

/**
 * POST /api/claims/:id/submit
 * Submit a claim to Stedi as an 837P professional claim.
 */
export async function submitClaimToStedi(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: 'Organization context is required' });
      return;
    }

    const result = await submitClaim(id);

    res.status(200).json({
      success: true,
      message: 'Claim submitted to Stedi successfully',
      data: result,
    });
  } catch (e: any) {
    if (e instanceof StediError) {
      res.status(e.statusCode).json({
        error: e.code,
        message: e.message,
        raw: e.raw,
      });
    } else {
      console.error('Claim submission error:', e);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
    }
  }
}

/**
 * GET /api/claims/:id/status
 * Check the status of a submitted claim via Stedi 276/277.
 */
export async function checkClaimStatusFromStedi(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: 'Organization context is required' });
      return;
    }

    const result = await getClaimStatus(id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    if (e instanceof StediError) {
      res.status(e.statusCode).json({
        error: e.code,
        message: e.message,
        raw: e.raw,
      });
    } else {
      console.error('Claim status check error:', e);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
    }
  }
}
