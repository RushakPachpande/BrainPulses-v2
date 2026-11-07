import type { NextFunction, Request, Response } from 'express';
import { badRequest } from '../../lib/errors.js';
import { userActor } from '../../middleware/auth.js';
import {
  assessmentFileBase,
  buildAssessmentCsv,
  buildAssessmentWorkbook,
  parseAssessmentColumns,
} from './export.js';
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
    const exported = await service.exportAssessmentRows(actor.organizationId, actorOf(req), {
      ...query,
      includeAbsent: query.includeAbsent === 'true',
    });
    const base = assessmentFileBase(exported.assessmentName, exported.roundName);
    if (query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
      res.send(buildAssessmentCsv(exported.rows, columns));
      return;
    }
    const buffer = await buildAssessmentWorkbook(exported.rows, columns);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    res.send(buffer);
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
