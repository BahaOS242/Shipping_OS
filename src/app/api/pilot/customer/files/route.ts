import { upload, download } from "@/server/attachments";
export const runtime = "nodejs";
export const POST = (r: Request) => upload(r, true);
export const GET = (r: Request) => download(r, true);
