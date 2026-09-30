"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f3e9d2] p-6">
      <form
        action={action}
        className="w-full max-w-sm -rotate-1 space-y-4 bg-[#fffaf0] p-6 shadow-lg"
      >
        <h1 className="text-center text-3xl text-[#3b2f1e]">Obis Journal</h1>
        <input
          name="email"
          defaultValue={state.email}
          type="email"
          autoComplete="email"
          placeholder="Email"
          required
          className="w-full border-b-2 border-[#3b2f1e]/40 bg-transparent p-2 text-base outline-none"
        />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          required
          className="w-full border-b-2 border-[#3b2f1e]/40 bg-transparent p-2 text-base outline-none"
        />
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        <button
          disabled={pending}
          className="w-full bg-[#3b2f1e] p-3 text-[#f3e9d2] disabled:opacity-60"
        >
          {pending ? "Opening…" : "Open journal"}
        </button>
      </form>
    </main>
  );
}
