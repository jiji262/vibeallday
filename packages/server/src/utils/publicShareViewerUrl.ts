import {
  DEFAULT_VIBEALLDAY_CLIENT_BASE_URL,
  buildVibeAllDayClientPublicShareBaseUrl,
  buildVibeAllDayClientPublicShareUrl,
  normalizeVibeAllDayClientBaseUrl,
  normalizeVibeAllDayClientBaseUrlFromShareViewerUrl,
} from "@vibeallday/shared";

const VIBEALLDAY_CLIENT_BASE_URL_ENV = "VIBEALLDAY_CLIENT_BASE_URL";

export function getDefaultVibeAllDayClientBaseUrl(): string {
  return DEFAULT_VIBEALLDAY_CLIENT_BASE_URL;
}

export function getDefaultPublicShareViewerBaseUrl(): string {
  return buildVibeAllDayClientPublicShareBaseUrl(
    DEFAULT_VIBEALLDAY_CLIENT_BASE_URL,
  );
}

export function normalizePublicShareViewerBaseUrl(raw: string): string {
  return buildVibeAllDayClientPublicShareBaseUrl(
    normalizeVibeAllDayClientBaseUrlFromShareViewerUrl(raw),
  );
}

export function resolveVibeAllDayClientBaseUrl(
  configured?: string | null,
  legacyShareViewerBaseUrl?: string | null,
): string {
  if (configured) {
    return normalizeVibeAllDayClientBaseUrl(configured);
  }

  const envVibeAllDayClientBaseUrl =
    process.env[VIBEALLDAY_CLIENT_BASE_URL_ENV];
  if (envVibeAllDayClientBaseUrl) {
    return normalizeVibeAllDayClientBaseUrl(envVibeAllDayClientBaseUrl);
  }

  if (legacyShareViewerBaseUrl) {
    return normalizeVibeAllDayClientBaseUrlFromShareViewerUrl(
      legacyShareViewerBaseUrl,
    );
  }

  return DEFAULT_VIBEALLDAY_CLIENT_BASE_URL;
}

export function resolvePublicShareViewerBaseUrl(
  configured?: string | null,
  legacyShareViewerBaseUrl?: string | null,
): string {
  return buildVibeAllDayClientPublicShareBaseUrl(
    resolveVibeAllDayClientBaseUrl(configured, legacyShareViewerBaseUrl),
  );
}

export function buildPublicShareViewerUrl(
  secret: string,
  vibeAllDayClientBaseUrl: string,
): string {
  return buildVibeAllDayClientPublicShareUrl(secret, vibeAllDayClientBaseUrl);
}
