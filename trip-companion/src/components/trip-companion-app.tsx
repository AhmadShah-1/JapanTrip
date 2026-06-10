"use client";

import {
  useDeferredValue,
  useState,
  useTransition,
} from "react";

import type {
  TripAppData,
} from "@/lib/trip-types";
import {
  formatMoney,
  formatUsdWithLocal,
  getActivityCost,
  sumMoney,
} from "@/lib/trip-utils";

type TabId =
  | "dashboard"
  | "calendar"
  | "expenses"
  | "budget"
  | "bookings"
  | "guidance"
  | "checklist";

type ExpenseDraft = {
  name: string;
  amount: string;
  currency: "USD" | "JPY" | "KRW";
  division: string;
  tags: string;
  notes: string;
  date: string;
  status: "planned" | "booked" | "paid";
  sourceUrl: string;
};

type ActivityDraft = {
  tripDayId: string;
  timeLabel: string;
  title: string;
  description: string;
  category: string;
  division: string;
  tags: string;
  estimatedCost: string;
  actualCost: string;
  currency: "" | "USD" | "JPY" | "KRW";
  sourceUrl: string;
  bookingNeeded: boolean;
  priority: string;
};

type BookingDraft = {
  kind: "flight" | "hotel" | "train" | "baggage" | "transfer";
  title: string;
  provider: string;
  confirmationCode: string;
  startDateTime: string;
  endDateTime: string;
  origin: string;
  destination: string;
  terminal: string;
  address: string;
  cost: string;
  currency: "" | "USD" | "JPY" | "KRW";
  leaveBy: string;
  notes: string;
  sourceUrl: string;
};

type GuideDraft = {
  kind: "airport" | "station" | "transport" | "packing" | "budget";
  title: string;
  summary: string;
  details: string;
  leaveBy: string;
  linkedDate: string;
};

type ChecklistDraft = {
  category: string;
  label: string;
  notes: string;
  status: "todo" | "done";
  estimatedCost: string;
  currency: "" | "USD" | "JPY" | "KRW";
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "calendar", label: "Calendar" },
  { id: "expenses", label: "Expenses" },
  { id: "budget", label: "Budget" },
  { id: "bookings", label: "Bookings" },
  { id: "guidance", label: "Guidance / Steps" },
  { id: "checklist", label: "Checklist" },
];

function emptyExpenseDraft(): ExpenseDraft {
  return {
    name: "",
    amount: "",
    currency: "USD",
    division: "misc",
    tags: "",
    notes: "",
    date: "2026-06-09",
    status: "planned",
    sourceUrl: "",
  };
}

function emptyActivityDraft(firstTripDayId = ""): ActivityDraft {
  return {
    tripDayId: firstTripDayId,
    timeLabel: "",
    title: "",
    description: "",
    category: "Activity",
    division: "activities",
    tags: "",
    estimatedCost: "",
    actualCost: "",
    currency: "",
    sourceUrl: "",
    bookingNeeded: false,
    priority: "2",
  };
}

function emptyBookingDraft(): BookingDraft {
  return {
    kind: "transfer",
    title: "",
    provider: "",
    confirmationCode: "",
    startDateTime: "",
    endDateTime: "",
    origin: "",
    destination: "",
    terminal: "",
    address: "",
    cost: "",
    currency: "",
    leaveBy: "",
    notes: "",
    sourceUrl: "",
  };
}

function emptyGuideDraft(): GuideDraft {
  return {
    kind: "transport",
    title: "",
    summary: "",
    details: "",
    leaveBy: "",
    linkedDate: "",
  };
}

function emptyChecklistDraft(): ChecklistDraft {
  return {
    category: "prep",
    label: "",
    notes: "",
    status: "todo",
    estimatedCost: "",
    currency: "",
  };
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumberOrZero(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function mutateData(
  method: "POST" | "PUT" | "DELETE",
  payload: Record<string, unknown>,
): Promise<TripAppData> {
  const response = await fetch("/api/records", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TripAppData | { error: string };
  if (!response.ok) {
    throw new Error("error" in data ? data.error : "Request failed.");
  }
  return data as TripAppData;
}

async function resetData(): Promise<TripAppData> {
  const response = await fetch("/api/init", { method: "POST" });
  const data = (await response.json()) as TripAppData | { error: string };
  if (!response.ok) {
    throw new Error("error" in data ? data.error : "Reset failed.");
  }
  return data as TripAppData;
}

export function TripCompanionApp({
  initialData,
}: {
  initialData: TripAppData;
}) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(emptyExpenseDraft);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [activityDraft, setActivityDraft] = useState<ActivityDraft>(
    emptyActivityDraft(data.tripDays[0]?.id ?? ""),
  );
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(emptyBookingDraft);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  const [guideDraft, setGuideDraft] = useState<GuideDraft>(emptyGuideDraft);
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null);

  const [checklistDraft, setChecklistDraft] = useState<ChecklistDraft>(
    emptyChecklistDraft,
  );
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);

  const [calendarCity, setCalendarCity] = useState("All");
  const [calendarTag, setCalendarTag] = useState("All");
  const [calendarSearch, setCalendarSearch] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseDivision, setExpenseDivision] = useState("All");
  const [expenseStatus, setExpenseStatus] = useState("All");
  const [expenseSort, setExpenseSort] = useState<"date" | "amount" | "division">(
    "date",
  );
  const deferredCalendarSearch = useDeferredValue(calendarSearch);
  const deferredExpenseSearch = useDeferredValue(expenseSearch);

  const divisions = Array.from(
    new Set([
      ...data.expenses.map((item) => item.division),
      ...data.activities.map((item) => item.division),
    ]),
  ).sort();

  const availableTags = Array.from(
    new Set(data.activities.flatMap((activity) => activity.tags)),
  ).sort();

  const availableCities = Array.from(
    new Set(data.tripDays.map((day) => day.city)),
  ).sort();

  const dayLookup = new Map(data.tripDays.map((day) => [day.id, day]));

  const filteredDays = data.tripDays
      .map((day) => ({
        day,
        activities: data.activities.filter((activity) => {
          if (activity.tripDayId !== day.id) return false;
          if (calendarCity !== "All" && activity.city !== calendarCity) return false;
          if (
            calendarTag !== "All" &&
            !activity.tags.some((tag) => tag === calendarTag)
          ) {
            return false;
          }
          const haystack = `${activity.title} ${activity.description}`.toLowerCase();
          if (
            deferredCalendarSearch &&
            !haystack.includes(deferredCalendarSearch.toLowerCase())
          ) {
            return false;
          }
          return true;
        }),
      }))
      .filter((entry) => entry.activities.length > 0 || calendarCity === "All");
  const filteredExpenses = data.expenses
    .filter((expense) => {
      if (expenseDivision !== "All" && expense.division !== expenseDivision) {
        return false;
      }
      if (expenseStatus !== "All" && expense.status !== expenseStatus) {
        return false;
      }
      const haystack = `${expense.name} ${expense.notes} ${expense.tags.join(" ")}`.toLowerCase();
      if (
        deferredExpenseSearch &&
        !haystack.includes(deferredExpenseSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      if (expenseSort === "amount") return right.usdAmount - left.usdAmount;
      if (expenseSort === "division") return left.division.localeCompare(right.division);
      return left.date.localeCompare(right.date);
    });

  const paidTotal = sumMoney(
    data.expenses
      .filter((expense) => expense.status === "paid")
      .map((expense) => expense.usdAmount),
  );
  const bookedTotal = sumMoney(
    data.expenses
      .filter((expense) => expense.status === "booked")
      .map((expense) => expense.usdAmount),
  );
  const plannedTotal = sumMoney(
    data.expenses
      .filter((expense) => expense.status === "planned")
      .map((expense) => expense.usdAmount),
  );
  const activityEstimateTotal = sumMoney(
    data.activities.map((activity) => activity.usdEstimatedCost),
  );

  const budgetRows = divisions.map((division) => {
      const expenses = data.expenses.filter((item) => item.division === division);
      const activities = data.activities.filter((item) => item.division === division);
      return {
        division,
        paid: sumMoney(
          expenses
            .filter((item) => item.status === "paid")
            .map((item) => item.usdAmount),
        ),
        booked: sumMoney(
          expenses
            .filter((item) => item.status === "booked")
            .map((item) => item.usdAmount),
        ),
        planned: sumMoney(
          expenses
            .filter((item) => item.status === "planned")
            .map((item) => item.usdAmount),
        ),
        activityPlanned: sumMoney(
          activities.map((item) => item.usdEstimatedCost),
        ),
      };
    });

  const upcomingBookings = data.bookings
    .filter((booking) => booking.startDateTime.slice(0, 10) >= todayKey())
    .slice(0, 4);

  const nextTripDay = data.tripDays.find((day) => day.date >= todayKey()) ?? data.tripDays[0];

  const urgentActivities = data.activities
    .filter((activity) => activity.bookingNeeded || activity.priority >= 4)
    .slice(0, 6);

  function runMutation(
    work: () => Promise<TripAppData>,
    successMessage: string,
    resetForm?: () => void,
  ) {
    setErrorMessage("");
    setStatusMessage("");
    startTransition(async () => {
      try {
        const nextData = await work();
        setData(nextData);
        setStatusMessage(successMessage);
        resetForm?.();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function handleExpenseSubmit() {
    const payload = {
      name: expenseDraft.name,
      amount: toNumberOrZero(expenseDraft.amount),
      currency: expenseDraft.currency,
      usdAmount: toNumberOrZero(expenseDraft.amount),
      division: expenseDraft.division,
      tags: expenseDraft.tags,
      notes: expenseDraft.notes,
      date: expenseDraft.date,
      status: expenseDraft.status,
      sourceType: "manual",
      sourceUrl: expenseDraft.sourceUrl || null,
    };

    runMutation(
      () =>
        editingExpenseId
          ? mutateData("PUT", {
              entity: "expenses",
              id: editingExpenseId,
              record: payload,
            })
          : mutateData("POST", { entity: "expenses", record: payload }),
      editingExpenseId ? "Expense updated." : "Expense added.",
      () => {
        setExpenseDraft(emptyExpenseDraft());
        setEditingExpenseId(null);
      },
    );
  }

  function handleActivitySubmit() {
    const selectedDay = dayLookup.get(activityDraft.tripDayId);
    if (!selectedDay) {
      setErrorMessage("Choose a trip day before saving an activity.");
      return;
    }

    const payload = {
      tripDayId: selectedDay.id,
      date: selectedDay.date,
      city: selectedDay.city,
      timeLabel: activityDraft.timeLabel,
      title: activityDraft.title,
      description: activityDraft.description,
      category: activityDraft.category,
      division: activityDraft.division,
      tags: activityDraft.tags,
      estimatedCost: toNumberOrNull(activityDraft.estimatedCost),
      actualCost: toNumberOrNull(activityDraft.actualCost),
      currency: activityDraft.currency || null,
      usdEstimatedCost: toNumberOrNull(activityDraft.estimatedCost),
      usdActualCost: toNumberOrNull(activityDraft.actualCost),
      sourceType: "manual",
      sourceUrl: activityDraft.sourceUrl || null,
      bookingNeeded: activityDraft.bookingNeeded,
      priority: Number(activityDraft.priority || "2"),
    };

    runMutation(
      () =>
        editingActivityId
          ? mutateData("PUT", {
              entity: "activities",
              id: editingActivityId,
              record: payload,
            })
          : mutateData("POST", { entity: "activities", record: payload }),
      editingActivityId ? "Activity updated." : "Activity added.",
      () => {
        setActivityDraft(emptyActivityDraft(data.tripDays[0]?.id ?? ""));
        setEditingActivityId(null);
      },
    );
  }

  function handleBookingSubmit() {
    const payload = {
      ...bookingDraft,
      cost: toNumberOrNull(bookingDraft.cost),
      currency: bookingDraft.currency || null,
      usdCost: toNumberOrNull(bookingDraft.cost),
      sourceType: "manual",
      sourceUrl: bookingDraft.sourceUrl || null,
    };

    runMutation(
      () =>
        editingBookingId
          ? mutateData("PUT", {
              entity: "bookings",
              id: editingBookingId,
              record: payload,
            })
          : mutateData("POST", { entity: "bookings", record: payload }),
      editingBookingId ? "Booking updated." : "Booking added.",
      () => {
        setBookingDraft(emptyBookingDraft());
        setEditingBookingId(null);
      },
    );
  }

  function handleGuideSubmit() {
    runMutation(
      () =>
        editingGuideId
          ? mutateData("PUT", {
              entity: "guides",
              id: editingGuideId,
              record: { ...guideDraft, sourceType: "manual" },
            })
          : mutateData("POST", {
              entity: "guides",
              record: { ...guideDraft, sourceType: "manual" },
            }),
      editingGuideId ? "Guide updated." : "Guide added.",
      () => {
        setGuideDraft(emptyGuideDraft());
        setEditingGuideId(null);
      },
    );
  }

  function handleChecklistSubmit() {
    const payload = {
      ...checklistDraft,
      estimatedCost: toNumberOrNull(checklistDraft.estimatedCost),
      currency: checklistDraft.currency || null,
      usdEstimatedCost: toNumberOrNull(checklistDraft.estimatedCost),
    };

    runMutation(
      () =>
        editingChecklistId
          ? mutateData("PUT", {
              entity: "checklist",
              id: editingChecklistId,
              record: payload,
            })
          : mutateData("POST", { entity: "checklist", record: payload }),
      editingChecklistId ? "Checklist item updated." : "Checklist item added.",
      () => {
        setChecklistDraft(emptyChecklistDraft());
        setEditingChecklistId(null);
      },
    );
  }

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="eyebrow">June 15 to July 13, 2026 · Japan + Korea</p>
          <h1>Trip Companion</h1>
          <p className="hero-sub">
            A shared planning and spending dashboard for Tokyo, Kyoto, Osaka,
            Seoul, and Busan.
          </p>
          <div className="hero-chips">
            <span>29 days</span>
            <span>Public edits</span>
            <span>{data.persistenceMode === "database" ? "Neon live sync" : "Seed-only mode"}</span>
            <span>USD-first budgeting</span>
          </div>
        </div>
      </header>

      <div className="status-bar">
        <div>
          {data.persistenceMode === "database" ? (
            <span className="status-pill ok">Shared persistence enabled</span>
          ) : (
            <span className="status-pill warn">
              DATABASE_URL missing: app is rendering seed data only
            </span>
          )}
        </div>
        <div className="status-actions">
          {data.persistenceMode === "database" ? (
            <button
              className="ghost-button"
              onClick={() => runMutation(() => resetData(), "Database reset from seed.")}
              disabled={isPending}
              type="button"
            >
              Re-seed from notes
            </button>
          ) : null}
        </div>
      </div>

      {statusMessage ? <div className="toast success">{statusMessage}</div> : null}
      {errorMessage ? <div className="toast error">{errorMessage}</div> : null}

      <nav className="tab-bar" aria-label="Trip sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {activeTab === "dashboard" ? (
          <section className="stack">
            <div className="metric-grid">
              <MetricCard label="Spent" value={formatMoney(paidTotal, "USD")} hint="Paid expenses only" />
              <MetricCard label="Booked" value={formatMoney(bookedTotal, "USD")} hint="Booked but not marked paid" />
              <MetricCard label="Planned" value={formatMoney(plannedTotal, "USD")} hint="Planned manual expenses" />
              <MetricCard
                label="Activity Estimates"
                value={formatMoney(activityEstimateTotal, "USD")}
                hint="Estimated from itinerary items"
              />
            </div>

            <div className="two-up">
              <Panel title="Next Up" subtitle="What matters next">
                <div className="list">
                  <ListRow
                    label="Next trip day"
                    value={nextTripDay ? `${nextTripDay.date} · ${nextTripDay.title}` : "No day found"}
                  />
                  {upcomingBookings.map((booking) => (
                    <ListRow
                      key={booking.id}
                      label={booking.kind}
                      value={`${booking.title} · ${booking.startDateTime.slice(0, 16).replace("T", " ")}`}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Urgent / High Priority" subtitle="Bookings and critical moments">
                <div className="list">
                  {urgentActivities.map((activity) => (
                    <ListRow
                      key={activity.id}
                      label={activity.city}
                      value={`${activity.date} · ${activity.timeLabel} · ${activity.title}`}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            <Panel title="Budget Snapshot" subtitle="By division">
              <div className="budget-list">
                {budgetRows.map((row) => (
                  <div key={row.division} className="budget-row">
                    <div>
                      <strong>{row.division}</strong>
                      <p>
                        Paid {formatMoney(row.paid, "USD")} · Booked{" "}
                        {formatMoney(row.booked, "USD")} · Planned{" "}
                        {formatMoney(row.planned, "USD")}
                      </p>
                    </div>
                    <span className="budget-chip">
                      Activities {formatMoney(row.activityPlanned, "USD")}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "calendar" ? (
          <section className="stack">
            <Panel title="Activity Editor" subtitle="Add or update itinerary items and their costs">
              <div className="form-grid">
                <label>
                  Trip day
                  <select
                    value={activityDraft.tripDayId}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        tripDayId: event.target.value,
                      }))
                    }
                  >
                    {data.tripDays.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.date} · {day.city} · {day.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Time label
                  <input
                    value={activityDraft.timeLabel}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        timeLabel: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Title
                  <input
                    value={activityDraft.title}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Category
                  <input
                    value={activityDraft.category}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Division
                  <input
                    value={activityDraft.division}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        division: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Tags
                  <input
                    value={activityDraft.tags}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        tags: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Estimated cost
                  <input
                    value={activityDraft.estimatedCost}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        estimatedCost: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Actual cost
                  <input
                    value={activityDraft.actualCost}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        actualCost: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Currency
                  <select
                    value={activityDraft.currency}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        currency: event.target.value as ActivityDraft["currency"],
                      }))
                    }
                  >
                    <option value="">None</option>
                    <option value="USD">USD</option>
                    <option value="JPY">JPY</option>
                    <option value="KRW">KRW</option>
                  </select>
                </label>
                <label>
                  Priority
                  <input
                    value={activityDraft.priority}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="full">
                  Description
                  <textarea
                    rows={4}
                    value={activityDraft.description}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="full inline-check">
                  <input
                    type="checkbox"
                    checked={activityDraft.bookingNeeded}
                    onChange={(event) =>
                      setActivityDraft((current) => ({
                        ...current,
                        bookingNeeded: event.target.checked,
                      }))
                    }
                  />
                  Booking required
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-button" onClick={handleActivitySubmit} type="button">
                  {editingActivityId ? "Update activity" : "Add activity"}
                </button>
                <button
                  className="ghost-button"
                  onClick={() => {
                    setActivityDraft(emptyActivityDraft(data.tripDays[0]?.id ?? ""));
                    setEditingActivityId(null);
                  }}
                  type="button"
                >
                  Clear
                </button>
              </div>
            </Panel>

            <Panel title="Filters" subtitle="Narrow the itinerary">
              <div className="filters">
                <label>
                  City
                  <select value={calendarCity} onChange={(event) => setCalendarCity(event.target.value)}>
                    <option>All</option>
                    {availableCities.map((city) => (
                      <option key={city}>{city}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tag
                  <select value={calendarTag} onChange={(event) => setCalendarTag(event.target.value)}>
                    <option>All</option>
                    {availableTags.map((tag) => (
                      <option key={tag}>{tag}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Search
                  <input value={calendarSearch} onChange={(event) => setCalendarSearch(event.target.value)} />
                </label>
              </div>
            </Panel>

            {filteredDays.map(({ day, activities }) => {
              const dayTotal = sumMoney(activities.map((activity) => getActivityCost(activity)));
              return (
                <Panel
                  key={day.id}
                  title={`${day.date} · ${day.city} · ${day.title}`}
                  subtitle={`${day.subtitle} · ${day.hotel}`}
                >
                  <div className="day-total">
                    Day activity total: <strong>{formatMoney(dayTotal, "USD")}</strong>
                  </div>
                  <div className="activity-list">
                    {activities.map((activity) => {
                      const money = formatUsdWithLocal(
                        activity.usdActualCost ?? activity.usdEstimatedCost,
                        activity.actualCost ?? activity.estimatedCost,
                        activity.currency,
                      );
                      return (
                        <article key={activity.id} className="activity-card">
                          <div className="activity-top">
                            <div>
                              <p className="activity-time">{activity.timeLabel}</p>
                              <h3>{activity.title}</h3>
                            </div>
                            <div className="activity-actions">
                              <span className="money-chip" title={money.title}>
                                {money.label}
                              </span>
                              <button
                                className="small-button"
                                type="button"
                                onClick={() => {
                                  setEditingActivityId(activity.id);
                                  setActivityDraft({
                                    tripDayId: activity.tripDayId,
                                    timeLabel: activity.timeLabel,
                                    title: activity.title,
                                    description: activity.description,
                                    category: activity.category,
                                    division: activity.division,
                                    tags: activity.tags.join(", "),
                                    estimatedCost:
                                      activity.estimatedCost?.toString() ?? "",
                                    actualCost: activity.actualCost?.toString() ?? "",
                                    currency: activity.currency ?? "",
                                    sourceUrl: activity.sourceUrl ?? "",
                                    bookingNeeded: activity.bookingNeeded,
                                    priority: String(activity.priority),
                                  });
                                  setActiveTab("calendar");
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="small-button danger"
                                type="button"
                                onClick={() =>
                                  runMutation(
                                    () =>
                                      mutateData("DELETE", {
                                        entity: "activities",
                                        id: activity.id,
                                        record: {},
                                      }),
                                    "Activity deleted.",
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <p>{activity.description}</p>
                          <div className="tag-row">
                            {activity.tags.map((tag) => (
                              <span key={`${activity.id}-${tag}`} className="tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </Panel>
              );
            })}
          </section>
        ) : null}

        {activeTab === "expenses" ? (
          <section className="stack">
            <Panel title="Expense Ledger" subtitle="Track live spend, planned costs, and edits">
              <div className="form-grid">
                <label>
                  Name
                  <input
                    value={expenseDraft.name}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Amount
                  <input
                    value={expenseDraft.amount}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Currency
                  <select
                    value={expenseDraft.currency}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        currency: event.target.value as ExpenseDraft["currency"],
                      }))
                    }
                  >
                    <option value="USD">USD</option>
                    <option value="JPY">JPY</option>
                    <option value="KRW">KRW</option>
                  </select>
                </label>
                <label>
                  Division
                  <input
                    value={expenseDraft.division}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        division: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={expenseDraft.date}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Status
                  <select
                    value={expenseDraft.status}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        status: event.target.value as ExpenseDraft["status"],
                      }))
                    }
                  >
                    <option value="planned">planned</option>
                    <option value="booked">booked</option>
                    <option value="paid">paid</option>
                  </select>
                </label>
                <label className="full">
                  Tags
                  <input
                    value={expenseDraft.tags}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        tags: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="full">
                  Notes
                  <textarea
                    rows={3}
                    value={expenseDraft.notes}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-button" onClick={handleExpenseSubmit} type="button">
                  {editingExpenseId ? "Update expense" : "Add expense"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setExpenseDraft(emptyExpenseDraft());
                    setEditingExpenseId(null);
                  }}
                >
                  Clear
                </button>
              </div>
            </Panel>

            <Panel title="Filters & Sorting" subtitle="Search and sort the ledger">
              <div className="filters">
                <label>
                  Search
                  <input value={expenseSearch} onChange={(event) => setExpenseSearch(event.target.value)} />
                </label>
                <label>
                  Division
                  <select value={expenseDivision} onChange={(event) => setExpenseDivision(event.target.value)}>
                    <option>All</option>
                    {divisions.map((division) => (
                      <option key={division}>{division}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select value={expenseStatus} onChange={(event) => setExpenseStatus(event.target.value)}>
                    <option>All</option>
                    <option>planned</option>
                    <option>booked</option>
                    <option>paid</option>
                  </select>
                </label>
                <label>
                  Sort
                  <select value={expenseSort} onChange={(event) => setExpenseSort(event.target.value as typeof expenseSort)}>
                    <option value="date">date</option>
                    <option value="amount">amount</option>
                    <option value="division">division</option>
                  </select>
                </label>
              </div>
            </Panel>

            <Panel title="Expense Table" subtitle="USD primary, local values on hover">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Date</th>
                      <th>Division</th>
                      <th>Status</th>
                      <th>USD</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense) => {
                      const money = formatUsdWithLocal(
                        expense.usdAmount,
                        expense.amount,
                        expense.currency,
                      );
                      return (
                        <tr key={expense.id}>
                          <td>
                            <strong>{expense.name}</strong>
                            <div className="table-sub">{expense.tags.join(", ")}</div>
                          </td>
                          <td>{expense.date}</td>
                          <td>{expense.division}</td>
                          <td>{expense.status}</td>
                          <td title={money.title}>{money.label}</td>
                          <td className="actions-cell">
                            <button
                              className="small-button"
                              type="button"
                              onClick={() => {
                                setEditingExpenseId(expense.id);
                                setExpenseDraft({
                                  name: expense.name,
                                  amount: String(expense.amount),
                                  currency: expense.currency,
                                  division: expense.division,
                                  tags: expense.tags.join(", "),
                                  notes: expense.notes,
                                  date: expense.date,
                                  status: expense.status,
                                  sourceUrl: expense.sourceUrl ?? "",
                                });
                                setActiveTab("expenses");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="small-button danger"
                              type="button"
                              onClick={() =>
                                runMutation(
                                  () =>
                                    mutateData("DELETE", {
                                      entity: "expenses",
                                      id: expense.id,
                                      record: {},
                                    }),
                                  "Expense deleted.",
                                )
                              }
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "budget" ? (
          <section className="stack">
            <Panel title="Budget by Division" subtitle="Personal-spend model only">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Division</th>
                      <th>Paid</th>
                      <th>Booked</th>
                      <th>Planned</th>
                      <th>Activity Estimates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetRows.map((row) => (
                      <tr key={row.division}>
                        <td>{row.division}</td>
                        <td>{formatMoney(row.paid, "USD")}</td>
                        <td>{formatMoney(row.booked, "USD")}</td>
                        <td>{formatMoney(row.planned, "USD")}</td>
                        <td>{formatMoney(row.activityPlanned, "USD")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "bookings" ? (
          <section className="stack">
            <Panel title="Booking Editor" subtitle="Flights, hotels, trains, baggage, and transfers">
              <div className="form-grid">
                <label>
                  Kind
                  <select
                    value={bookingDraft.kind}
                    onChange={(event) =>
                      setBookingDraft((current) => ({
                        ...current,
                        kind: event.target.value as BookingDraft["kind"],
                      }))
                    }
                  >
                    <option value="flight">flight</option>
                    <option value="hotel">hotel</option>
                    <option value="train">train</option>
                    <option value="baggage">baggage</option>
                    <option value="transfer">transfer</option>
                  </select>
                </label>
                <label>
                  Title
                  <input value={bookingDraft.title} onChange={(event) => setBookingDraft((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>
                  Provider
                  <input value={bookingDraft.provider} onChange={(event) => setBookingDraft((current) => ({ ...current, provider: event.target.value }))} />
                </label>
                <label>
                  Confirmation
                  <input value={bookingDraft.confirmationCode} onChange={(event) => setBookingDraft((current) => ({ ...current, confirmationCode: event.target.value }))} />
                </label>
                <label>
                  Start
                  <input type="datetime-local" value={bookingDraft.startDateTime} onChange={(event) => setBookingDraft((current) => ({ ...current, startDateTime: event.target.value }))} />
                </label>
                <label>
                  End
                  <input type="datetime-local" value={bookingDraft.endDateTime} onChange={(event) => setBookingDraft((current) => ({ ...current, endDateTime: event.target.value }))} />
                </label>
                <label>
                  Origin
                  <input value={bookingDraft.origin} onChange={(event) => setBookingDraft((current) => ({ ...current, origin: event.target.value }))} />
                </label>
                <label>
                  Destination
                  <input value={bookingDraft.destination} onChange={(event) => setBookingDraft((current) => ({ ...current, destination: event.target.value }))} />
                </label>
                <label>
                  Cost
                  <input value={bookingDraft.cost} onChange={(event) => setBookingDraft((current) => ({ ...current, cost: event.target.value }))} />
                </label>
                <label>
                  Currency
                  <select value={bookingDraft.currency} onChange={(event) => setBookingDraft((current) => ({ ...current, currency: event.target.value as BookingDraft["currency"] }))}>
                    <option value="">None</option>
                    <option value="USD">USD</option>
                    <option value="JPY">JPY</option>
                    <option value="KRW">KRW</option>
                  </select>
                </label>
                <label className="full">
                  Leave by
                  <input value={bookingDraft.leaveBy} onChange={(event) => setBookingDraft((current) => ({ ...current, leaveBy: event.target.value }))} />
                </label>
                <label className="full">
                  Notes
                  <textarea rows={3} value={bookingDraft.notes} onChange={(event) => setBookingDraft((current) => ({ ...current, notes: event.target.value }))} />
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-button" onClick={handleBookingSubmit} type="button">
                  {editingBookingId ? "Update booking" : "Add booking"}
                </button>
                <button className="ghost-button" type="button" onClick={() => { setBookingDraft(emptyBookingDraft()); setEditingBookingId(null); }}>
                  Clear
                </button>
              </div>
            </Panel>

            <div className="card-grid">
              {data.bookings.map((booking) => {
                const money = formatUsdWithLocal(
                  booking.usdCost,
                  booking.cost,
                  booking.currency,
                );
                return (
                  <Panel
                    key={booking.id}
                    title={booking.title}
                    subtitle={`${booking.kind} · ${booking.provider}`}
                  >
                    <div className="list">
                      <ListRow label="Window" value={`${booking.startDateTime} → ${booking.endDateTime}`} />
                      <ListRow label="Route" value={`${booking.origin} → ${booking.destination}`} />
                      <ListRow label="Leave by" value={booking.leaveBy || "Not set"} />
                      <ListRow label="Cost" value={money.label} title={money.title} />
                      <ListRow label="Notes" value={booking.notes} />
                    </div>
                    <div className="panel-actions">
                      <button
                        className="small-button"
                        type="button"
                        onClick={() => {
                          setEditingBookingId(booking.id);
                          setBookingDraft({
                            kind: booking.kind,
                            title: booking.title,
                            provider: booking.provider,
                            confirmationCode: booking.confirmationCode,
                            startDateTime: booking.startDateTime.slice(0, 16),
                            endDateTime: booking.endDateTime.slice(0, 16),
                            origin: booking.origin,
                            destination: booking.destination,
                            terminal: booking.terminal,
                            address: booking.address,
                            cost: booking.cost?.toString() ?? "",
                            currency: booking.currency ?? "",
                            leaveBy: booking.leaveBy,
                            notes: booking.notes,
                            sourceUrl: booking.sourceUrl ?? "",
                          });
                          setActiveTab("bookings");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="small-button danger"
                        type="button"
                        onClick={() =>
                          runMutation(
                            () =>
                              mutateData("DELETE", {
                                entity: "bookings",
                                id: booking.id,
                                record: {},
                              }),
                            "Booking deleted.",
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeTab === "guidance" ? (
          <section className="stack">
            <Panel title="Guidance Editor" subtitle="Station routes, airport timing, and travel notes">
              <div className="form-grid">
                <label>
                  Kind
                  <select value={guideDraft.kind} onChange={(event) => setGuideDraft((current) => ({ ...current, kind: event.target.value as GuideDraft["kind"] }))}>
                    <option value="airport">airport</option>
                    <option value="station">station</option>
                    <option value="transport">transport</option>
                    <option value="packing">packing</option>
                    <option value="budget">budget</option>
                  </select>
                </label>
                <label>
                  Linked date
                  <input type="date" value={guideDraft.linkedDate} onChange={(event) => setGuideDraft((current) => ({ ...current, linkedDate: event.target.value }))} />
                </label>
                <label className="full">
                  Title
                  <input value={guideDraft.title} onChange={(event) => setGuideDraft((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label className="full">
                  Summary
                  <input value={guideDraft.summary} onChange={(event) => setGuideDraft((current) => ({ ...current, summary: event.target.value }))} />
                </label>
                <label className="full">
                  Leave by
                  <input value={guideDraft.leaveBy} onChange={(event) => setGuideDraft((current) => ({ ...current, leaveBy: event.target.value }))} />
                </label>
                <label className="full">
                  Details
                  <textarea rows={4} value={guideDraft.details} onChange={(event) => setGuideDraft((current) => ({ ...current, details: event.target.value }))} />
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-button" onClick={handleGuideSubmit} type="button">
                  {editingGuideId ? "Update guide" : "Add guide"}
                </button>
                <button className="ghost-button" type="button" onClick={() => { setGuideDraft(emptyGuideDraft()); setEditingGuideId(null); }}>
                  Clear
                </button>
              </div>
            </Panel>

            <div className="card-grid">
              {data.guides.map((guide) => (
                <Panel
                  key={guide.id}
                  title={guide.title}
                  subtitle={`${guide.kind} · ${guide.linkedDate || "Any day"}`}
                >
                  <p className="guide-summary">{guide.summary}</p>
                  <p>{guide.details}</p>
                  {guide.leaveBy ? <p className="guide-leave">Leave by: {guide.leaveBy}</p> : null}
                  <div className="panel-actions">
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => {
                        setEditingGuideId(guide.id);
                        setGuideDraft({
                          kind: guide.kind,
                          title: guide.title,
                          summary: guide.summary,
                          details: guide.details,
                          leaveBy: guide.leaveBy,
                          linkedDate: guide.linkedDate,
                        });
                        setActiveTab("guidance");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="small-button danger"
                      type="button"
                      onClick={() =>
                        runMutation(
                          () =>
                            mutateData("DELETE", {
                              entity: "guides",
                              id: guide.id,
                              record: {},
                            }),
                          "Guide deleted.",
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "checklist" ? (
          <section className="stack">
            <Panel title="Checklist Editor" subtitle="Prep items, notes, and cost estimates">
              <div className="form-grid">
                <label>
                  Category
                  <input value={checklistDraft.category} onChange={(event) => setChecklistDraft((current) => ({ ...current, category: event.target.value }))} />
                </label>
                <label>
                  Status
                  <select value={checklistDraft.status} onChange={(event) => setChecklistDraft((current) => ({ ...current, status: event.target.value as ChecklistDraft["status"] }))}>
                    <option value="todo">todo</option>
                    <option value="done">done</option>
                  </select>
                </label>
                <label className="full">
                  Label
                  <input value={checklistDraft.label} onChange={(event) => setChecklistDraft((current) => ({ ...current, label: event.target.value }))} />
                </label>
                <label className="full">
                  Notes
                  <textarea rows={3} value={checklistDraft.notes} onChange={(event) => setChecklistDraft((current) => ({ ...current, notes: event.target.value }))} />
                </label>
                <label>
                  Estimated cost
                  <input value={checklistDraft.estimatedCost} onChange={(event) => setChecklistDraft((current) => ({ ...current, estimatedCost: event.target.value }))} />
                </label>
                <label>
                  Currency
                  <select value={checklistDraft.currency} onChange={(event) => setChecklistDraft((current) => ({ ...current, currency: event.target.value as ChecklistDraft["currency"] }))}>
                    <option value="">None</option>
                    <option value="USD">USD</option>
                    <option value="JPY">JPY</option>
                    <option value="KRW">KRW</option>
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-button" onClick={handleChecklistSubmit} type="button">
                  {editingChecklistId ? "Update checklist item" : "Add checklist item"}
                </button>
                <button className="ghost-button" type="button" onClick={() => { setChecklistDraft(emptyChecklistDraft()); setEditingChecklistId(null); }}>
                  Clear
                </button>
              </div>
            </Panel>

            <div className="card-grid">
              {data.checklist.map((item) => {
                const money = formatUsdWithLocal(
                  item.usdEstimatedCost,
                  item.estimatedCost,
                  item.currency,
                );
                return (
                  <Panel key={item.id} title={item.label} subtitle={`${item.category} · ${item.status}`}>
                    <p>{item.notes}</p>
                    {item.estimatedCost !== null ? (
                      <p className="guide-leave" title={money.title}>
                        Est. cost: {money.label}
                      </p>
                    ) : null}
                    <div className="panel-actions">
                      <button
                        className="small-button"
                        type="button"
                        onClick={() => {
                          setEditingChecklistId(item.id);
                          setChecklistDraft({
                            category: item.category,
                            label: item.label,
                            notes: item.notes,
                            status: item.status,
                            estimatedCost: item.estimatedCost?.toString() ?? "",
                            currency: item.currency ?? "",
                          });
                          setActiveTab("checklist");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="small-button danger"
                        type="button"
                        onClick={() =>
                          runMutation(
                            () =>
                              mutateData("DELETE", {
                                entity: "checklist",
                                id: item.id,
                                record: {},
                              }),
                            "Checklist item deleted.",
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ListRow({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="list-row" title={title}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
