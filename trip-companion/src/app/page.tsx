import { TripCompanionApp } from "@/components/trip-companion-app";
import { getTripAppData } from "@/lib/trip-db";

export default async function Home() {
  const data = await getTripAppData();
  return <TripCompanionApp initialData={data} />;
}
