import type { NextFunction, Request, Response } from 'express';
import { badRequest } from '../../lib/errors.js';
import { userActor } from '../../middleware/auth.js';
import { parseAssessmentColumns } from './export.js';
import * as service from './service.js';

function actorOf(req: Request) {
  const actor = userActor(req);
  return {
    userId: actor.userId,
    role: actor.role,
    assessmentAccess: actor.assessmentAccess,
    quizAccess: actor.quizAccess,
  };
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json({
      data: await service.listAssessmentReports(
        actor.organizationId,
        actorOf(req),
        req.query as never,
      ),
    });
  } catch (err) {
    next(err);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const query = req.query as { roundId?: string; attemptId?: string };
    res.json({
      data: await service.getAssessmentReportDetail(
        actor.organizationId,
        actorOf(req),
        req.params.registrationId as string,
        query.roundId ?? '',
        query.attemptId,
      ),
    });
  } catch (err) {
    next(err);
  }
}

export async function download(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const query = req.query as unknown as {
      columns: string;
      format: 'xlsx' | 'csv';
      includeAbsent: 'true' | 'false';
      q: string;
      activityId?: string;
      roundId?: string;
      activityStatus: 'any' | 'active' | 'expired' | 'inactive';
      attemptStatus: 'any' | 'completed' | 'in_progress' | 'not_started';
      autoSubmitted: 'any' | 'yes' | 'no';
      sort: 'submitted';
      dir: 'asc' | 'desc';
    };
    const columns = parseAssessmentColumns(query.columns);
    if (columns.length === 0) throw badRequest('Choose at least one column.');
    const { enqueueJob } = await import('../../lib/queue/queues.js');
    const enqueued = await enqueueJob('report.assessment-export', {
      type: 'report.assessment-export',
      organizationId: actor.organizationId,
      actor: actorOf(req),
      query: query as unknown as Record<string, unknown>,
      columns,
      format: query.format,
      includeAbsent: query.includeAbsent === 'true',
      requestId: req.requestId,
    });
    res.status(202).json({
      data: {
        jobId: enqueued.jobId,
        status: enqueued.status === 'completed' ? 'completed' : 'queued',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function publish(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.publishRoundResults(
      actor.organizationId,
      actorOf(req),
      req.params.roundId as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
