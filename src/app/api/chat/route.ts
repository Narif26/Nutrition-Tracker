import { NextResponse } from "next/server";
import { handleChatMessage } from "@/lib/services/chat";
import { chatMessageSchema } from "@/lib/validations/chat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = chatMessageSchema.parse(await request.json());
    const result = await handleChatMessage(payload.message, payload.timeZone);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }
}
