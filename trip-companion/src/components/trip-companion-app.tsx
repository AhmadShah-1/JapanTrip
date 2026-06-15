"use client";

import Link from "next/link";
import { useDeferredValue, useState, useTransition } from "react";

import type { TripAppData } from "@/lib/trip-types";
import {
  cleanText,
  formatMoney,
  formatUsdWithLocal,
  getActivityCost,
  sumMoney,
  toSearchText,
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
  { id: "dashboard", label: "Overview" },
  { id: "calendar", label: "Calendar" },
  { id: "expenses", label: "Expenses" },
  { id: "budget", label: "Budget" },
  { id: "bookings", label: "Bookings" },
  { id: "guidance", label: "Guidance" },
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
  const [expenseEditorOpen, setExpenseEditorOpen] = useState(false);

  const [activityDraft, setActivityDraft] = useState<ActivityDraft>(
    emptyActivityDraft(data.tripDays[0]?.id ?? ""),
  );
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityEditorOpen, setActivityEditorOpen] = useState(false);

  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(emptyBookingDraft);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [bookingEditorOpen, setBookingEditorOpen] = useState(false);

  const [guideDraft, setGuideDraft] = useState<GuideDraft>(emptyGuideDraft);
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null);
  const [guideEditorOpen, setGuideEditorOpen] = useState(false);

  const [checklistDraft, setChecklistDraft] = useState<ChecklistDraft>(
    emptyChecklistDraft,
  );
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [checklistEditorOpen, setChecklistEditorOpen] = useState(false);

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
    new Set(
      data.activities.flatMap((activity) =>
        activity.tags.map((tag) => cleanText(tag)),
      ),
    ),
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
          !activity.tags.some(
            (tag) => toSearchText(tag) === toSearchText(calendarTag),
          )
        ) {
          return false;
        }
        const haystack = toSearchText(
          [
            activity.title,
            activity.description,
            activity.city,
            activity.category,
            activity.division,
            activity.tags.join(" "),
            day.title,
            day.subtitle,
          ].join(" "),
        );
        if (
          deferredCalendarSearch &&
          !haystack.includes(toSearchText(deferredCalendarSearch))
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
      const haystack = toSearchText(
        [
          expense.name,
          expense.notes,
          expense.tags.join(" "),
          expense.division,
          expense.status,
          expense.date,
        ].join(" "),
      );
      if (
        deferredExpenseSearch &&
        !haystack.includes(toSearchText(deferredExpenseSearch))
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

  const expenseTypeTotals = divisions
    .map((division) => {
      const total = sumMoney(
        data.expenses
          .filter((item) => item.division === division)
          .map((item) => item.usdAmount),
      );
      return { division, total };
    })
    .filter((item) => item.total > 0)
    .sort((left, right) => right.total - left.total);

  const visibleExpenseTotal = sumMoney(filteredExpenses.map((expense) => expense.usdAmount));

  const upcomingBookings = data.bookings
    .filter((booking) => booking.startDateTime.slice(0, 10) >= todayKey())
    .slice(0, 8);

  const nextTripDay =
    data.tripDays.find((day) => day.date >= todayKey()) ?? data.tripDays[0];

  const urgentActivities = data.activities
    .filter((activity) => activity.bookingNeeded || activity.priority >= 4)
    .slice(0, 10);

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
        setErrorMessage(
          error instanceof Error ? error.message : "Something went wrong.",
        );
      }
    });
  }

  function confirmDangerousAction(message: string): boolean {
    return window.confirm(message);
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
        setExpenseEditorOpen(false);
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
        setActivityEditorOpen(false);
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
        setBookingEditorOpen(false);
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
        setGuideEditorOpen(false);
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
        setChecklistEditorOpen(false);
      },
    );
  }

  return (
    <div className="shell">
      <header className="sheet-header">
        <div>
          <p className="eyebrow">June 15 to July 13, 2026 | Japan + Korea</p>
          <h1>Trip Companion</h1>
        </div>
        <div className="header-actions">
          <Link href="/activity-view" className="ghost-button header-link-button">
            activitiy view
          </Link>
          <div className="header-meta">
            <span>{data.tripDays.length} days</span>
            <span>{data.activities.length} activities</span>
            <span>{data.expenses.length} expense rows</span>
            <span>{data.persistenceMode === "database" ? "live db" : "seed only"}</span>
          </div>
        </div>
      </header>

      <div className="status-bar">
        <div>
          {data.persistenceMode === "database" ? (
            <span className="status-pill ok">Shared persistence enabled</span>
          ) : (
            <span className="status-pill warn">
              DATABASE_URL missing or overridden; app is in seed-only mode
            </span>
          )}
        </div>
        {data.persistenceMode === "database" ? (
          <button
            className="ghost-button"
            onClick={() => {
              if (
                !confirmDangerousAction(
                  "Re-seed the database from the original notes? This will overwrite live edits.",
                )
              ) {
                return;
              }
              runMutation(() => resetData(), "Database reset from seed.");
            }}
            disabled={isPending}
            type="button"
          >
            Re-seed
          </button>
        ) : null}
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
              <MetricCard label="Spent" value={formatMoney(paidTotal, "USD")} hint="paid" />
              <MetricCard
                label="Booked"
                value={formatMoney(bookedTotal, "USD")}
                hint="booked"
              />
              <MetricCard
                label="Planned"
                value={formatMoney(plannedTotal, "USD")}
                hint="planned"
              />
              <MetricCard
                label="Activity Est."
                value={formatMoney(activityEstimateTotal, "USD")}
                hint="itinerary est."
              />
            </div>

            <div className="overview-grid">
              <Panel title="Next / Critical" subtitle="high-signal scan view">
                <CompactTable
                  headers={["Type", "When", "Item", "Value"]}
                  rows={[
                    ...(nextTripDay
                      ? [
                          [
                            "Day",
                            nextTripDay.date,
                            nextTripDay.title,
                            nextTripDay.city,
                          ],
                        ]
                      : []),
                    ...upcomingBookings.map((booking) => [
                      booking.kind,
                      booking.startDateTime.slice(0, 16).replace("T", " "),
                      booking.title,
                      formatMoney(booking.usdCost, "USD"),
                    ]),
                    ...urgentActivities.slice(0, 4).map((activity) => [
                      "Urgent",
                      `${activity.date} ${activity.timeLabel}`,
                      activity.title,
                      formatMoney(getActivityCost(activity), "USD"),
                    ]),
                  ]}
                />
              </Panel>

              <Panel title="Budget by Division" subtitle="all totals in one sheet">
                <CompactTable
                  headers={["Division", "Paid", "Booked", "Planned", "Activity"]}
                  rows={budgetRows.map((row) => [
                    row.division,
                    formatMoney(row.paid, "USD"),
                    formatMoney(row.booked, "USD"),
                    formatMoney(row.planned, "USD"),
                    formatMoney(row.activityPlanned, "USD"),
                  ])}
                />
              </Panel>
            </div>

            <div className="overview-grid">
              <Panel title="Purchase Types" subtitle="expense mix by division">
                <ExpensePieChart items={expenseTypeTotals} />
              </Panel>

              <Panel title="Totals Snapshot" subtitle="quick rollup">
                <CompactTable
                  headers={["Metric", "Value"]}
                  rows={[
                    ["All expenses", formatMoney(sumMoney(data.expenses.map((expense) => expense.usdAmount)), "USD")],
                    ["Visible expenses", formatMoney(visibleExpenseTotal, "USD")],
                    ["Paid expenses", formatMoney(paidTotal, "USD")],
                    ["Booked expenses", formatMoney(bookedTotal, "USD")],
                    ["Planned expenses", formatMoney(plannedTotal, "USD")],
                  ]}
                />
              </Panel>
            </div>
          </section>
        ) : null}

        {activeTab === "calendar" ? (
          <section className="stack">
            <div className="section-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setEditingActivityId(null);
                  setActivityDraft(emptyActivityDraft(data.tripDays[0]?.id ?? ""));
                  setActivityEditorOpen(true);
                }}
              >
                Add new activity
              </button>
            </div>
            <details
              className="editor-panel"
              open={activityEditorOpen}
              onToggle={(event) =>
                setActivityEditorOpen(event.currentTarget.open)
              }
            >
              <summary>Activity editor</summary>
              <div className="editor-body">
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
                          {day.date} | {day.city} | {day.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Time
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
                    Est. cost
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
                  <label className="full">
                    Notes
                    <textarea
                      rows={2}
                      value={activityDraft.description}
                      onChange={(event) =>
                        setActivityDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button className="primary-button" onClick={handleActivitySubmit} type="button">
                    {editingActivityId ? "Update" : "Add"}
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setActivityDraft(emptyActivityDraft(data.tripDays[0]?.id ?? ""));
                      setEditingActivityId(null);
                      setActivityEditorOpen(false);
                    }}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </details>

            <Panel title="Calendar Grid" subtitle="compact day rows; click for details">
              <div className="filters">
                <label>
                  City
                  <select
                    value={calendarCity}
                    onChange={(event) => setCalendarCity(event.target.value)}
                  >
                    <option>All</option>
                    {availableCities.map((city) => (
                      <option key={city}>{city}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tag
                  <select
                    value={calendarTag}
                    onChange={(event) => setCalendarTag(event.target.value)}
                  >
                    <option>All</option>
                    {availableTags.map((tag) => (
                      <option key={tag}>{tag}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Search
                  <input
                    value={calendarSearch}
                    onChange={(event) => setCalendarSearch(event.target.value)}
                  />
                </label>
              </div>

              <div className="table-wrap">
                <table className="dense-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>City</th>
                      <th>Day</th>
                      <th>Hotel</th>
                      <th>Items</th>
                      <th>Day Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDays.map(({ day, activities }) => {
                      const dayTotal = sumMoney(
                        activities.map((activity) => getActivityCost(activity)),
                      );
                      return (
                        <ExpandableRow
                          key={day.id}
                          columns={[
                            day.date,
                            day.city,
                            day.title,
                            day.hotel || "-",
                            String(activities.length),
                            formatMoney(dayTotal, "USD"),
                          ]}
                          expandedContent={
                            <div className="inner-table-wrap">
                              <table className="dense-table inner-table">
                                <thead>
                                  <tr>
                                    <th>Time</th>
                                    <th>Activity</th>
                                    <th>Category</th>
                                    <th>Tags</th>
                                    <th>Cost</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activities.map((activity) => {
                                    const money = formatUsdWithLocal(
                                      activity.usdActualCost ??
                                        activity.usdEstimatedCost,
                                      activity.actualCost ??
                                        activity.estimatedCost,
                                      activity.currency,
                                    );
                                    return (
                                      <tr key={activity.id}>
                                        <td>{activity.timeLabel}</td>
                                        <td title={activity.description}>
                                          {activity.title}
                                        </td>
                                        <td>{activity.category}</td>
                                        <td>{activity.tags.join(", ") || "-"}</td>
                                        <td title={money.title}>{money.label}</td>
                                        <td className="actions-cell">
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
                                                  activity.estimatedCost?.toString() ??
                                                  "",
                                                actualCost:
                                                  activity.actualCost?.toString() ??
                                                  "",
                                                currency: activity.currency ?? "",
                                                sourceUrl: activity.sourceUrl ?? "",
                                                bookingNeeded:
                                                  activity.bookingNeeded,
                                                priority: String(activity.priority),
                                              });
                                              setActivityEditorOpen(true);
                                            }}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            className="small-button danger"
                                            type="button"
                                            onClick={() => {
                                              if (
                                                !confirmDangerousAction(
                                                  `Delete activity "${activity.title}"?`,
                                                )
                                              ) {
                                                return;
                                              }
                                              runMutation(
                                                () =>
                                                  mutateData("DELETE", {
                                                    entity: "activities",
                                                    id: activity.id,
                                                    record: {},
                                                  }),
                                                "Activity deleted.",
                                              );
                                            }}
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
                          }
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "expenses" ? (
          <section className="stack">
            <div className="section-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setEditingExpenseId(null);
                  setExpenseDraft(emptyExpenseDraft());
                  setExpenseEditorOpen(true);
                }}
              >
                Add new expense
              </button>
            </div>
            <details
              className="editor-panel"
              open={expenseEditorOpen}
              onToggle={(event) =>
                setExpenseEditorOpen(event.currentTarget.open)
              }
            >
              <summary>Expense editor</summary>
              <div className="editor-body">
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
                    Notes
                    <textarea
                      rows={2}
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
                    {editingExpenseId ? "Update" : "Add"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setExpenseDraft(emptyExpenseDraft());
                      setEditingExpenseId(null);
                      setExpenseEditorOpen(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </details>

            <Panel title="Expense Ledger" subtitle="dense sheet with expandable notes">
              <div className="filters">
                <label>
                  Search
                  <input
                    value={expenseSearch}
                    onChange={(event) => setExpenseSearch(event.target.value)}
                  />
                </label>
                <label>
                  Division
                  <select
                    value={expenseDivision}
                    onChange={(event) => setExpenseDivision(event.target.value)}
                  >
                    <option>All</option>
                    {divisions.map((division) => (
                      <option key={division}>{division}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={expenseStatus}
                    onChange={(event) => setExpenseStatus(event.target.value)}
                  >
                    <option>All</option>
                    <option>planned</option>
                    <option>booked</option>
                    <option>paid</option>
                  </select>
                </label>
                <label>
                  Sort
                  <select
                    value={expenseSort}
                    onChange={(event) =>
                      setExpenseSort(event.target.value as typeof expenseSort)
                    }
                  >
                    <option value="date">date</option>
                    <option value="amount">amount</option>
                    <option value="division">division</option>
                  </select>
                </label>
              </div>

              <div className="table-wrap">
                <table className="dense-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Name</th>
                      <th>Division</th>
                      <th>Status</th>
                      <th>USD</th>
                      <th>Tags</th>
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
                        <ExpandableRow
                          key={expense.id}
                          columns={[
                            expense.date,
                            expense.name,
                            expense.division,
                            expense.status,
                            money.label,
                            expense.tags.join(", ") || "-",
                            "",
                          ]}
                          actionCell={
                            <>
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
                                setExpenseEditorOpen(true);
                              }}
                            >
                              Edit
                              </button>
                              <button
                                className="small-button danger"
                                type="button"
                              onClick={() => {
                                if (
                                  !confirmDangerousAction(
                                    `Delete expense "${expense.name}"?`,
                                  )
                                ) {
                                  return;
                                }
                                runMutation(
                                  () =>
                                    mutateData("DELETE", {
                                      entity: "expenses",
                                      id: expense.id,
                                      record: {},
                                    }),
                                  "Expense deleted.",
                                );
                              }}
                            >
                              Delete
                            </button>
                            </>
                          }
                          expandedContent={
                            <div className="expanded-copy">
                              <div title={money.title}>Local value: {money.title}</div>
                              <div>Notes: {expense.notes || "-"}</div>
                            </div>
                          }
                        />
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="totals-row">
                      <td colSpan={4}>Visible total</td>
                      <td>{formatMoney(visibleExpenseTotal, "USD")}</td>
                      <td colSpan={2}>{filteredExpenses.length} rows</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "budget" ? (
          <section className="stack">
            <Panel title="Budget by Division" subtitle="single-sheet budget view">
              <div className="table-wrap">
                <table className="dense-table">
                  <thead>
                    <tr>
                      <th>Division</th>
                      <th>Paid</th>
                      <th>Booked</th>
                      <th>Planned</th>
                      <th>Activity Est.</th>
                      <th>Total Exposure</th>
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
                        <td>
                          {formatMoney(
                            row.paid +
                              row.booked +
                              row.planned +
                              row.activityPlanned,
                            "USD",
                          )}
                        </td>
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
            <div className="section-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setEditingBookingId(null);
                  setBookingDraft(emptyBookingDraft());
                  setBookingEditorOpen(true);
                }}
              >
                Add new booking
              </button>
            </div>
            <details
              className="editor-panel"
              open={bookingEditorOpen}
              onToggle={(event) =>
                setBookingEditorOpen(event.currentTarget.open)
              }
            >
              <summary>Booking editor</summary>
              <div className="editor-body">
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
                    <input
                      value={bookingDraft.title}
                      onChange={(event) =>
                        setBookingDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Start
                    <input
                      type="datetime-local"
                      value={bookingDraft.startDateTime}
                      onChange={(event) =>
                        setBookingDraft((current) => ({
                          ...current,
                          startDateTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Leave by
                    <input
                      value={bookingDraft.leaveBy}
                      onChange={(event) =>
                        setBookingDraft((current) => ({
                          ...current,
                          leaveBy: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="full">
                    Notes
                    <textarea
                      rows={2}
                      value={bookingDraft.notes}
                      onChange={(event) =>
                        setBookingDraft((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button className="primary-button" onClick={handleBookingSubmit} type="button">
                    {editingBookingId ? "Update" : "Add"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setBookingDraft(emptyBookingDraft());
                      setEditingBookingId(null);
                      setBookingEditorOpen(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </details>

            <Panel title="Bookings" subtitle="compact booking rows; click for notes">
              <div className="table-wrap">
                <table className="dense-table">
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Start</th>
                      <th>Route / Property</th>
                      <th>Provider</th>
                      <th>Leave by</th>
                      <th>USD</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bookings.map((booking) => {
                      const money = formatUsdWithLocal(
                        booking.usdCost,
                        booking.cost,
                        booking.currency,
                      );
                      return (
                        <ExpandableRow
                          key={booking.id}
                          columns={[
                            booking.kind,
                            booking.startDateTime.slice(0, 16).replace("T", " "),
                            booking.kind === "hotel"
                              ? booking.title
                              : `${booking.origin} -> ${booking.destination}`,
                            booking.provider,
                            booking.leaveBy || "-",
                            money.label,
                            "",
                          ]}
                          actionCell={
                            <>
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
                                  setBookingEditorOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="small-button danger"
                                type="button"
                              onClick={() => {
                                if (
                                  !confirmDangerousAction(
                                    `Delete booking "${booking.title}"?`,
                                  )
                                ) {
                                  return;
                                }
                                runMutation(
                                  () =>
                                    mutateData("DELETE", {
                                      entity: "bookings",
                                      id: booking.id,
                                      record: {},
                                    }),
                                  "Booking deleted.",
                                );
                              }}
                            >
                              Delete
                            </button>
                            </>
                          }
                          expandedContent={
                            <div className="expanded-copy">
                              <div>Title: {booking.title}</div>
                              <div>End: {booking.endDateTime}</div>
                              <div>Confirmation: {booking.confirmationCode || "-"}</div>
                              <div>Terminal: {booking.terminal || "-"}</div>
                              <div>Address: {booking.address || "-"}</div>
                              <div title={money.title}>Local value: {money.title}</div>
                              <div>Notes: {booking.notes || "-"}</div>
                            </div>
                          }
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "guidance" ? (
          <section className="stack">
            <div className="section-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setEditingGuideId(null);
                  setGuideDraft(emptyGuideDraft());
                  setGuideEditorOpen(true);
                }}
              >
                Add new guidance item
              </button>
            </div>
            <details
              className="editor-panel"
              open={guideEditorOpen}
              onToggle={(event) => setGuideEditorOpen(event.currentTarget.open)}
            >
              <summary>Guidance editor</summary>
              <div className="editor-body">
                <div className="form-grid">
                  <label>
                    Kind
                    <select
                      value={guideDraft.kind}
                      onChange={(event) =>
                        setGuideDraft((current) => ({
                          ...current,
                          kind: event.target.value as GuideDraft["kind"],
                        }))
                      }
                    >
                      <option value="airport">airport</option>
                      <option value="station">station</option>
                      <option value="transport">transport</option>
                      <option value="packing">packing</option>
                      <option value="budget">budget</option>
                    </select>
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      value={guideDraft.linkedDate}
                      onChange={(event) =>
                        setGuideDraft((current) => ({
                          ...current,
                          linkedDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="full">
                    Title
                    <input
                      value={guideDraft.title}
                      onChange={(event) =>
                        setGuideDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="full">
                    Details
                    <textarea
                      rows={2}
                      value={guideDraft.details}
                      onChange={(event) =>
                        setGuideDraft((current) => ({
                          ...current,
                          details: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button className="primary-button" onClick={handleGuideSubmit} type="button">
                    {editingGuideId ? "Update" : "Add"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setGuideDraft(emptyGuideDraft());
                      setEditingGuideId(null);
                      setGuideEditorOpen(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </details>

            <Panel title="Guidance Sheet" subtitle="minimal rows; expand for full instructions">
              <div className="table-wrap">
                <table className="dense-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Kind</th>
                      <th>Title</th>
                      <th>Leave by</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.guides.map((guide) => (
                      <ExpandableRow
                        key={guide.id}
                        columns={[
                          guide.linkedDate || "-",
                          guide.kind,
                          guide.title,
                          guide.leaveBy || "-",
                          "",
                        ]}
                        actionCell={
                          <>
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
                                setGuideEditorOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="small-button danger"
                              type="button"
                              onClick={() => {
                                if (
                                  !confirmDangerousAction(
                                    `Delete guidance "${guide.title}"?`,
                                  )
                                ) {
                                  return;
                                }
                                runMutation(
                                  () =>
                                    mutateData("DELETE", {
                                      entity: "guides",
                                      id: guide.id,
                                      record: {},
                                    }),
                                  "Guide deleted.",
                                );
                              }}
                            >
                              Delete
                            </button>
                          </>
                        }
                        expandedContent={
                          <div className="expanded-copy">
                            <div>Summary: {guide.summary || "-"}</div>
                            <div>Details: {guide.details || "-"}</div>
                          </div>
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "checklist" ? (
          <section className="stack">
            <div className="section-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setEditingChecklistId(null);
                  setChecklistDraft(emptyChecklistDraft());
                  setChecklistEditorOpen(true);
                }}
              >
                Add new checklist item
              </button>
            </div>
            <details
              className="editor-panel"
              open={checklistEditorOpen}
              onToggle={(event) =>
                setChecklistEditorOpen(event.currentTarget.open)
              }
            >
              <summary>Checklist editor</summary>
              <div className="editor-body">
                <div className="form-grid">
                  <label>
                    Category
                    <input
                      value={checklistDraft.category}
                      onChange={(event) =>
                        setChecklistDraft((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={checklistDraft.status}
                      onChange={(event) =>
                        setChecklistDraft((current) => ({
                          ...current,
                          status: event.target.value as ChecklistDraft["status"],
                        }))
                      }
                    >
                      <option value="todo">todo</option>
                      <option value="done">done</option>
                    </select>
                  </label>
                  <label className="full">
                    Label
                    <input
                      value={checklistDraft.label}
                      onChange={(event) =>
                        setChecklistDraft((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="full">
                    Notes
                    <textarea
                      rows={2}
                      value={checklistDraft.notes}
                      onChange={(event) =>
                        setChecklistDraft((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button className="primary-button" onClick={handleChecklistSubmit} type="button">
                    {editingChecklistId ? "Update" : "Add"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setChecklistDraft(emptyChecklistDraft());
                      setEditingChecklistId(null);
                      setChecklistEditorOpen(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </details>

            <Panel title="Checklist" subtitle="dense prep sheet">
              <div className="table-wrap">
                <table className="dense-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Category</th>
                      <th>Item</th>
                      <th>USD Est.</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.checklist.map((item) => {
                      const money = formatUsdWithLocal(
                        item.usdEstimatedCost,
                        item.estimatedCost,
                        item.currency,
                      );
                      return (
                        <ExpandableRow
                          key={item.id}
                          columns={[
                            item.status,
                            item.category,
                            item.label,
                            item.estimatedCost !== null ? money.label : "-",
                            "",
                          ]}
                          actionCell={
                            <>
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
                                    estimatedCost:
                                      item.estimatedCost?.toString() ?? "",
                                    currency: item.currency ?? "",
                                  });
                                  setChecklistEditorOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="small-button danger"
                                type="button"
                              onClick={() => {
                                if (
                                  !confirmDangerousAction(
                                    `Delete checklist item "${item.label}"?`,
                                  )
                                ) {
                                  return;
                                }
                                runMutation(
                                  () =>
                                    mutateData("DELETE", {
                                      entity: "checklist",
                                      id: item.id,
                                      record: {},
                                    }),
                                  "Checklist item deleted.",
                                );
                              }}
                            >
                              Delete
                            </button>
                            </>
                          }
                          expandedContent={
                            <div className="expanded-copy">
                              <div title={money.title}>Local value: {money.title}</div>
                              <div>Notes: {item.notes || "-"}</div>
                            </div>
                          }
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
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

function CompactTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="table-wrap">
      <table className="dense-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join("-")}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpandableRow({
  columns,
  expandedContent,
  actionCell,
}: {
  columns: string[];
  expandedContent: React.ReactNode;
  actionCell?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const actionIndex = columns.length - 1;

  return (
    <>
      <tr
        className={open ? "row-open" : "row-closed"}
        onClick={() => setOpen((value) => !value)}
      >
        {columns.map((column, index) => (
          <td key={`${index}-${column}`}>
            {index === actionIndex && actionCell ? (
              <div
                className="actions-cell"
                onClick={(event) => event.stopPropagation()}
              >
                {actionCell}
              </div>
            ) : (
              column
            )}
          </td>
        ))}
      </tr>
      {open ? (
        <tr className="expanded-row">
          <td colSpan={columns.length}>{expandedContent}</td>
        </tr>
      ) : null}
    </>
  );
}

function ExpensePieChart({
  items,
}: {
  items: Array<{ division: string; total: number }>;
}) {
  const colors = [
    "#0d6f6f",
    "#c48a26",
    "#4f6d7a",
    "#c26053",
    "#6f8f3e",
    "#7f6db0",
    "#d0934d",
    "#5384a8",
  ];

  const total = items.reduce((sum, item) => sum + item.total, 0);

  if (!items.length || total <= 0) {
    return <div className="chart-empty">No expense data yet.</div>;
  }

  const segments = items.map((item, index) => {
    const value = item.total / total;
    const start =
      items
        .slice(0, index)
        .reduce((sum, current) => sum + current.total / total, 0);
    return {
      ...item,
      start,
      end: start + value,
      color: colors[index % colors.length],
      percent: value * 100,
    };
  });

  return (
    <div className="pie-layout">
      <svg viewBox="0 0 42 42" className="pie-chart" aria-label="Expense types pie chart">
        <circle cx="21" cy="21" r="15.915" fill="#f4f0ea" />
        {segments.map((segment) => (
          <circle
            key={segment.division}
            cx="21"
            cy="21"
            r="15.915"
            fill="transparent"
            stroke={segment.color}
            strokeWidth="8"
            strokeDasharray={`${segment.percent} ${100 - segment.percent}`}
            strokeDashoffset={`${25 - segment.start * 100}`}
          />
        ))}
        <circle cx="21" cy="21" r="9.5" fill="#fffdf8" />
        <text x="21" y="20" textAnchor="middle" className="pie-center-label">
          Total
        </text>
        <text x="21" y="24.4" textAnchor="middle" className="pie-center-value">
          {Math.round(total)}
        </text>
      </svg>

      <div className="pie-legend">
        {segments.map((segment) => (
          <div key={segment.division} className="legend-row">
            <span
              className="legend-swatch"
              style={{ backgroundColor: segment.color }}
            />
            <span>{segment.division}</span>
            <strong>{formatMoney(segment.total, "USD")}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
