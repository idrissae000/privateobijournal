import { DayScreen } from "@/components/DayScreen";
import { getToday } from "@/lib/data";

export default async function Home() {
  return <DayScreen date={await getToday()} />;
}
