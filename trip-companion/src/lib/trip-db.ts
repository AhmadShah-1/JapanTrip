import { neon } from "@neondatabase/serverless";

import type {
  Activity,
  Booking,
  ChecklistItem,
  EditableEntity,
  ExchangeRate,
  Expense,
  Guide,
  SeedData,
  TripAppData,
  TripDay,
} from "@/lib/trip-types";
import { getSeedData } from "@/lib/trip-seed";
import { joinTags, parseTags } from "@/lib/trip-utils";

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

const sql = connectionString ? neon(connectionString) : null;

let initializedPromise: Promise<void> | null = null;

function hasDatabase(): boolean {
  return Boolean(sql);
}

async function exec(statement: string): Promise<void> {
  if (!sql) return;
  await sql.query(statement);
}

async function initializeSchema(): Promise<void> {
  if (!sql) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS trip_days (
      id TEXT PRIMARY KEY,
      date_text TEXT NOT NULL,
      city TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      hotel TEXT NOT NULL,
      notes TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      trip_day_id TEXT NOT NULL,
      date_text TEXT NOT NULL,
      city TEXT NOT NULL,
      time_label TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      division TEXT NOT NULL,
      tags_text TEXT NOT NULL,
      estimated_cost DOUBLE PRECISION,
      actual_cost DOUBLE PRECISION,
      currency TEXT,
      usd_estimated_cost DOUBLE PRECISION,
      usd_actual_cost DOUBLE PRECISION,
      source_type TEXT NOT NULL,
      source_url TEXT,
      booking_needed BOOLEAN NOT NULL,
      priority INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      currency TEXT NOT NULL,
      usd_amount DOUBLE PRECISION NOT NULL,
      division TEXT NOT NULL,
      tags_text TEXT NOT NULL,
      notes TEXT NOT NULL,
      date_text TEXT NOT NULL,
      status TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      provider TEXT NOT NULL,
      confirmation_code TEXT NOT NULL,
      start_date_time TEXT NOT NULL,
      end_date_time TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      terminal TEXT NOT NULL,
      address TEXT NOT NULL,
      cost DOUBLE PRECISION,
      currency TEXT,
      usd_cost DOUBLE PRECISION,
      leave_by TEXT NOT NULL,
      notes TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS guides (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT NOT NULL,
      leave_by TEXT NOT NULL,
      linked_date TEXT NOT NULL,
      source_type TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      notes TEXT NOT NULL,
      status TEXT NOT NULL,
      estimated_cost DOUBLE PRECISION,
      currency TEXT,
      usd_estimated_cost DOUBLE PRECISION
    )`,
    `CREATE TABLE IF NOT EXISTS exchange_rates (
      currency TEXT PRIMARY KEY,
      usd_rate DOUBLE PRECISION NOT NULL,
      note TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ];

  for (const statement of statements) {
    await exec(statement);
  }
}

async function countRows(table: string): Promise<number> {
  if (!sql) return 0;
  const query = `SELECT COUNT(*)::int AS count FROM ${table}`;
  const rows = (await sql.query(query)) as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

async function seedTable(seedData: SeedData): Promise<void> {
  if (!sql) return;
  const hasDays = await countRows("trip_days");
  if (hasDays > 0) return;

  for (const day of seedData.tripDays) {
    await sql`
      INSERT INTO trip_days (id, date_text, city, title, subtitle, hotel, notes)
      VALUES (${day.id}, ${day.date}, ${day.city}, ${day.title}, ${day.subtitle}, ${day.hotel}, ${day.notes})
    `;
  }

  for (const activity of seedData.activities) {
    await sql`
      INSERT INTO activities (
        id, trip_day_id, date_text, city, time_label, title, description, category,
        division, tags_text, estimated_cost, actual_cost, currency, usd_estimated_cost,
        usd_actual_cost, source_type, source_url, booking_needed, priority
      ) VALUES (
        ${activity.id}, ${activity.tripDayId}, ${activity.date}, ${activity.city}, ${activity.timeLabel},
        ${activity.title}, ${activity.description}, ${activity.category}, ${activity.division},
        ${joinTags(activity.tags)}, ${activity.estimatedCost}, ${activity.actualCost},
        ${activity.currency}, ${activity.usdEstimatedCost}, ${activity.usdActualCost},
        ${activity.sourceType}, ${activity.sourceUrl}, ${activity.bookingNeeded}, ${activity.priority}
      )
    `;
  }

  for (const expense of seedData.expenses) {
    await sql`
      INSERT INTO expenses (
        id, name, amount, currency, usd_amount, division, tags_text,
        notes, date_text, status, source_type, source_url
      ) VALUES (
        ${expense.id}, ${expense.name}, ${expense.amount}, ${expense.currency},
        ${expense.usdAmount}, ${expense.division}, ${joinTags(expense.tags)},
        ${expense.notes}, ${expense.date}, ${expense.status}, ${expense.sourceType},
        ${expense.sourceUrl}
      )
    `;
  }

  for (const booking of seedData.bookings) {
    await sql`
      INSERT INTO bookings (
        id, kind, title, provider, confirmation_code, start_date_time, end_date_time,
        origin, destination, terminal, address, cost, currency, usd_cost, leave_by,
        notes, source_type, source_url
      ) VALUES (
        ${booking.id}, ${booking.kind}, ${booking.title}, ${booking.provider},
        ${booking.confirmationCode}, ${booking.startDateTime}, ${booking.endDateTime},
        ${booking.origin}, ${booking.destination}, ${booking.terminal}, ${booking.address},
        ${booking.cost}, ${booking.currency}, ${booking.usdCost}, ${booking.leaveBy},
        ${booking.notes}, ${booking.sourceType}, ${booking.sourceUrl}
      )
    `;
  }

  for (const guide of seedData.guides) {
    await sql`
      INSERT INTO guides (
        id, kind, title, summary, details, leave_by, linked_date, source_type
      ) VALUES (
        ${guide.id}, ${guide.kind}, ${guide.title}, ${guide.summary},
        ${guide.details}, ${guide.leaveBy}, ${guide.linkedDate}, ${guide.sourceType}
      )
    `;
  }

  for (const item of seedData.checklist) {
    await sql`
      INSERT INTO checklist_items (
        id, category, label, notes, status, estimated_cost, currency, usd_estimated_cost
      ) VALUES (
        ${item.id}, ${item.category}, ${item.label}, ${item.notes}, ${item.status},
        ${item.estimatedCost}, ${item.currency}, ${item.usdEstimatedCost}
      )
    `;
  }

  for (const rate of seedData.exchangeRates) {
    await sql`
      INSERT INTO exchange_rates (currency, usd_rate, note, updated_at)
      VALUES (${rate.currency}, ${rate.usdRate}, ${rate.note}, ${rate.updatedAt})
      ON CONFLICT (currency) DO UPDATE
      SET usd_rate = EXCLUDED.usd_rate, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at
    `;
  }
}

async function ensureReady(): Promise<void> {
  if (!sql) return;
  if (!initializedPromise) {
    initializedPromise = (async () => {
      await initializeSchema();
      await seedTable(getSeedData());
    })();
  }
  await initializedPromise;
}

function buildAppData(seedData: SeedData, mode: "database" | "seed-only"): TripAppData {
  return {
    ...seedData,
    databaseEnabled: mode === "database",
    persistenceMode: mode,
    seededAt: new Date().toISOString(),
  };
}

function mapTripDays(rows: Array<Record<string, unknown>>): TripDay[] {
  return rows.map((row) => ({
    id: String(row.id),
    date: String(row.date_text),
    city: String(row.city),
    title: String(row.title),
    subtitle: String(row.subtitle),
    hotel: String(row.hotel),
    notes: String(row.notes),
  }));
}

function mapActivities(rows: Array<Record<string, unknown>>): Activity[] {
  return rows.map((row) => ({
    id: String(row.id),
    tripDayId: String(row.trip_day_id),
    date: String(row.date_text),
    city: String(row.city),
    timeLabel: String(row.time_label),
    title: String(row.title),
    description: String(row.description),
    category: String(row.category),
    division: String(row.division),
    tags: parseTags(String(row.tags_text)),
    estimatedCost: row.estimated_cost === null ? null : Number(row.estimated_cost),
    actualCost: row.actual_cost === null ? null : Number(row.actual_cost),
    currency: (row.currency as Activity["currency"]) ?? null,
    usdEstimatedCost:
      row.usd_estimated_cost === null ? null : Number(row.usd_estimated_cost),
    usdActualCost: row.usd_actual_cost === null ? null : Number(row.usd_actual_cost),
    sourceType: String(row.source_type) as Activity["sourceType"],
    sourceUrl: row.source_url ? String(row.source_url) : null,
    bookingNeeded: Boolean(row.booking_needed),
    priority: Number(row.priority),
  }));
}

function mapExpenses(rows: Array<Record<string, unknown>>): Expense[] {
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    amount: Number(row.amount),
    currency: String(row.currency) as Expense["currency"],
    usdAmount: Number(row.usd_amount),
    division: String(row.division),
    tags: parseTags(String(row.tags_text)),
    notes: String(row.notes),
    date: String(row.date_text),
    status: String(row.status) as Expense["status"],
    sourceType: String(row.source_type) as Expense["sourceType"],
    sourceUrl: row.source_url ? String(row.source_url) : null,
  }));
}

function mapBookings(rows: Array<Record<string, unknown>>): Booking[] {
  return rows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind) as Booking["kind"],
    title: String(row.title),
    provider: String(row.provider),
    confirmationCode: String(row.confirmation_code),
    startDateTime: String(row.start_date_time),
    endDateTime: String(row.end_date_time),
    origin: String(row.origin),
    destination: String(row.destination),
    terminal: String(row.terminal),
    address: String(row.address),
    cost: row.cost === null ? null : Number(row.cost),
    currency: (row.currency as Booking["currency"]) ?? null,
    usdCost: row.usd_cost === null ? null : Number(row.usd_cost),
    leaveBy: String(row.leave_by),
    notes: String(row.notes),
    sourceType: String(row.source_type) as Booking["sourceType"],
    sourceUrl: row.source_url ? String(row.source_url) : null,
  }));
}

function mapGuides(rows: Array<Record<string, unknown>>): Guide[] {
  return rows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind) as Guide["kind"],
    title: String(row.title),
    summary: String(row.summary),
    details: String(row.details),
    leaveBy: String(row.leave_by),
    linkedDate: String(row.linked_date),
    sourceType: String(row.source_type) as Guide["sourceType"],
  }));
}

function mapChecklist(rows: Array<Record<string, unknown>>): ChecklistItem[] {
  return rows.map((row) => ({
    id: String(row.id),
    category: String(row.category),
    label: String(row.label),
    notes: String(row.notes),
    status: String(row.status) as ChecklistItem["status"],
    estimatedCost:
      row.estimated_cost === null ? null : Number(row.estimated_cost),
    currency: (row.currency as ChecklistItem["currency"]) ?? null,
    usdEstimatedCost:
      row.usd_estimated_cost === null ? null : Number(row.usd_estimated_cost),
  }));
}

function mapRates(rows: Array<Record<string, unknown>>): ExchangeRate[] {
  return rows.map((row) => ({
    currency: String(row.currency) as ExchangeRate["currency"],
    usdRate: Number(row.usd_rate),
    note: String(row.note),
    updatedAt: String(row.updated_at),
  }));
}

export async function getTripAppData(): Promise<TripAppData> {
  if (!sql) {
    return buildAppData(getSeedData(), "seed-only");
  }

  await ensureReady();
  const [tripDays, activities, expenses, bookings, guides, checklist, exchangeRates] =
    await Promise.all([
      sql`SELECT * FROM trip_days ORDER BY date_text ASC`,
      sql`SELECT * FROM activities ORDER BY date_text ASC, time_label ASC`,
      sql`SELECT * FROM expenses ORDER BY date_text ASC, name ASC`,
      sql`SELECT * FROM bookings ORDER BY start_date_time ASC`,
      sql`SELECT * FROM guides ORDER BY linked_date ASC, title ASC`,
      sql`SELECT * FROM checklist_items ORDER BY category ASC, label ASC`,
      sql`SELECT * FROM exchange_rates ORDER BY currency ASC`,
    ]);

  return buildAppData(
    {
      tripDays: mapTripDays(tripDays),
      activities: mapActivities(activities),
      expenses: mapExpenses(expenses),
      bookings: mapBookings(bookings),
      guides: mapGuides(guides),
      checklist: mapChecklist(checklist),
      exchangeRates: mapRates(exchangeRates),
    },
    "database",
  );
}

export function isDatabaseConfigured(): boolean {
  return hasDatabase();
}

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function resetDatabaseFromSeed(): Promise<TripAppData> {
  if (!sql) {
    return buildAppData(getSeedData(), "seed-only");
  }

  await ensureReady();
  await exec("TRUNCATE activities, bookings, checklist_items, expenses, exchange_rates, guides, trip_days");
  await seedTable(getSeedData());
  return getTripAppData();
}

export async function createRecord(
  entity: EditableEntity,
  record: Record<string, unknown>,
): Promise<TripAppData> {
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensureReady();

  switch (entity) {
    case "expenses": {
      const id = randomId("expense");
      await sql`
        INSERT INTO expenses (
          id, name, amount, currency, usd_amount, division, tags_text,
          notes, date_text, status, source_type, source_url
        ) VALUES (
          ${id}, ${String(record.name ?? "")}, ${Number(record.amount ?? 0)},
          ${String(record.currency ?? "USD")}, ${Number(record.usdAmount ?? 0)},
          ${String(record.division ?? "misc")}, ${joinTags(parseTags(String(record.tags ?? "")))},
          ${String(record.notes ?? "")}, ${String(record.date ?? "")}, ${String(record.status ?? "planned")},
          ${String(record.sourceType ?? "manual")}, ${record.sourceUrl ? String(record.sourceUrl) : null}
        )
      `;
      break;
    }
    case "activities": {
      const id = randomId("activity");
      await sql`
        INSERT INTO activities (
          id, trip_day_id, date_text, city, time_label, title, description, category,
          division, tags_text, estimated_cost, actual_cost, currency, usd_estimated_cost,
          usd_actual_cost, source_type, source_url, booking_needed, priority
        ) VALUES (
          ${id}, ${String(record.tripDayId ?? "")}, ${String(record.date ?? "")},
          ${String(record.city ?? "")}, ${String(record.timeLabel ?? "")},
          ${String(record.title ?? "")}, ${String(record.description ?? "")},
          ${String(record.category ?? "Activity")}, ${String(record.division ?? "activities")},
          ${joinTags(parseTags(String(record.tags ?? "")))},
          ${record.estimatedCost === null ? null : Number(record.estimatedCost ?? 0)},
          ${record.actualCost === null ? null : Number(record.actualCost ?? 0)},
          ${record.currency ? String(record.currency) : null},
          ${record.usdEstimatedCost === null ? null : Number(record.usdEstimatedCost ?? 0)},
          ${record.usdActualCost === null ? null : Number(record.usdActualCost ?? 0)},
          ${String(record.sourceType ?? "manual")},
          ${record.sourceUrl ? String(record.sourceUrl) : null},
          ${Boolean(record.bookingNeeded)},
          ${Number(record.priority ?? 2)}
        )
      `;
      break;
    }
    case "bookings": {
      const id = randomId("booking");
      await sql`
        INSERT INTO bookings (
          id, kind, title, provider, confirmation_code, start_date_time, end_date_time,
          origin, destination, terminal, address, cost, currency, usd_cost, leave_by,
          notes, source_type, source_url
        ) VALUES (
          ${id}, ${String(record.kind ?? "transfer")}, ${String(record.title ?? "")},
          ${String(record.provider ?? "")}, ${String(record.confirmationCode ?? "")},
          ${String(record.startDateTime ?? "")}, ${String(record.endDateTime ?? "")},
          ${String(record.origin ?? "")}, ${String(record.destination ?? "")},
          ${String(record.terminal ?? "")}, ${String(record.address ?? "")},
          ${record.cost === null ? null : Number(record.cost ?? 0)},
          ${record.currency ? String(record.currency) : null},
          ${record.usdCost === null ? null : Number(record.usdCost ?? 0)},
          ${String(record.leaveBy ?? "")}, ${String(record.notes ?? "")},
          ${String(record.sourceType ?? "manual")},
          ${record.sourceUrl ? String(record.sourceUrl) : null}
        )
      `;
      break;
    }
    case "guides": {
      const id = randomId("guide");
      await sql`
        INSERT INTO guides (
          id, kind, title, summary, details, leave_by, linked_date, source_type
        ) VALUES (
          ${id}, ${String(record.kind ?? "transport")}, ${String(record.title ?? "")},
          ${String(record.summary ?? "")}, ${String(record.details ?? "")},
          ${String(record.leaveBy ?? "")}, ${String(record.linkedDate ?? "")},
          ${String(record.sourceType ?? "manual")}
        )
      `;
      break;
    }
    case "checklist": {
      const id = randomId("checklist");
      await sql`
        INSERT INTO checklist_items (
          id, category, label, notes, status, estimated_cost, currency, usd_estimated_cost
        ) VALUES (
          ${id}, ${String(record.category ?? "prep")}, ${String(record.label ?? "")},
          ${String(record.notes ?? "")}, ${String(record.status ?? "todo")},
          ${record.estimatedCost === null ? null : Number(record.estimatedCost ?? 0)},
          ${record.currency ? String(record.currency) : null},
          ${record.usdEstimatedCost === null ? null : Number(record.usdEstimatedCost ?? 0)}
        )
      `;
      break;
    }
  }

  return getTripAppData();
}

export async function updateRecord(
  entity: EditableEntity,
  id: string,
  record: Record<string, unknown>,
): Promise<TripAppData> {
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensureReady();

  switch (entity) {
    case "expenses":
      await sql`
        UPDATE expenses
        SET name = ${String(record.name ?? "")},
            amount = ${Number(record.amount ?? 0)},
            currency = ${String(record.currency ?? "USD")},
            usd_amount = ${Number(record.usdAmount ?? 0)},
            division = ${String(record.division ?? "misc")},
            tags_text = ${joinTags(parseTags(String(record.tags ?? "")))},
            notes = ${String(record.notes ?? "")},
            date_text = ${String(record.date ?? "")},
            status = ${String(record.status ?? "planned")},
            source_type = ${String(record.sourceType ?? "manual")},
            source_url = ${record.sourceUrl ? String(record.sourceUrl) : null}
        WHERE id = ${id}
      `;
      break;
    case "activities":
      await sql`
        UPDATE activities
        SET trip_day_id = ${String(record.tripDayId ?? "")},
            date_text = ${String(record.date ?? "")},
            city = ${String(record.city ?? "")},
            time_label = ${String(record.timeLabel ?? "")},
            title = ${String(record.title ?? "")},
            description = ${String(record.description ?? "")},
            category = ${String(record.category ?? "Activity")},
            division = ${String(record.division ?? "activities")},
            tags_text = ${joinTags(parseTags(String(record.tags ?? "")))},
            estimated_cost = ${record.estimatedCost === null ? null : Number(record.estimatedCost ?? 0)},
            actual_cost = ${record.actualCost === null ? null : Number(record.actualCost ?? 0)},
            currency = ${record.currency ? String(record.currency) : null},
            usd_estimated_cost = ${record.usdEstimatedCost === null ? null : Number(record.usdEstimatedCost ?? 0)},
            usd_actual_cost = ${record.usdActualCost === null ? null : Number(record.usdActualCost ?? 0)},
            source_type = ${String(record.sourceType ?? "manual")},
            source_url = ${record.sourceUrl ? String(record.sourceUrl) : null},
            booking_needed = ${Boolean(record.bookingNeeded)},
            priority = ${Number(record.priority ?? 2)}
        WHERE id = ${id}
      `;
      break;
    case "bookings":
      await sql`
        UPDATE bookings
        SET kind = ${String(record.kind ?? "transfer")},
            title = ${String(record.title ?? "")},
            provider = ${String(record.provider ?? "")},
            confirmation_code = ${String(record.confirmationCode ?? "")},
            start_date_time = ${String(record.startDateTime ?? "")},
            end_date_time = ${String(record.endDateTime ?? "")},
            origin = ${String(record.origin ?? "")},
            destination = ${String(record.destination ?? "")},
            terminal = ${String(record.terminal ?? "")},
            address = ${String(record.address ?? "")},
            cost = ${record.cost === null ? null : Number(record.cost ?? 0)},
            currency = ${record.currency ? String(record.currency) : null},
            usd_cost = ${record.usdCost === null ? null : Number(record.usdCost ?? 0)},
            leave_by = ${String(record.leaveBy ?? "")},
            notes = ${String(record.notes ?? "")},
            source_type = ${String(record.sourceType ?? "manual")},
            source_url = ${record.sourceUrl ? String(record.sourceUrl) : null}
        WHERE id = ${id}
      `;
      break;
    case "guides":
      await sql`
        UPDATE guides
        SET kind = ${String(record.kind ?? "transport")},
            title = ${String(record.title ?? "")},
            summary = ${String(record.summary ?? "")},
            details = ${String(record.details ?? "")},
            leave_by = ${String(record.leaveBy ?? "")},
            linked_date = ${String(record.linkedDate ?? "")},
            source_type = ${String(record.sourceType ?? "manual")}
        WHERE id = ${id}
      `;
      break;
    case "checklist":
      await sql`
        UPDATE checklist_items
        SET category = ${String(record.category ?? "prep")},
            label = ${String(record.label ?? "")},
            notes = ${String(record.notes ?? "")},
            status = ${String(record.status ?? "todo")},
            estimated_cost = ${record.estimatedCost === null ? null : Number(record.estimatedCost ?? 0)},
            currency = ${record.currency ? String(record.currency) : null},
            usd_estimated_cost = ${record.usdEstimatedCost === null ? null : Number(record.usdEstimatedCost ?? 0)}
        WHERE id = ${id}
      `;
      break;
  }

  return getTripAppData();
}

export async function deleteRecord(
  entity: EditableEntity,
  id: string,
): Promise<TripAppData> {
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensureReady();

  if (entity === "activities") await sql`DELETE FROM activities WHERE id = ${id}`;
  if (entity === "expenses") await sql`DELETE FROM expenses WHERE id = ${id}`;
  if (entity === "bookings") await sql`DELETE FROM bookings WHERE id = ${id}`;
  if (entity === "guides") await sql`DELETE FROM guides WHERE id = ${id}`;
  if (entity === "checklist") {
    await sql`DELETE FROM checklist_items WHERE id = ${id}`;
  }

  return getTripAppData();
}
