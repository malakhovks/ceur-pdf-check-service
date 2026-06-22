import { NextRequest } from "next/server";
import { auth } from "../../../auth";
import { handleCheckPost } from "./handler";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  return handleCheckPost(request, {
    auth: async () => auth(),
  });
}
