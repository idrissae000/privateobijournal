"use client";

import { useState } from "react";
import { ImageSlot } from "@/components/ImageSlot";

// Temporary page to verify R2 uploads end to end. Remove once the real flows exist.
export default function TestUpload() {
  const [key, setKey] = useState<string | null>(null);
  return (
    <main className="flex min-h-dvh flex-col items-center gap-4 bg-[#f3e9d2] p-6">
      <h1 className="text-2xl text-[#3b2f1e]">Upload test</h1>
      <ImageSlot value={key} onChange={setKey} className="h-64 w-64 rotate-2 bg-white p-2 shadow-lg" />
      {key && <code className="break-all text-xs text-[#3b2f1e]">{key}</code>}
    </main>
  );
}
