import { NextResponse } from "next/server";
import { getAppSnapshot } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeZone = searchParams.get("timeZone");
    const days = searchParams.get("days");
    const parsedDays = days ? Number.parseInt(days, 10) : undefined;

    return NextResponse.json({
      ok: true,
      snapshot: await getAppSnapshot({
        days:
          parsedDays && Number.isFinite(parsedDays) && parsedDays >= 7 && parsedDays <= 30
            ? parsedDays
            : undefined,
        timeZone,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not load the dashboard snapshot.",
      },
      {
        status: 400,
      },
    );
  }
}
