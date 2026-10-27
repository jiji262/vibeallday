import type { ProviderImageSizing } from "@vibeallday/shared";

export function getProviderImageSizing(
  providerName: string,
  model?: string,
): ProviderImageSizing & {
  profiles: NonNullable<ProviderImageSizing["profiles"]>;
};
