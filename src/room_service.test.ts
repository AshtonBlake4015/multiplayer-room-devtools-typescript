import assert from "node:assert/strict";
import { InfraiClient, openDeveloperRoom } from "./room_service.ts";

const calls: Array<{ url: string; init: RequestInit }> = [];
const fakeFetch: typeof fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  const path = new URL(String(url)).pathname;
  const data = path.includes("token/issue") ? { token: "client-token" } : path.includes("presence/get") ? { members: ["a", "b"] } : path.includes("channel/create") ? { channel: "devtools:release-42" } : { published: true };
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const result = await openDeveloperRoom({ room: "release-42", developer: "alice", accountId: "acct" }, new InfraiClient("from-env", fakeFetch));
assert.deepEqual(result, { channel: "devtools:release-42", clientToken: "client-token", activeDevelopers: 2 });
assert.equal(calls.length, 4);
assert.deepEqual(calls.map((call) => call.init.method), ["POST", "POST", "POST", "GET"]);
console.log("room workflow test passed");
