import type { AuthActor } from './auth-actor.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      actor?: AuthActor;
    }
  }
}

export {};
