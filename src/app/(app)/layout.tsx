import { Nav } from "@/components/Nav";
import { TzCookie } from "@/components/TzCookie";
import { getTz, requireUser } from "@/lib/data";
import { seedIfEmpty } from "@/lib/seed";
import { todayInTz, dateYm } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireUser();
  const tz = await getTz();
  await seedIfEmpty(supabase, tz);
  const monthHref = `/month/${dateYm(todayInTz(tz))}`;

  return (
    <>
      <TzCookie current={tz} />
      <div className="safe-top mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">{children}</div>
      <Nav monthHref={monthHref} />
    </>
  );
}
