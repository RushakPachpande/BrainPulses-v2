import type { NextFunction, Request, Response } from 'express';
import { badRequest } from '../../lib/errors.js';
import { verifyActingUserPassword } from '../../lib/verify-acting-password.js';
import { userActor } from '../../middleware/auth.js';
import {
  buildAssessmentSampleWorkbook,
  confirmAssessmentImport,
  previewAssessmentImport,
  type ColumnMapping,
} from './assessment-import.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json(await service.listActivities(actor.organizationId, req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json({
      data: await service.getActivity(actor.organizationId, req.params.id as string, actor),
    });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createActivity(actor.organizationId, actor.userId, actor, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateActivity(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
      req.body,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function publish(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.publishActivity(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
      req.header('idempotency-key') ?? undefined,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.archiveActivity(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    await verifyActingUserPassword(actor.userId, req.body.password as string);
    const data = await service.deleteActivity(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listRoundQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.listRoundQuestions(
      actor.organizationId,
      actor,
      req.params.id as string,
      req.params.roundId as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createRoundQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createRoundQuestion(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
      req.params.roundId as string,
      req.body,
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function deleteRoundQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    await verifyActingUserPassword(actor.userId, req.body.password as string);
    await service.deleteRoundQuestion(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
      req.params.roundId as string,
      req.params.questionId as string,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

function parseMappingField(raw: unknown): ColumnMapping | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ColumnMapping;
    } catch {
      throw badRequest('mapping must be a JSON object.');
    }
  }
  if (typeof raw === 'object') return raw as ColumnMapping;
  return undefined;
}

export async function sampleAssessmentImport(req: Request, res: Response, next: NextFunction) {
  try {
    void req;
    const buffer = await buildAssessmentSampleWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="brainpulses-assessment-questions-sample.xlsx"',
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function previewAssessmentQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw badRequest(
        'Upload an Excel (.xlsx) file in the multipart field “file”. Download Sample Excel for the correct template.',
      );
    }
    const mapping = parseMappingField(req.body?.mapping);
    const data = await previewAssessmentImport(file.buffer, mapping);
    // Do not echo every row back — keep payload light for the mapping UI.
    res.json({
      data: {
        headers: data.headers,
        mapping: data.mapping,
        fields: data.fields,
        issues: data.issues,
        validCount: data.validCount,
        totalRows: data.totalRows,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmAssessmentQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const file = req.file;
    if (!file) {
      throw badRequest(
        'Upload an Excel (.xlsx) file in the multipart field “file”. Download Sample Excel for the correct template.',
      );
    }
    const mapping = parseMappingField(req.body?.mapping);
    const data = await confirmAssessmentImport(
      actor.organizationId,
      actor,
      actor.userId,
      req.params.id as string,
      file.buffer,
      mapping,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
