"use client";

import { useCallback, useEffect, useState } from "react";
import { useFinance } from "../store";
import { API, getJSON, sendJSON } from "@/lib/client";
import type { ActivityEntry } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  create: "added",
  update: "edited",
  delete: "deleted",
  "delete-undone": "deleted (undone)",
};

const fetchEntries = () => getJSON<ActivityEntry[]>(`${API}/activity?limit=200`);

export default function ActivityPage() {
  const { reload, notify } = useFinance();
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await fetchEntries());
    } catch (e) { notify("Load failed: " + String(e)); }
  }, [notify]);

  useEffect(() => {
    fetchEntries()
      .then(setEntries)
      .catch((e) => notify("Load failed: " + String(e)));
  }, [notify]);

  const undoEntry = async (id: number) => {
    try {
      await sendJSON(`${API}/activity/${id}/undo`, "POST");
      notify("Restored");
      load();
      reload();
    } catch (e) { notify("Undo failed: " + String(e)); }
  };

  if (!entries) return <div className="empty">Loading…</div>;

  return (
    <div className="panel">
      <h2>Activity</h2>
      <p className="muted" style={{ fontSize: 12 }}>
        Everything that changed your data, newest first. Deletions can be restored here at any time.
      </p>
      {entries.length === 0 && <div className="empty">No activity yet.</div>}
      {entries.length > 0 && (
        <table>
          <thead><tr>
            <th>When</th><th>What</th><th></th>
          </tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {e.created_at.slice(0, 10)} {e.created_at.slice(11, 16)}
                </td>
                <td>
                  <span className="muted">{e.entity} {ACTION_LABEL[e.action] || e.action}: </span>
                  {e.summary}
                </td>
                <td className="right actions">
                  {e.undoable && (
                    <button className="btn secondary small" aria-label={`Undo: ${e.summary}`}
                      onClick={() => undoEntry(e.id)}>Undo</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
