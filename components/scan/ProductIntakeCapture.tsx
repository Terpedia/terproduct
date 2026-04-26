"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

const SLOTS = [
  {
    id: "front" as const,
    title: "Front of package",
    hint: "Main branding and product name, full panel if possible.",
  },
  {
    id: "back" as const,
    title: "Back of package",
    hint: "Back panel with extra copy and labels.",
  },
  {
    id: "nutrition" as const,
    title: "Nutrition or Drug facts",
    hint: "The nutrition fact panel, supplement facts, or drug facts (front or back).",
  },
  {
    id: "ingredients" as const,
    title: "Ingredients",
    hint: "Ingredients list, allergen callouts, and any fine print for inputs.",
  },
] as const;

type SlotId = (typeof SLOTS)[number]["id"];

type SlotData = { file: File; url: string };

function revokeUrl(s: string | null | undefined) {
  if (s?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(s);
    } catch {
      /* ignore */
    }
  }
}

export function ProductIntakeCapture() {
  const formId = useId();
  const [slots, setSlots] = useState<Partial<Record<SlotId, SlotData>>>({});
  const [shareError, setShareError] = useState<string | null>(null);

  const filledCount = useMemo(() => SLOTS.filter((s) => slots[s.id]).length, [slots]);

  const onPick = useCallback((slot: SlotId, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setSlots((prev) => {
      const cur = prev[slot];
      if (cur?.url) revokeUrl(cur.url);
      return { ...prev, [slot]: { file, url: URL.createObjectURL(file) } };
    });
  }, []);

  const onClear = useCallback((slot: SlotId) => {
    setSlots((prev) => {
      const cur = prev[slot];
      if (cur?.url) revokeUrl(cur.url);
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }, []);

  const slotsRef = useRef<Partial<Record<SlotId, SlotData>>>({});
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);
  useEffect(
    () => () => {
      (Object.values(slotsRef.current) as SlotData[]).forEach((d) => revokeUrl(d?.url));
    },
    [],
  );

  const filesForShare = useMemo(
    () =>
      (Object.values(slots) as SlotData[])
        .map((d) => d?.file)
        .filter((f): f is File => Boolean(f)),
    [slots],
  );

  const onShare = useCallback(async () => {
    setShareError(null);
    if (filesForShare.length === 0) {
      setShareError("Add at least one photo first.");
      return;
    }
    const nav = navigator;
    if (!("share" in nav) || !("canShare" in nav)) {
      setShareError("Sharing files is not supported in this browser.");
      return;
    }
    if (!nav.canShare({ files: filesForShare })) {
      setShareError("These images cannot be shared (try one photo at a time or a different device).");
      return;
    }
    try {
      await nav.share({
        title: "Terproduct — product images",
        text: "Product documentation photos (Terproduct)",
        files: filesForShare,
      });
    } catch (e) {
      if (e && typeof e === "object" && (e as Error).name === "AbortError") return;
      setShareError("Share was cancelled or failed.");
    }
  }, [filesForShare]);

  return (
    <section
      className="space-y-4"
      aria-labelledby={`${formId}-photo-heading`}
    >
      <div>
        <h2 id={`${formId}-photo-heading`} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Product photos
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Capture each panel in order. Photos stay on this device until you share or clear them; they
          are for your workflow and (later) can plug into a Terpedia intake API.
        </p>
        <p className="mt-2 text-sm font-medium text-emerald-900 dark:text-emerald-300" aria-live="polite">
          {filledCount} of {SLOTS.length} panels captured
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {SLOTS.map((slot) => {
          const data = slots[slot.id];
          const inputId = `${formId}-file-${slot.id}`;

          return (
            <li
              key={slot.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{slot.title}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">{slot.hint}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0">
                  <input
                    id={inputId}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => {
                      onPick(slot.id, e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <label
                    htmlFor={inputId}
                    className="inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800"
                  >
                    {data ? "Retake" : "Take photo"}
                  </label>
                  {data ? (
                    <button
                      type="button"
                      onClick={() => onClear(slot.id)}
                      className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              {data ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                  {/* Blob previews are local only; `next/image` is not a fit here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL from capture */}
                  <img
                    src={data.url}
                    alt={`${slot.title} (preview)`}
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {filesForShare.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-500/50 bg-emerald-50/40 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            Share the captured files with your team, upload target, or save from the system sheet
            (where supported).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onShare()}
              className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Share images…
            </button>
          </div>
          {shareError ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{shareError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
