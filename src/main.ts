import { InfraiClient, openDeveloperRoom } from "./room_service.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");

const result = await openDeveloperRoom(
  { room: process.env.ROOM_NAME ?? "release-42", developer: process.env.DEVELOPER_ID ?? "local-dev", accountId: process.env.ACCOUNT_ID ?? "local-account" },
  new InfraiClient(key)
);
console.log(JSON.stringify(result, null, 2));
