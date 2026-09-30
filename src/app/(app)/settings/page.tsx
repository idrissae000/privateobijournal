import { SettingsForm } from "./SettingsForm";
import { requireUser } from "@/lib/data";
import { Heading } from "@/components/scrap";

export default async function Settings() {
  const { user } = await requireUser();
  return (
    <div className="space-y-6">
      <Heading>Settings</Heading>
      <p className="font-type text-sm text-ink-soft">Signed in as {user.email}</p>
      <SettingsForm />
    </div>
  );
}
