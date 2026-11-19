import type { RequestHandler, Router } from 'express';

/**
 * Load a router on the first request and reuse it after that.
 * A failed load is forgotten so the next request can try again.
 */
export function lazyRouter(load: () => Promise<Router>): RequestHandler {
  let router: Router | undefined;
  let loading: Promise<Router> | undefined;
  return (req, res, next) => {
    if (router) {
      router(req, res, next);
      return;
    }
    loading ??= load()
      .then((loaded) => {
        router = loaded;
        return loaded;
      })
      .catch((err: unknown) => {
        loading = undefined;
        throw err;
      });
    void loading.then(
      (loaded) => {
        loaded(req, res, next);
      },
      (err: unknown) => {
        next(err);
      },
    );
  };
}
