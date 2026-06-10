import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createRecord,
  deleteRecord,
  isDatabaseConfigured,
  updateRecord,
} from "@/lib/trip-db";

const entitySchema = z.enum([
  "activities",
  "expenses",
  "bookings",
  "guides",
  "checklist",
]);

const mutationSchema = z.object({
  entity: entitySchema,
  id: z.string().optional(),
  record: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 400 },
    );
  }

  const parsed = mutationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = await createRecord(parsed.data.entity, parsed.data.record);
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 400 },
    );
  }

  const parsed = mutationSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json(
      { error: "An entity id is required for updates." },
      { status: 400 },
    );
  }

  const data = await updateRecord(
    parsed.data.entity,
    parsed.data.id,
    parsed.data.record,
  );
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 400 },
    );
  }

  const parsed = mutationSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json(
      { error: "An entity id is required for deletes." },
      { status: 400 },
    );
  }

  const data = await deleteRecord(parsed.data.entity, parsed.data.id);
  return NextResponse.json(data);
}
