import type { ModelCatalogStatus } from "@vibeallday/shared";

/** Bounded, user-displayable reason a live model read failed. */
export function modelCatalogError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 200);
}

export function liveModelCatalog(error?: string): ModelCatalogStatus {
  return {
    source: "live",
    fetchedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
}

export function fallbackModelCatalog(error?: string): ModelCatalogStatus {
  return {
    source: "fallback",
    fetchedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
}
