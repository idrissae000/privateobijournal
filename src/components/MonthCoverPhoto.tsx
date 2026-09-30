"use client";

import { useRouter } from "next/navigation";
import { updateMonth } from "@/app/actions";
import { ImageSlot } from "@/components/ImageSlot";
import { Tape } from "@/components/scrap";

export function MonthCoverPhoto({ monthId, value, url }: { monthId: string; value: string | null; url: string | null }) {
  const router = useRouter();
  return (
    <div className="polaroid relative mx-auto aspect-[4/5] w-56 rotate-2">
      <Tape className="-top-3 left-1/2 -ml-9 -rotate-3" />
      <ImageSlot
        value={value} url={url} label="Set cover photo" hint="cover photo" className="h-[calc(100%-0.6rem)] w-full"
        onChange={async (key) => { await updateMonth(monthId, { coverImageKey: key }); router.refresh(); }}
      />
    </div>
  );
}
