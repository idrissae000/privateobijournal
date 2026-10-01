import { Nav } from "@/components/Nav";
import { TzCookie } from "@/components/TzCookie";
import { getTz, requireUser } from "@/lib/data";
import { todayInTz, dateYm } from "@/lib/dates";

// Background AI jobs (scoring, reflections, reviews) run after the response, inside this window.
export const maxDuration = 60;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const tz = await getTz();
  const monthHref = `/month/${dateYm(todayInTz(tz))}`;

  return (
    <>
      <TzCookie current={tz} />
      <div className="safe-top mx-auto w-full max-w-xl flex-1 overflow-x-clip px-4 pb-28 pt-4">{children}</div>
      <Nav monthHref={monthHref} />
    </>
  );
}
