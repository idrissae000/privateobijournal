import { redirect } from "next/navigation";

// The old standalone admin view now lives in the "Review" tab of the You area.
export default function AdminPage() {
  redirect("/archetype?tab=review");
}
