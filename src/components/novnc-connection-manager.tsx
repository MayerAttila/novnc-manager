"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  buildLaunchUrl,
  createProfileId,
  DEFAULT_PROFILES,
  getConnectionSubtitle,
  STORAGE_KEY,
  type ConnectionProfile,
} from "@/lib/novnc";

type DraftProfile = {
  id?: string;
  name: string;
  host: string;
  port: string;
  password: string;
  notes: string;
};

const EMPTY_DRAFT: DraftProfile = {
  name: "",
  host: "192.168.0.104:6901",
  port: "6901",
  password: "",
  notes: "",
};

function formatRelativeTime(input?: string) {
  if (!input) {
    return "Never opened";
  }

  const date = new Date(input);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);

  if (minutes < 1) {
    return "Opened just now";
  }
  if (minutes < 60) {
    return `Opened ${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Opened ${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `Opened ${days}d ago`;
}

function profileToDraft(profile: ConnectionProfile): DraftProfile {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    password: profile.password,
    notes: profile.notes,
  };
}

function draftToProfile(draft: DraftProfile): ConnectionProfile {
  return {
    id: draft.id ?? createProfileId(),
    name: draft.name.trim(),
    host: draft.host.trim(),
    port: draft.port.trim(),
    password: draft.password.trim(),
    notes: draft.notes.trim(),
    updatedAt: new Date().toISOString(),
  };
}

function isValidDraft(draft: DraftProfile) {
  return Boolean(draft.name.trim() && draft.host.trim() && draft.port.trim());
}

export function NoVncConnectionManager() {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>(DEFAULT_PROFILES);
  const [draft, setDraft] = useState<DraftProfile>(EMPTY_DRAFT);
  const [search, setSearch] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Everything saves locally in this browser.",
  );
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ConnectionProfile[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProfiles(parsed);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }, [hydrated, profiles]);

  useEffect(() => {
    if (!modalMode) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalMode]);

  const filteredProfiles = [...profiles]
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    )
    .filter((profile) => {
      const query = deferredSearch.trim().toLowerCase();
      if (!query) {
        return true;
      }

      const haystack = [
        profile.name,
        profile.host,
        profile.port,
        profile.notes,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

  function setDraftField<Key extends keyof DraftProfile>(
    key: Key,
    value: DraftProfile[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openAddModal() {
    setDraft(EMPTY_DRAFT);
    setModalMode("add");
    setStatusMessage("Creating a new connection.");
  }

  function openEditModal(profile: ConnectionProfile) {
    setDraft(profileToDraft(profile));
    setModalMode("edit");
    setStatusMessage(`Editing ${profile.name}.`);
  }

  function closeModal() {
    setModalMode(null);
    setDraft(EMPTY_DRAFT);
  }

  function saveDraft() {
    if (!isValidDraft(draft)) {
      setStatusMessage("Fill name, host, and port before saving.");
      return;
    }

    const nextProfile = draftToProfile(draft);

    setProfiles((current) => {
      const existing = current.some((profile) => profile.id === nextProfile.id);
      if (!existing) {
        return [nextProfile, ...current];
      }

      return current.map((profile) =>
        profile.id === nextProfile.id
          ? { ...nextProfile, lastOpenedAt: profile.lastOpenedAt }
          : profile,
      );
    });

    setStatusMessage(draft.id ? "Connection updated." : "Connection created.");
    closeModal();
  }

  function removeProfile(id: string) {
    setProfiles((current) => current.filter((profile) => profile.id !== id));
    setStatusMessage("Connection removed.");
  }

  function markOpened(id: string) {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === id
          ? { ...profile, lastOpenedAt: new Date().toISOString() }
          : profile,
      ),
    );
  }

  function openProfile(profile: ConnectionProfile) {
    markOpened(profile.id);
    window.open(buildLaunchUrl(profile), "_blank", "noopener,noreferrer");
  }

  function exportProfiles() {
    const blob = new Blob([JSON.stringify(profiles, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "novnc-connections.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Connections exported.");
  }

  async function importProfiles(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ConnectionProfile[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Imported file is empty or invalid.");
      }

      setProfiles(parsed);
      setStatusMessage("Connections imported.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import connections.";
      setStatusMessage(message);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <>
      <main className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted)]">
                noVNC Manager
              </span>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                Saved Connections
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportProfiles}
                className={secondaryButtonClassName}
              >
                Export
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={importProfiles}
              />
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className={secondaryButtonClassName}
              >
                Import
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className={primaryButtonClassName}
              >
                Add Connection
              </button>
            </div>
          </div>

          <div className="mb-6 space-y-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-strong)] py-2 pl-10 pr-4 text-sm text-[var(--foreground-secondary)] shadow-sm outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
              />
            </div>
          </div>

          <div className="grid gap-4">
            {filteredProfiles.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[var(--border-strong)] bg-[var(--background)] p-8 text-center text-[var(--muted)]">
                No matching connections. Clear the search or add a new one.
              </div>
            ) : null}

            {filteredProfiles.map((profile) => (
              <article
                key={profile.id}
                role="button"
                tabIndex={0}
                onClick={() => openProfile(profile)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProfile(profile);
                  }
                }}
                className="cursor-pointer rounded-[18px] border border-[var(--border)] bg-[var(--background)] p-5 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] focus:outline-none focus-visible:border-[var(--accent)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-semibold text-[var(--foreground)]">
                      {profile.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                      {profile.notes || "No notes yet."}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[var(--surface)] px-3 py-1 font-mono text-xs text-[var(--foreground-secondary)]">
                        {profile.host}
                      </span>
                      <span className="rounded-full bg-[var(--surface)] px-3 py-1 font-mono text-xs text-[var(--foreground-secondary)]">
                        Port {profile.port}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <span className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                      {formatRelativeTime(profile.lastOpenedAt)}
                    </span>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(profile);
                        }}
                        className={secondaryButtonClassName}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeProfile(profile.id);
                        }}
                        className={dangerButtonClassName}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.5)]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted)]">
                  {modalMode === "edit" ? "Connection Editor" : "New Connection"}
                </span>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {modalMode === "edit" ? "Edit Connection" : "Add Connection"}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Basic setup only. Name it, point it to the gateway, and save.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className={secondaryButtonClassName}
              >
                Close
              </button>
            </div>

            <div className="space-y-5">
              <Field label="Name" required>
                <input
                  value={draft.name}
                  onChange={(event) => setDraftField("name", event.target.value)}
                  placeholder="Machine 62"
                  className={inputClassName}
                />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Gateway Host" required>
                  <input
                    value={draft.host}
                    onChange={(event) => setDraftField("host", event.target.value)}
                    placeholder="192.168.0.104:6901"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Port" required>
                  <input
                    value={draft.port}
                    onChange={(event) => setDraftField("port", event.target.value)}
                    placeholder="6901"
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field label="Password">
                <input
                  value={draft.password}
                  onChange={(event) => setDraftField("password", event.target.value)}
                  placeholder="Optional noVNC password"
                  className={inputClassName}
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraftField("notes", event.target.value)}
                  rows={3}
                  placeholder="Optional notes for this connection"
                  className={`${inputClassName} resize-none`}
                />
              </Field>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  className={primaryButtonClassName}
                >
                  {modalMode === "edit" ? "Save Changes" : "Create Connection"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className={secondaryButtonClassName}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
        {required ? <span className="text-[var(--accent)]">Required</span> : null}
      </span>
      {children}
      {hint ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{hint}</p> : null}
    </label>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

const inputClassName =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]";

const primaryButtonClassName =
  "rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]";

const secondaryButtonClassName =
  "rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]";

const dangerButtonClassName =
  "rounded-lg bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--danger-hover)]";
