import { notFound } from "next/navigation";
import { DayScreen } from "@/components/DayScreen";
import { isValidDate } from "@/lib/dates";

export default async function DayPage({ params }: PageProps<"/day/[date]">) {
  const { date } = await params;
  if (!isValidDate(date)) notFound();
  return <DayScreen date={date} />;
}
