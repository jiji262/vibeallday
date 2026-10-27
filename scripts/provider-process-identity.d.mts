export function captureProcessIdentity(pid?: number): {
  pid: number;
  startTime: string;
};
export function processGroupAlive(processGroupId: number): boolean;
export function providerHostCapability(options?: {
  platform?: string;
  bun?: boolean;
  probe?: boolean;
}): { supported: true } | { supported: false; reason: string };
