import { format, isValid, parse } from "date-fns";

import type {
  Activity,
  CurrencyCode,
  ExchangeRate,
  GuideKind,
  SourceType,
} from "@/lib/trip-types";

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

export function normalizeWhitespace(input: string): string {
  return input.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function cleanText(input: string): string {
  return normalizeWhitespace(
    input
      .replace(/\u0000/g, "")
      .replace(/Ã‚Â¥|Â¥/g, "¥")
      .replace(/Ã¢â€šÂ©|â‚©/g, "₩")
      .replace(/Ã‚Â·|Â·/g, " · ")
      .replace(/Ã¢â€ â€™|â†’/g, " -> ")
      .replace(/Ã¢â‚¬â€œ|Ã¢â‚¬â€|â€“|â€”/g, " - ")
      .replace(/Ã¢â‚¬Ëœ|Ã¢â‚¬â„¢|â€˜|â€™/g, "'")
      .replace(/Ã¢â‚¬Å“|Ã¢â‚¬ï¿½|â€œ|â€�/g, '"')
      .replace(/Ã¢Å“Ë†Ã¯Â¸Â|Ã¢Å“Ë†/g, "Flight")
      .replace(/Ã°Å¸ÂÂ¨/g, "Hotel")
      .replace(/Ã°Å¸â€¡Â¯Ã°Å¸â€¡Âµ/g, "Japan")
      .replace(/Ã°Å¸â€¡Â°Ã°Å¸â€¡Â·/g, "Korea")
      .replace(/Ã°Å¸â€œÂ¸/g, "Photo")
      .replace(/Ã°Å¸â€ºÂµ/g, "Scooter")
      .replace(/Ã°Å¸Å¡â€”/g, "Car")
      .replace(/Ã°Å¸Å’Å /g, "Busan")
      .replace(/Ã¢Â­Â/g, "Star")
      .replace(/Ã‚|Â/g, "")
      .replace(/\s*->\s*/g, " -> ")
      .replace(/\s*·\s*/g, " · "),
  );
}

export function repairText(input: string): string {
  const trimmed = input.replace(/\u0000/g, "");

  try {
    if (typeof Buffer === "undefined") {
      return cleanText(trimmed);
    }

    const repaired = Buffer.from(trimmed, "latin1").toString("utf8");
    const candidate =
      repaired.includes("Tokyo") ||
      repaired.includes("Kyoto") ||
      repaired.includes("Seoul") ||
      repaired.includes("Busan");
    return cleanText(candidate ? repaired : trimmed);
  } catch {
    return cleanText(trimmed);
  }
}

export function toSearchText(input: string): string {
  return cleanText(input)
    .toLowerCase()
    .replace(/[¥₩$]/g, " ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(input: string): string {
  return cleanText(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toIsoDate(shortDate: string, year = 2026): string {
  const cleaned = cleanText(shortDate).replace(".", "");
  const [monthRaw, dayRaw] = cleaned.split(" ");
  const month = MONTHS[monthRaw] ?? "01";
  const day = dayRaw.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toIsoDateTime(date: string, label: string): string {
  const normalized = cleanText(label);
  const parsed = parse(normalized, "h:mm a", new Date(`${date}T00:00:00`));
  if (!isValid(parsed)) {
    return `${date}T12:00:00`;
  }
  return format(parsed, "yyyy-MM-dd'T'HH:mm:ss");
}

export function parseTags(input: string): string[] {
  return cleanText(input)
    .split(/[,|·•/]+/)
    .map((part) => cleanText(part))
    .filter(Boolean);
}

export function joinTags(tags: string[]): string {
  return tags.map((tag) => cleanText(tag)).filter(Boolean).join(", ");
}

export function getRate(
  currency: CurrencyCode | null,
  exchangeRates: ExchangeRate[],
): number | null {
  if (!currency) {
    return null;
  }
  const found = exchangeRates.find((item) => item.currency === currency);
  return found ? found.usdRate : null;
}

export function convertToUsd(
  amount: number | null,
  currency: CurrencyCode | null,
  exchangeRates: ExchangeRate[],
): number | null {
  if (amount === null || currency === null) {
    return null;
  }
  if (currency === "USD") {
    return roundMoney(amount);
  }
  const rate = getRate(currency, exchangeRates);
  if (!rate) {
    return null;
  }
  return roundMoney(amount * rate);
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatMoney(
  amount: number | null,
  currency: CurrencyCode | null,
): string {
  if (amount === null) {
    return "TBD";
  }
  const actualCurrency = currency ?? "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: actualCurrency,
    maximumFractionDigits: actualCurrency === "USD" ? 2 : 0,
  }).format(amount);
}

export function formatUsdWithLocal(
  usdAmount: number | null,
  localAmount: number | null,
  currency: CurrencyCode | null,
): { label: string; title: string } {
  const label = formatMoney(usdAmount, "USD");
  const title =
    localAmount !== null && currency
      ? `${formatMoney(localAmount, currency)} local`
      : "No local currency value";
  return { label, title };
}

export function extractCurrencyAmount(
  description: string,
): { amount: number; currency: CurrencyCode } | null {
  const text = repairText(description);
  const yenMatch =
    text.match(/(?:¥|JPY)\s?([\d,]+(?:\.\d+)?)/i) ??
    text.match(/\$?~?¥([\d,]+(?:\.\d+)?)/i);
  if (yenMatch) {
    return { amount: Number(yenMatch[1].replace(/,/g, "")), currency: "JPY" };
  }
  const wonMatch =
    text.match(/(?:KRW|₩)\s?([\d,]+(?:\.\d+)?)/i) ??
    text.match(/([\d,]+)\s?KRW/i);
  if (wonMatch) {
    return { amount: Number(wonMatch[1].replace(/,/g, "")), currency: "KRW" };
  }
  const usdMatch = text.match(/\$([\d,]+(?:\.\d+)?)/);
  if (usdMatch) {
    return { amount: Number(usdMatch[1].replace(/,/g, "")), currency: "USD" };
  }
  return null;
}

export function inferDivision(title: string, tags: string[]): string {
  const text = `${title} ${tags.join(" ")}`.toLowerCase();
  if (text.includes("flight") || text.includes("airport")) return "flights";
  if (text.includes("hotel")) return "hotels";
  if (text.includes("train") || text.includes("taxi") || text.includes("bus"))
    return "transport";
  if (text.includes("coffee")) return "coffee";
  if (text.includes("food") || text.includes("dinner") || text.includes("lunch"))
    return "food";
  if (text.includes("shop") || text.includes("gift") || text.includes("camera"))
    return "shopping";
  if (text.includes("spa") || text.includes("skincare")) return "wellness";
  return "activities";
}

export function inferCategory(title: string, tags: string[]): string {
  const text = `${title} ${tags.join(" ")}`.toLowerCase();
  if (text.includes("photo")) return "Photo Spot";
  if (text.includes("food") || text.includes("dinner") || text.includes("lunch"))
    return "Food";
  if (text.includes("coffee") || text.includes("tea")) return "Coffee / Tea";
  if (text.includes("shop")) return "Shopping";
  if (text.includes("flight")) return "Transit";
  if (text.includes("book")) return "Booked Activity";
  return "Activity";
}

export function inferGuideKind(title: string): GuideKind {
  const lower = title.toLowerCase();
  if (lower.includes("airport") || lower.includes("flight")) return "airport";
  if (
    lower.includes("station") ||
    lower.includes("shinkansen") ||
    lower.includes("ktx")
  ) {
    return "station";
  }
  if (lower.includes("pack") || lower.includes("bag")) return "packing";
  if (lower.includes("money") || lower.includes("budget")) return "budget";
  return "transport";
}

export function estimateFallbackCost(
  title: string,
  description: string,
  city: string,
): { amount: number | null; currency: CurrencyCode | null; sourceType: SourceType } {
  const explicit = extractCurrencyAmount(description);
  if (explicit) {
    return { ...explicit, sourceType: "manual" };
  }

  const text = `${title} ${description}`.toLowerCase();
  const japanese = ["Tokyo", "Kyoto", "Osaka"].includes(city);
  const currency: CurrencyCode = japanese ? "JPY" : "KRW";

  if (text.includes("free") || text.includes("walk") || text.includes("park")) {
    return { amount: 0, currency, sourceType: "estimate" };
  }
  if (text.includes("coffee") || text.includes("matcha")) {
    return {
      amount: japanese ? 700 : 6500,
      currency,
      sourceType: "estimate",
    };
  }
  if (text.includes("dinner") || text.includes("lunch") || text.includes("breakfast")) {
    return {
      amount: japanese ? 2200 : 18000,
      currency,
      sourceType: "estimate",
    };
  }
  if (text.includes("train") || text.includes("subway")) {
    return {
      amount: japanese ? 600 : 1800,
      currency,
      sourceType: "estimate",
    };
  }
  if (text.includes("taxi")) {
    return {
      amount: japanese ? 2200 : 12000,
      currency,
      sourceType: "estimate",
    };
  }
  if (text.includes("kimono")) {
    return { amount: 4000, currency: "JPY", sourceType: "estimate" };
  }
  if (text.includes("skincare") || text.includes("souvenir")) {
    return {
      amount: japanese ? 3000 : 25000,
      currency,
      sourceType: "estimate",
    };
  }
  if (text.includes("shopping")) {
    return {
      amount: japanese ? 5000 : 35000,
      currency,
      sourceType: "estimate",
    };
  }

  return {
    amount: japanese ? 1200 : 10000,
    currency,
    sourceType: "estimate",
  };
}

export function sumMoney(values: Array<number | null>): number {
  return roundMoney(
    values.reduce<number>(
      (total, value) => total + (value === null ? 0 : value),
      0,
    ),
  );
}

export function getActivityCost(activity: Activity): number | null {
  return activity.usdActualCost ?? activity.usdEstimatedCost;
}
