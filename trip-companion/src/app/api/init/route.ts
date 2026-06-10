import { NextResponse } from "next/server";

import { isDatabaseConfigured, resetDatabaseFromSeed } from "@/lib/trip-db";

export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 400 },
    );
  }

  const data = await resetDatabaseFromSeed();
  return NextResponse.json(data);
}
