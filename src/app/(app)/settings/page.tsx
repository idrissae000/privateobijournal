import { SettingsForm } from "./SettingsForm";
import { requireUser } from "@/lib/data";
import { Heading } from "@/components/scrap";
import Link from "next/link";

export default async function Settings() {
  const { user } = await requireUser();
  return (
    <div className="space-y-6">
      <Heading>Settings</Heading>
      <p className="font-type text-sm text-ink-soft">Signed in as {user.email}</p>
      <Link href="/admin" className="paper-card block p-4"><span className="font-hand text-2xl">Insight review & status</span><span className="font-type block text-xs text-ink-soft">Flags, last runs, daily AI usage, connection test</span></Link>
      <SettingsForm />
    </div>
  );
}
