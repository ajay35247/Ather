// @ather/sdk — public SDK for third-party clients (scaffold)
export const SDK_VERSION = "0.1.0";

export interface AtherClientOptions {
  baseUrl: string;
  token?: string;
}

export class AtherClient {
  constructor(public readonly options: AtherClientOptions) {}
}
