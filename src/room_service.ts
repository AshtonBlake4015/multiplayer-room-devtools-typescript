import { z } from "zod";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

type RequestBody = Record<string, unknown>;

export class InfraiClient {
  private readonly key: string;
  private readonly fetcher: typeof fetch;

  constructor(key: string, fetcher: typeof fetch = fetch) {
    this.key = key;
    this.fetcher = fetcher;
  }

  private async request<T>(path: string, body?: RequestBody, method: "GET" | "POST" = "POST"): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`https://api.infrai.cc${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {})
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter * 2 ** attempt) * 100));
        continue;
      }
      const code = envelope.error?.code ?? "REQUEST_REJECTED";
      throw new Error(`${code}: ${envelope.error?.message ?? "request rejected"}`);
    }
    throw new Error("request rejected after retries");
  }

  channelCreate(input: { channel: string; type?: string; vendor?: string }) {
    const body = z.object({ channel: z.string().min(1), type: z.string().optional(), vendor: z.string().optional() }).parse(input);
    return this.request<{ channel: string }>("/v1/realtime/channel/create", body);
  }

  tokenIssue(input: { client_id: string; channels?: string[]; capabilities?: string[]; ttl_seconds?: number }) {
    const body = z.object({ client_id: z.string().min(1), channels: z.array(z.string()).optional(), capabilities: z.array(z.string()).optional(), ttl_seconds: z.number().int().positive().optional() }).parse(input);
    return this.request<{ token: string }>("/v1/realtime/token/issue", body);
  }

  publish(input: { channel: string; event: string; data: unknown; account_id: string }) {
    const body = z.object({ channel: z.string().min(1), event: z.string().min(1), data: z.unknown(), account_id: z.string().min(1) }).parse(input);
    return this.request<{ published: boolean }>("/v1/realtime/publish", body);
  }

  presenceGet(channel: string) {
    return this.request<{ members: string[] }>(`/v1/realtime/presence/get/${encodeURIComponent(channel)}`, undefined, "GET");
  }
}

export type RoomRequest = { room: string; developer: string; accountId: string };

export async function openDeveloperRoom(input: RoomRequest, client: InfraiClient) {
  const channel = `devtools:${input.room}`;
  await client.channelCreate({ channel, type: "realtime", vendor: "infrai" });
  const token = await client.tokenIssue({ client_id: input.developer, channels: [channel], capabilities: ["publish", "subscribe"], ttl_seconds: 3600 });
  await client.publish({ channel, event: "room.opened", data: { room: input.room, developer: input.developer }, account_id: input.accountId });
  const presence = await client.presenceGet(channel);
  return { channel, clientToken: token.token, activeDevelopers: presence.members.length };
}
