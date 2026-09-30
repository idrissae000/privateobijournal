"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/actions";
import { logout } from "@/app/login/actions";

export function SettingsForm() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-8">
      <form
        className="paper-card space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await changePassword(pw);
            if (res.error) setMsg({ ok: false, text: res.error });
            else { setMsg({ ok: true, text: "Password changed." }); setPw(""); }
          });
        }}
      >
        <h2 className="font-hand text-2xl">Change password</h2>
        <input
          className="input" type="password" autoComplete="new-password" placeholder="New password (10+ characters)"
          value={pw} onChange={(e) => setPw(e.target.value)} minLength={10} required
        />
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-moss" : "text-red-700"}`}>{msg.text}</p>}
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Update password"}</button>
      </form>
      <form action={logout}><button className="btn-ghost">Sign out</button></form>
    </div>
  );
}
