import fs from "node:fs";
import path from "node:path";

import { load } from "cheerio";

import type {
  Activity,
  Booking,
  ChecklistItem,
  Expense,
  ExchangeRate,
  Guide,
  SeedData,
  TripDay,
} from "@/lib/trip-types";
import {
  convertToUsd,
  estimateFallbackCost,
  inferCategory,
  inferDivision,
  inferGuideKind,
  normalizeWhitespace,
  repairText,
  slugify,
  toIsoDate,
} from "@/lib/trip-utils";

const SOURCE_DIR = path.join(process.cwd(), "src", "data", "source");

const HIGH_COST_SOURCES = {
  teamlab: "https://www.teamlab.art/e/planets/",
  shibuyaSky: "https://www.shibuya-scramble-square.com/sky/",
  korail: "https://www.korail.com/",
  nankai: "https://www.nankai.co.jp/",
  klook: "https://www.klook.com/",
};

const exchangeRates: ExchangeRate[] = [
  {
    currency: "USD",
    usdRate: 1,
    note: "Base currency for trip budgeting.",
    updatedAt: "2026-06-09",
  },
  {
    currency: "JPY",
    usdRate: 0.0069,
    note: "Approximate snapshot used for planning conversions.",
    updatedAt: "2026-06-09",
  },
  {
    currency: "KRW",
    usdRate: 0.00073,
    note: "Approximate snapshot used for planning conversions.",
    updatedAt: "2026-06-09",
  },
];

const manualBookings: Booking[] = [
  {
    id: "booking-qatar-jfk-nrt",
    kind: "flight",
    title: "Qatar Airways: JFK to Narita via Doha",
    provider: "Qatar Airways",
    confirmationCode: "From booking screenshot",
    startDateTime: "2026-06-15T01:20:00",
    endDateTime: "2026-06-16T19:10:00",
    origin: "New York John F. Kennedy Intl (Terminal 8)",
    destination: "Tokyo Narita Intl (Terminal 2)",
    terminal: "JFK T8 / NRT T2",
    address: "",
    cost: 732.7,
    currency: "USD",
    usdCost: 732.7,
    leaveBy: "Leave for JFK by roughly 10:00 PM on June 14, 2026 for the 1:20 AM departure.",
    notes:
      "Two-flight itinerary: QR706 JFK→DOH then QR806 DOH→NRT. Two free checked bags at 23kg each from the baggage screenshot.",
    sourceType: "manual",
    sourceUrl: null,
  },
  {
    id: "booking-jeju-kix-icn",
    kind: "flight",
    title: "Jeju Air: Kansai to Incheon",
    provider: "Jeju Air",
    confirmationCode: "UHB45H",
    startDateTime: "2026-07-01T12:00:00",
    endDateTime: "2026-07-01T14:00:00",
    origin: "Osaka Kansai Intl (KIX)",
    destination: "Seoul Incheon (ICN)",
    terminal: "KIX / ICN",
    address: "",
    cost: 96.34,
    currency: "USD",
    usdCost: 96.34,
    leaveBy: "Leave Hiyori Hotel Osaka Namba Station by 8:00 AM for the July 1, 2026 flight.",
    notes:
      "Flight number 7C1304. Carry-on baggage allowance 10kg, one personal item, and 15kg checked bag included per booking screenshot.",
    sourceType: "manual",
    sourceUrl: null,
  },
  {
    id: "booking-aircanada-icn-ewr",
    kind: "flight",
    title: "Air Canada: Incheon to Newark via Vancouver and Ottawa",
    provider: "Air Canada",
    confirmationCode: "BZ8WB6",
    startDateTime: "2026-07-13T17:45:00",
    endDateTime: "2026-07-14T07:34:00",
    origin: "Seoul Incheon Terminal 1",
    destination: "Newark Liberty Terminal C",
    terminal: "ICN T1 / EWR C",
    address: "",
    cost: 634.7,
    currency: "USD",
    usdCost: 634.7,
    leaveBy:
      "Leave Grand Josun Busan by 10:30 AM for the 11:30 AM KTX, then transfer at Seoul Station to AREX by 2:00 PM.",
    notes:
      "Sequence: AC64 ICN→YVR, AC346 YVR→YOW, AC4398 YOW→EWR. Air Canada baggage screenshot shows one complimentary checked bag.",
    sourceType: "manual",
    sourceUrl: null,
  },
  {
    id: "booking-hotel-sunroute",
    kind: "hotel",
    title: "Hotel Sunroute Plaza Shinjuku",
    provider: "Hotel Sunroute Plaza Shinjuku",
    confirmationCode: "",
    startDateTime: "2026-06-16T16:30:00",
    endDateTime: "2026-06-24T09:00:00",
    origin: "Tokyo",
    destination: "Shinjuku",
    terminal: "",
    address:
      "2 Chome-3-1 Yoyogi, Shibuya, Tokyo 151-0053, Japan · +81 3-3375-3211",
    cost: null,
    currency: null,
    usdCost: null,
    leaveBy: "From Narita, the screenshot route shows an evening option landing near Shinjuku Station around 9:32 PM.",
    notes:
      "Hotel note from screenshot: central Shinjuku base. The imported guidance tab includes the Narita-to-Shinjuku route snapshot.",
    sourceType: "manual",
    sourceUrl: null,
  },
  {
    id: "booking-baggage-qatar",
    kind: "baggage",
    title: "Qatar Airways baggage allowance",
    provider: "Qatar Airways",
    confirmationCode: "",
    startDateTime: "2026-06-15T00:00:00",
    endDateTime: "2026-06-16T00:00:00",
    origin: "JFK",
    destination: "NRT",
    terminal: "",
    address: "",
    cost: null,
    currency: null,
    usdCost: null,
    leaveBy: "",
    notes:
      "1st checked bag free, 1 PC 23KG max 158LCM. 2nd checked bag free, 1 PC 23KG max 158LCM. Carry-on max 1 piece at 15LB / 7KG.",
    sourceType: "manual",
    sourceUrl: null,
  },
  {
    id: "booking-baggage-jeju",
    kind: "baggage",
    title: "Jeju Air baggage allowance",
    provider: "Jeju Air",
    confirmationCode: "UHB45H",
    startDateTime: "2026-07-01T00:00:00",
    endDateTime: "2026-07-01T00:00:00",
    origin: "KIX",
    destination: "ICN",
    terminal: "",
    address: "",
    cost: null,
    currency: null,
    usdCost: null,
    leaveBy: "",
    notes:
      "Carry-on allowance 1 piece up to 10kg, max 55 x 40 x 20 cm. One personal item. Checked baggage shows 15kg included in fare.",
    sourceType: "manual",
    sourceUrl: null,
  },
  {
    id: "booking-baggage-aircanada",
    kind: "baggage",
    title: "Air Canada baggage allowance",
    provider: "Air Canada",
    confirmationCode: "BZ8WB6",
    startDateTime: "2026-07-13T00:00:00",
    endDateTime: "2026-07-13T00:00:00",
    origin: "ICN",
    destination: "EWR",
    terminal: "",
    address: "",
    cost: null,
    currency: null,
    usdCost: null,
    leaveBy: "",
    notes:
      "One personal item and one standard carry-on article. 1st checked bag complimentary. 2nd bag shown at KRW 106,600 including taxes.",
    sourceType: "manual",
    sourceUrl: null,
  },
];

const manualGuides: Guide[] = [
  {
    id: "guide-hnd-shinjuku",
    kind: "airport",
    title: "Haneda to Hotel Sunroute Plaza Shinjuku",
    summary: "Clear customs, grab transit card, head straight to Shinjuku.",
    details:
      "After landing at Haneda on June 16, 2026, expect 30 to 45 minutes for immigration and customs. Load a Suica or Pasmo and take the train route toward Shinjuku; the itinerary notes this at about 50 minutes door to station.",
    leaveBy: "Plan to be on the train by about 4:45 PM after a 3:40 PM landing if customs moves smoothly.",
    linkedDate: "2026-06-16",
    sourceType: "manual",
  },
  {
    id: "guide-nrt-shinjuku",
    kind: "station",
    title: "Narita Airport Terminal 2-3 to Shinjuku Station",
    summary: "Use the Narita Skyaccess + Toei Shinjuku Line option captured in the screenshot.",
    details:
      "The imported hotel screenshot shows a route from Narita Airport Terminal 2-3 Station to Shinjuku Station using the Keisei Narita Skyaccess and Toei Shinjuku Line, roughly 8:08 PM to 9:32 PM, around ¥1,500 to ¥1,700, about one transfer, and mostly tap-in IC card usage.",
    leaveBy: "For the pictured route, aim to catch the 8:08 PM departure to arrive Shinjuku at about 9:32 PM.",
    linkedDate: "2026-06-16",
    sourceType: "manual",
  },
  {
    id: "guide-kix-departure",
    kind: "airport",
    title: "Osaka Namba hotel to KIX for Seoul flight",
    summary: "Leave early and use the Nankai Rapi:t as drafted in the itinerary.",
    details:
      "The itinerary calls for waking at 6:30 AM and leaving Hiyori Hotel Osaka Namba Station by 8:00 AM on July 1, 2026. Take the Nankai Rapi:t Express from Namba to Kansai Airport. The itinerary lists this at about ¥1,450 and roughly 50 minutes.",
    leaveBy: "Leave the hotel by 8:00 AM for the 12:00 PM airport flow and 12:35 PM flight timing.",
    linkedDate: "2026-07-01",
    sourceType: "manual",
  },
  {
    id: "guide-seoul-station-ktx",
    kind: "station",
    title: "Nine Tree Myeongdong to Seoul Station for KTX",
    summary: "Treat July 9 as a hard-transfer morning with no detours.",
    details:
      "The itinerary flags July 9, 2026 as critical: pack everything, check out, and taxi from Myeongdong to Seoul Station. Travel time is estimated at 15 to 20 minutes, with station arrival by 10:00 AM for the 10:30 AM KTX to Busan.",
    leaveBy: "Leave the hotel by 9:30 AM to comfortably board the 10:30 AM KTX.",
    linkedDate: "2026-07-09",
    sourceType: "manual",
  },
  {
    id: "guide-busan-homebound",
    kind: "airport",
    title: "Busan hotel to Seoul Station to ICN for the return flight",
    summary: "This is the tightest transfer chain of the trip, so keep the schedule rigid.",
    details:
      "Check out of Grand Josun Busan no later than 10:30 AM on July 13, 2026. Taxi to Busan Station, take the 11:30 AM KTX, arrive Seoul around 2:00 PM, then transfer directly to AREX for Incheon. The itinerary expects airport arrival around 3:15 PM for the 7:05 PM Air Canada departure.",
    leaveBy: "Hotel by 10:30 AM, Busan Station by 11:10 AM, no later.",
    linkedDate: "2026-07-13",
    sourceType: "manual",
  },
];

function readSourceFile(fileName: string): string {
  const sourcePath = path.join(SOURCE_DIR, fileName);
  return repairText(fs.readFileSync(sourcePath, "utf8"));
}

function getPriority(title: string, subtitle: string, tags: string[]): number {
  const text = `${title} ${subtitle} ${tags.join(" ")}`.toLowerCase();
  if (text.includes("non-negotiable") || text.includes("critical")) return 5;
  if (text.includes("best") || text.includes("most important")) return 4;
  if (text.includes("book")) return 3;
  return 2;
}

function getSourceForActivity(title: string): string | null {
  const lower = title.toLowerCase();
  if (lower.includes("teamlab")) return HIGH_COST_SOURCES.teamlab;
  if (lower.includes("shibuya sky")) return HIGH_COST_SOURCES.shibuyaSky;
  if (lower.includes("ktx")) return HIGH_COST_SOURCES.korail;
  if (lower.includes("rapi:t")) return HIGH_COST_SOURCES.nankai;
  if (lower.includes("yacht")) return HIGH_COST_SOURCES.klook;
  return null;
}

function overrideHighCostActivity(
  title: string,
): { amount: number; currency: "JPY" | "KRW"; sourceUrl: string } | null {
  const lower = title.toLowerCase();
  if (lower.includes("teamlab planets")) {
    return {
      amount: 3600,
      currency: "JPY",
      sourceUrl: HIGH_COST_SOURCES.teamlab,
    };
  }
  if (lower.includes("shibuya sky")) {
    return {
      amount: 2500,
      currency: "JPY",
      sourceUrl: HIGH_COST_SOURCES.shibuyaSky,
    };
  }
  if (lower.includes("ktx") && lower.includes("busan")) {
    return {
      amount: 59800,
      currency: "KRW",
      sourceUrl: HIGH_COST_SOURCES.korail,
    };
  }
  if (lower.includes("rapi:t")) {
    return {
      amount: 1450,
      currency: "JPY",
      sourceUrl: HIGH_COST_SOURCES.nankai,
    };
  }
  if (lower.includes("night yacht")) {
    return {
      amount: 35000,
      currency: "KRW",
      sourceUrl: HIGH_COST_SOURCES.klook,
    };
  }
  return null;
}

function parseItinerary(): { tripDays: TripDay[]; activities: Activity[]; guides: Guide[] } {
  const html = readSourceFile("japan-korea.html");
  const $ = load(html);
  const sectionIds = ["dep", "tokyo", "kyoto", "osaka", "seoul", "busan"];
  const tripDays: TripDay[] = [];
  const activities: Activity[] = [];
  const guides: Guide[] = [];

  for (const sectionId of sectionIds) {
    const section = $(`#${sectionId}`);
    if (!section.length) continue;

    const cityName =
      normalizeWhitespace(section.find(".section-name").first().text()) ||
      sectionId.toUpperCase();
    const hotel = normalizeWhitespace(section.find(".hotel-tag").first().text());

    section.find(".day-card").each((index, element) => {
      const card = $(element);
      const dayLabel = normalizeWhitespace(card.find(".day-date-badge").first().text());
      const title = normalizeWhitespace(card.find(".day-title-text").first().text());
      const subtitle = normalizeWhitespace(card.find(".day-subtitle").first().text());
      if (!dayLabel || !title) return;

      const date = toIsoDate(dayLabel, 2026);
      const tripDayId = `${date}-${slugify(title)}`;
      const tripDay: TripDay = {
        id: tripDayId,
        date,
        city: cityName,
        title,
        subtitle,
        hotel,
        notes: "",
      };

      if (!tripDays.some((entry) => entry.id === tripDayId)) {
        tripDays.push(tripDay);
      }

      card.find(".time-block").each((timeIndex, timeElement) => {
        const block = $(timeElement);
        const timeLabel = normalizeWhitespace(
          block.find(".time-stamp").first().text(),
        );
        const activityTitle = normalizeWhitespace(
          block.find(".time-title").first().text(),
        );
        const description = normalizeWhitespace(
          block.find(".time-detail").first().text(),
        );
        const tags = block
          .find(".tag")
          .toArray()
          .map((tagNode) => normalizeWhitespace($(tagNode).text()))
          .filter(Boolean);

        if (!activityTitle) return;

        const override = overrideHighCostActivity(activityTitle);
        const estimated = estimateFallbackCost(activityTitle, description, cityName);
        const sourceUrl = override?.sourceUrl ?? getSourceForActivity(activityTitle);
        const amount = override?.amount ?? estimated.amount;
        const currency = override?.currency ?? estimated.currency;

        const activity: Activity = {
          id: `${tripDayId}-activity-${index}-${timeIndex}`,
          tripDayId,
          date,
          city: cityName,
          timeLabel,
          title: activityTitle,
          description,
          category: inferCategory(activityTitle, tags),
          division: inferDivision(activityTitle, tags),
          tags,
          estimatedCost: amount,
          actualCost: null,
          currency,
          usdEstimatedCost: convertToUsd(
            amount,
            currency,
            exchangeRates,
          ),
          usdActualCost: null,
          sourceType: override ? "official" : estimated.sourceType,
          sourceUrl,
          bookingNeeded: tags.some((tag) => tag.toLowerCase().includes("book")),
          priority: getPriority(activityTitle, subtitle, tags),
        };

        activities.push(activity);

        if (activity.bookingNeeded || activityTitle.toLowerCase().includes("airport")) {
          guides.push({
            id: `guide-${activity.id}`,
            kind: inferGuideKind(activityTitle),
            title: `${cityName}: ${activityTitle}`,
            summary: subtitle || `${cityName} activity guidance`,
            details: description,
            leaveBy: timeLabel,
            linkedDate: date,
            sourceType: activity.sourceType,
          });
        }
      });

      card.find(".res-box").each((noteIndex, noteElement) => {
        const noteText = normalizeWhitespace($(noteElement).text());
        if (!noteText) return;
        guides.push({
          id: `${tripDayId}-reservation-${noteIndex}`,
          kind: "transport",
          title: `${cityName}: Reservation reminder`,
          summary: title,
          details: noteText,
          leaveBy: "",
          linkedDate: date,
          sourceType: "manual",
        });
      });
    });
  }

  return { tripDays, activities, guides };
}

function parseExpenses(): Expense[] {
  const text = readSourceFile("expenses_so_far.txt");
  const expenses: Expense[] = [
    {
      id: "expense-flight-qatar",
      name: "Qatar Airways flight",
      amount: 732.7,
      currency: "USD",
      usdAmount: 732.7,
      division: "flights",
      tags: ["qatar", "booked"],
      notes: "JFK to Tokyo booking from trip notes and screenshot itinerary.",
      date: "2026-06-15",
      status: "paid",
      sourceType: "manual",
      sourceUrl: null,
    },
    {
      id: "expense-flight-jeju",
      name: "Jeju Air flight",
      amount: 96.34,
      currency: "USD",
      usdAmount: 96.34,
      division: "flights",
      tags: ["jeju-air", "booked"],
      notes: "Kyoto/Osaka to Seoul flight from trip notes and booking screenshot.",
      date: "2026-07-01",
      status: "paid",
      sourceType: "manual",
      sourceUrl: null,
    },
    {
      id: "expense-flight-aircanada",
      name: "Air Canada flight",
      amount: 634.7,
      currency: "USD",
      usdAmount: 634.7,
      division: "flights",
      tags: ["air-canada", "booked"],
      notes: "Seoul to Newark return flight from trip notes and screenshot.",
      date: "2026-07-13",
      status: "paid",
      sourceType: "manual",
      sourceUrl: null,
    },
    {
      id: "expense-hotels-total",
      name: "Hotels total",
      amount: 1832.54,
      currency: "USD",
      usdAmount: 1832.54,
      division: "hotels",
      tags: ["lodging", "booked"],
      notes: "Combined hotel spend from trip notes.",
      date: "2026-06-16",
      status: "paid",
      sourceType: "manual",
      sourceUrl: null,
    },
    {
      id: "expense-airtag",
      name: "AirTag bundle",
      amount: 100,
      currency: "USD",
      usdAmount: 100,
      division: "essentials",
      tags: ["accessories"],
      notes: "Listed in the accessories section of trip notes.",
      date: "2026-06-09",
      status: "paid",
      sourceType: "manual",
      sourceUrl: null,
    },
  ];

  const plannedCosts = [
    ["Suitcase (Japan)", 90, "shopping", "extra luggage"],
    ["Merchandise", 250, "shopping", "souvenirs"],
    ["Food fund", 1400, "food", "trip meals"],
    ["Clothes / shoes", 220, "shopping", "wardrobe"],
    ["Daily necessities", 80, "essentials", "daily use"],
    ["Haircut", 40, "wellness", "self care"],
    ["Teeth whitening / cavities", 300, "wellness", "medical-ish"],
    ["Aqualyx procedure", 450, "wellness", "cosmetic"],
    ["Skincare haul", 260, "shopping", "beauty"],
  ] as const;

  plannedCosts.forEach(([name, amount, division, tag], index) => {
    expenses.push({
      id: `planned-expense-${index}`,
      name,
      amount,
      currency: "USD",
      usdAmount: amount,
      division,
      tags: [tag, "planned"],
      notes: "Seeded from Expected Purchases in trip notes.",
      date: "2026-06-14",
      status: "planned",
      sourceType: "estimate",
      sourceUrl: null,
    });
  });

  if (text.length > 0) {
    expenses.push({
      id: "expense-notes-buffer",
      name: "Trip notes planning buffer",
      amount: 150,
      currency: "USD",
      usdAmount: 150,
      division: "misc",
      tags: ["buffer", "notes"],
      notes: text,
      date: "2026-06-09",
      status: "planned",
      sourceType: "estimate",
      sourceUrl: null,
    });
  }

  return expenses;
}

function parseChecklist(): ChecklistItem[] {
  const things = readSourceFile("things_to_get.txt")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const checklist: ChecklistItem[] = things.map((line, index) => ({
    id: `checklist-${index}`,
    category: line.endsWith(":") ? "section" : "prep",
    label: line,
    notes: "",
    status: "todo",
    estimatedCost: null,
    currency: null,
    usdEstimatedCost: null,
  }));

  const manualItems: ChecklistItem[] = [
    {
      id: "checklist-esim",
      category: "tech",
      label: "Set up eSIM before departure",
      notes:
        "Notes suggest Airalo, Ubigi, Saily, or Zero eSIM and warn that airport eSIM pricing is worse.",
      status: "todo",
      estimatedCost: 25,
      currency: "USD",
      usdEstimatedCost: 25,
    },
    {
      id: "checklist-suica",
      category: "transport",
      label: "Load digital Suica / Pasmo",
      notes:
        "Load roughly ¥5,000 to start. Notes recommend the app-based card over the physical card.",
      status: "todo",
      estimatedCost: 5000,
      currency: "JPY",
      usdEstimatedCost: convertToUsd(5000, "JPY", exchangeRates),
    },
    {
      id: "checklist-tmoney",
      category: "transport",
      label: "Pick up T-money in Korea",
      notes: "Korean transit card equivalent, useful immediately after arrival.",
      status: "todo",
      estimatedCost: 5000,
      currency: "KRW",
      usdEstimatedCost: convertToUsd(5000, "KRW", exchangeRates),
    },
  ];

  return [...checklist, ...manualItems];
}

export function getSeedData(): SeedData {
  const itinerary = parseItinerary();
  const mergedGuides = [...manualGuides, ...itinerary.guides];
  return {
    tripDays: itinerary.tripDays.sort((a, b) => a.date.localeCompare(b.date)),
    activities: itinerary.activities.sort((a, b) =>
      a.date === b.date
        ? a.timeLabel.localeCompare(b.timeLabel)
        : a.date.localeCompare(b.date),
    ),
    expenses: parseExpenses(),
    bookings: manualBookings,
    guides: mergedGuides,
    checklist: parseChecklist(),
    exchangeRates,
  };
}
