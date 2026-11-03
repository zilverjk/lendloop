/**
 * Dedupes `users.store` calls: one call per authenticated session, shared by
 * every concurrent caller (EnsureUser on all pages + UserGate on (app) pages).
 * Resets on sign-out and after failures so a retry is possible.
 */
export function createUserEnsurer(store: () => Promise<unknown>) {
  let inflight: Promise<void> | null = null;
  return {
    ensure(isAuthenticated: boolean): Promise<void> {
      if (!isAuthenticated) {
        inflight = null;
        return Promise.resolve();
      }
      if (!inflight) {
        inflight = store().then(
          () => undefined,
          (e) => {
            inflight = null;
            throw e;
          },
        );
      }
      return inflight;
    },
  };
}
