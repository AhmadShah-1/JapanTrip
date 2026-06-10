export type CurrencyCode = "USD" | "JPY" | "KRW";

export type SourceType = "official" | "estimate" | "manual";

export type ExpenseStatus = "planned" | "booked" | "paid";

export type BookingKind =
  | "flight"
  | "hotel"
  | "train"
  | "baggage"
  | "transfer";

export type GuideKind =
  | "airport"
  | "station"
  | "transport"
  | "packing"
  | "budget";

export type EditableEntity =
  | "activities"
  | "expenses"
  | "bookings"
  | "guides"
  | "checklist";

export interface ExchangeRate {
  currency: CurrencyCode;
  usdRate: number;
  note: string;
  updatedAt: string;
}

export interface TripDay {
  id: string;
  date: string;
  city: string;
  title: string;
  subtitle: string;
  hotel: string;
  notes: string;
}

export interface Activity {
  id: string;
  tripDayId: string;
  date: string;
  city: string;
  timeLabel: string;
  title: string;
  description: string;
  category: string;
  division: string;
  tags: string[];
  estimatedCost: number | null;
  actualCost: number | null;
  currency: CurrencyCode | null;
  usdEstimatedCost: number | null;
  usdActualCost: number | null;
  sourceType: SourceType;
  sourceUrl: string | null;
  bookingNeeded: boolean;
  priority: number;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  usdAmount: number;
  division: string;
  tags: string[];
  notes: string;
  date: string;
  status: ExpenseStatus;
  sourceType: SourceType;
  sourceUrl: string | null;
}

export interface Booking {
  id: string;
  kind: BookingKind;
  title: string;
  provider: string;
  confirmationCode: string;
  startDateTime: string;
  endDateTime: string;
  origin: string;
  destination: string;
  terminal: string;
  address: string;
  cost: number | null;
  currency: CurrencyCode | null;
  usdCost: number | null;
  leaveBy: string;
  notes: string;
  sourceType: SourceType;
  sourceUrl: string | null;
}

export interface Guide {
  id: string;
  kind: GuideKind;
  title: string;
  summary: string;
  details: string;
  leaveBy: string;
  linkedDate: string;
  sourceType: SourceType;
}

export interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  notes: string;
  status: "todo" | "done";
  estimatedCost: number | null;
  currency: CurrencyCode | null;
  usdEstimatedCost: number | null;
}

export interface SeedData {
  tripDays: TripDay[];
  activities: Activity[];
  expenses: Expense[];
  bookings: Booking[];
  guides: Guide[];
  checklist: ChecklistItem[];
  exchangeRates: ExchangeRate[];
}

export interface TripAppData extends SeedData {
  databaseEnabled: boolean;
  persistenceMode: "database" | "seed-only";
  seededAt: string;
}
