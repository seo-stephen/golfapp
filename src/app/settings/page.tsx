"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { buildBackup, isBackupFile, restoreBackup } from "@/lib/backup";
import { Button, Card } from "@/components/ui";
import { cacheModelForOffline, isModelCached } from "@/lib/modelAssets";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The pose model is 4.6 MB and cached on first use rather than at install, so
 * someone who never opens swing analysis doesn't pay for it. The cost is that a
 * first swing on a signal-less course would fail — hence this explicit control.
 */
function SwingModelCard() {
  const [cached, setCached] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    isModelCached().then((v) => active && setCached(v));
    return () => {
      active = false;
    };
  }, []);

  async function download() {
    setBusy(true);
    setErr(null);
    try {
      await cacheModelForOffline();
      setCached(await isModelCached());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-medium">Swing model — offline</h2>
      <p className="text-sm text-cream-400">
        Swing analysis needs a 4.6 MB pose model. It downloads the first time you open
        the swing screen, so grab it before heading somewhere without signal.
      </p>
      <div className="text-sm">
        {cached === null ? (
          <span className="text-cream-500">Checking…</span>
        ) : cached ? (
          <span className="text-kelly-400">
            Saved for offline use — swing analysis works with no signal.
          </span>
        ) : (
          <span className="text-amber-400/90">
            Not downloaded yet — swing analysis needs a connection right now.
          </span>
        )}
      </div>
      {!cached && (
        <Button onClick={download} disabled={busy || cached === null}>
          {busy ? "Downloading…" : "Download for offline use"}
        </Button>
      )}
      {err && <p className="text-sm text-red-400">{err}</p>}
    </Card>
  );
}

export default function SettingsPage() {
  const counts = useLiveQuery(async () => {
    if (typeof window === "undefined") return null;
    const db = requireDb();
    const [courses, rounds, swings, shots] = await Promise.all([
      db.courses.count(),
      db.rounds.count(),
      db.swingSessions.count(),
      db.shots.count(),
    ]);
    return { courses, rounds, swings, shots };
  }, [], null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const now = new Date();
      const backup = await buildBackup(now.toISOString());
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bogeyboys-backup-${now.toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(
        `Exported ${plural(backup.rounds.length, "round")} and ${plural(backup.courses.length, "course")}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isBackupFile(parsed)) {
        throw new Error("That doesn't look like a BogeyBoys backup file.");
      }
      const result = await restoreBackup(parsed);
      setStatus(
        `Restored ${plural(result.rounds, "round")}, ${plural(result.courses, "course")}, ${plural(result.swingSessions, "swing session")}, ${plural(result.shots, "logged shot")}. Entries with the same id were updated, not duplicated.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-cream-400 text-sm mt-1">
          Your data lives only on this device. Back it up.
        </p>
      </div>

      <Card className="space-y-3">
        <h2 className="font-medium">Stored on this device</h2>
        <div className="text-sm text-cream-400">
          {counts
            ? [
                plural(counts.rounds, "round"),
                plural(counts.courses, "course"),
                plural(counts.swings, "swing session"),
                plural(counts.shots, "logged shot"),
              ].join(" · ")
            : "Loading…"}
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-medium">Backup &amp; restore</h2>
          <p className="text-sm text-cream-400 mt-1">
            Export writes a JSON file of your courses, rounds, and swing metrics. Swing
            <em> videos</em> are not included — they&apos;re large, and the numbers are what
            matter for tracking progress.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleExport} disabled={busy}>
            Export backup
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Restore from file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
        </div>

        {status && <p className="text-sm text-kelly-400">{status}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </Card>

      <SwingModelCard />

      <Card className="space-y-3">
        <h2 className="font-medium">Adding to your Home Screen — read this first</h2>
        <p className="text-sm text-amber-400/90">
          On iOS, a Home Screen app gets its <strong>own separate storage</strong>. It does
          not share anything with this Safari tab, so the installed app will open with{" "}
          <strong>no rounds at all</strong>. Your data isn&apos;t gone — it&apos;s still in
          Safari — but it does not travel with you automatically.
        </p>
        <p className="text-sm text-cream-400">
          To move it across:
        </p>
        <ol className="text-sm text-cream-400 list-decimal ml-5 space-y-1">
          <li>Export a backup here, in Safari.</li>
          <li>Add BogeyBoys to your Home Screen from the share sheet.</li>
          <li>
            Open the Home Screen app <strong>while you still have signal</strong>, so it can
            cache itself for offline use.
          </li>
          <li>Go to Settings in the installed app and restore the backup.</li>
          <li>From then on, use the Home Screen app — not the Safari tab.</li>
        </ol>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-medium">Why back up at all</h2>
        <p className="text-sm text-cream-400">
          Safari clears a site&apos;s storage after about seven days without a visit, and
          that sweep takes the rounds, the offline cache, and the handicap with it.
          Installing to the Home Screen exempts the app from that cleanup, which is the
          main reason to install. A periodic export covers everything else — a wiped
          phone, a cleared history, or switching devices.
        </p>
      </Card>
    </div>
  );
}
