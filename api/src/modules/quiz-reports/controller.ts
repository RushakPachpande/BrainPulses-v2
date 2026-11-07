import type { NextFunction, Request, Response } from 'express';
import { badRequest } from '../../lib/errors.js';
import { userActor } from '../../middleware/auth.js';
import { parseExportColumns } from './export.js';
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
    const query = req.query as never;
    res.json({
      data: await service.listQuizReports(actor.organizationId, actorOf(req), query),
    });
  } catch (err) {
    next(err);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const query = req.query as { attemptId?: string };
    res.json({
      data: await service.getQuizReportDetail(
        actor.organizationId,
        actorOf(req),
        req.params.registrationId as string,
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
      contestId?: string;
      activityId?: string;
      quizStatus: 'any' | 'active' | 'expired' | 'inactive';
      attemptStatus: 'any' | 'completed' | 'in_progress' | 'not_started';
      autoSubmitted: 'any' | 'yes' | 'no';
      sort: 'code';
      dir: 'asc' | 'desc';
    };
    const columns = parseExportColumns(query.columns);
    if (columns.length === 0) throw badRequest('Choose at least one column.');
    const { enqueueJob } = await import('../../lib/queue/queues.js');
    const enqueued = await enqueueJob('report.quiz-export', {
      type: 'report.quiz-export',
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
    const data = await service.publishQuizResults(
      actor.organizationId,
      actorOf(req),
      req.params.activityId as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
