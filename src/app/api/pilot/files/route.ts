import { upload, download } from "@/server/attachments";
export const runtime = "nodejs";
export const POST = (r: Request) => upload(r, false);
export const GET = (r: Request) => download(r, false);
