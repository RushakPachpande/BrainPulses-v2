import type { NextFunction, Request, Response } from 'express';
import { badRequest } from '../../lib/errors.js';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json(await service.listBanks(actor.organizationId, req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json({
      data: await service.getBank(actor.organizationId, req.params.id as string, actor),
    });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createBank(actor.organizationId, actor.userId, actor, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateBank(
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

export async function createQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createQuestion(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
      req.body,
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateQuestion(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
      req.params.questionId as string,
      req.body,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function importQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const bankId = req.params.id as string;
    const idempotencyKey = req.header('idempotency-key') ?? undefined;
    const file = req.file;

    if (!file) {
      throw badRequest(
        'Upload an Excel (.xlsx) file in the multipart field “file”. Download Sample Excel for the correct template.',
      );
    }

    const data = await service.importQuestionsFile(
      actor.organizationId,
      actor.userId,
      actor,
      bankId,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      },
      idempotencyKey,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/** @deprecated Prefer importQuestions — kept name for older OpenAPI refs. */
export const importCsv = importQuestions;

export async function sampleXlsx(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const buffer = await service.sampleQuestionsWorkbook(
      actor.organizationId,
      actor,
      req.params.id as string,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="brainpulses-question-sample.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function sampleCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const csv = await service.sampleQuestionsCsv(
      actor.organizationId,
      actor,
      req.params.id as string,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="brainpulses-question-sample.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

export async function exportXlsx(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const buffer = await service.exportQuestionsWorkbook(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="brainpulses-question-export.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const csv = await service.exportQuestionsCsv(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="brainpulses-question-export.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
