import { logout } from "./login/actions";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#f3e9d2] p-6">
      <h1 className="text-3xl text-[#3b2f1e]">Obis Journal</h1>
      <form action={logout}>
        <button className="text-sm text-[#3b2f1e] underline">Sign out</button>
      </form>
    </main>
  );
}
