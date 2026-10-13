"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { classes, type CourseKey } from "@/lib/courses";
import { relativeTime } from "@/lib/progress";
import {
  deleteConversation,
  listConversations,
  renameConversation,
  type ConversationSummary,
} from "@/lib/cloud";
import { useDialog } from "./useDialog";

const MODE_LABEL: Record<ConversationSummary["mode"], string> = {
  tutor: "Socratic Tutor",
  checker: "Solution Checker",
  teach: "Teach the Tutor",
};

interface Group {
  key: string;
  label: string;
  items: ConversationSummary[];
}

// Most recent first, grouped by course + unit. Groups are ordered by their newest chat.
function groupChats(chats: ConversationSummary[]): Group[] {
  const groups = new Map<string, Group>();
  for (const c of chats) {
    const key = `${c.course}|${c.unit_id}`;
    let g = groups.get(key);
    if (!g) {
      const course = classes[c.course as CourseKey];
      const unit = course?.units.find((u) => u.id === c.unit_id);
      const label = course ? `${course.title} · ${unit?.title ?? c.unit_id}` : c.course;
      g = { key, label, items: [] };
      groups.set(key, g);
    }
    g.items.push(c);
  }
  return [...groups.values()];
}

interface Props {
  open: boolean;
  onClose: () => void;
  email: string;
  activeId: string | null;
  onOpenChat: (c: ConversationSummary) => Promise<void>;
  onDeleted: (id: string) => void;
}

// Slide-over listing the student's saved chats: open one to resume it, or
// rename / delete it. Reloads the list every time it opens.
export function HistoryPanel({ open, onClose, email, activeId, onOpenChat, onDeleted }: Props) {
  const ref = useDialog(open, onClose);
  const [chats, setChats] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listConversations().then(
      (list) => {
        if (cancelled) return;
        setChats(list);
        setError(null);
      },
      (err: Error) => {
        if (!cancelled) setError(err.message);
      },
    );
    return () => {
      cancelled = true;
      setRenaming(null);
      setConfirmDelete(null);
    };
  }, [open]);

  async function openChat(c: ConversationSummary) {
    setOpening(c.id);
    try {
      await onOpenChat(c);
    } finally {
      setOpening(null);
    }
  }

  async function saveRename() {
    if (!renaming) return;
    const title = renaming.draft.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!title) return;
    try {
      await renameConversation(renaming.id, title);
      setChats((list) => list?.map((c) => (c.id === renaming.id ? { ...c, title } : c)) ?? null);
      setRenaming(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename that chat.");
    }
  }

  async function remove(id: string) {
    try {
      await deleteConversation(id);
      setChats((list) => list?.filter((c) => c.id !== id) ?? null);
      setConfirmDelete(null);
      onDeleted(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that chat.");
    }
  }

  const groups = chats ? groupChats(chats) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.aside
            ref={ref}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            tabIndex={-1}
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="drawer-head">
              <h2 id="history-title">Your chats</h2>
              <button type="button" className="header-icon-btn" onClick={onClose} aria-label="Close chat history">
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="drawer-body">
              {error && <p className="quiz-error">{error}</p>}
              {!chats && !error && (
                <div className="drawer-empty">
                  <span className="quiz-spinner" />
                  <p>Loading your chats...</p>
                </div>
              )}
              {chats && chats.length === 0 && (
                <div className="drawer-empty">
                  <p>No saved chats yet.</p>
                  <p className="drawer-empty-sub">
                    Every conversation with the tutor is saved here automatically, so you can come
                    back to it on any device.
                  </p>
                </div>
              )}

              {groups.map((g) => (
                <section key={g.key} className="history-group" aria-label={g.label}>
                  <h3 className="history-group-title">{g.label}</h3>
                  <ul className="history-list">
                    {g.items.map((c) => (
                      <li key={c.id} className={"history-item" + (c.id === activeId ? " active" : "")}>
                        {renaming?.id === c.id ? (
                          <form
                            className="history-rename"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void saveRename();
                            }}
                          >
                            <input
                              className="auth-input"
                              aria-label="Chat name"
                              value={renaming.draft}
                              maxLength={120}
                              onChange={(e) => setRenaming({ id: c.id, draft: e.target.value })}
                              onKeyDown={(e) => {
                                // Escape cancels the rename instead of closing the drawer.
                                if (e.key === "Escape") {
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();
                                  setRenaming(null);
                                }
                              }}
                            />
                            <button type="submit" className="history-action primary">
                              Save
                            </button>
                            <button type="button" className="history-action" onClick={() => setRenaming(null)}>
                              Cancel
                            </button>
                          </form>
                        ) : confirmDelete === c.id ? (
                          <div className="history-confirm" role="group" aria-label="Confirm delete">
                            <span>Delete &ldquo;{c.title}&rdquo;?</span>
                            <button type="button" className="history-action danger" onClick={() => void remove(c.id)}>
                              Delete
                            </button>
                            <button type="button" className="history-action" onClick={() => setConfirmDelete(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="history-open"
                              onClick={() => void openChat(c)}
                              disabled={opening !== null}
                              aria-current={c.id === activeId ? "true" : undefined}
                            >
                              <span className="history-title">{c.title}</span>
                              <span className="history-meta">
                                {opening === c.id
                                  ? "Opening..."
                                  : `${MODE_LABEL[c.mode]} · ${relativeTime(Date.parse(c.updated_at))}`}
                              </span>
                            </button>
                            <div className="history-actions">
                              <button
                                type="button"
                                className="history-action"
                                onClick={() => setRenaming({ id: c.id, draft: c.title })}
                                aria-label={`Rename "${c.title}"`}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                className="history-action"
                                onClick={() => setConfirmDelete(c.id)}
                                aria-label={`Delete "${c.title}"`}
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="drawer-foot">Signed in as {email}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
