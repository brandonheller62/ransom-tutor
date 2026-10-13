"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deleteMyAccount } from "@/lib/cloud";
import { useDialog } from "./useDialog";

const CONFIRM_WORD = "DELETE";

interface Props {
  open: boolean;
  email: string;
  onClose: () => void;
  onDeleted: () => void;
}

// Confirmation step for permanent account deletion. The delete button stays
// disabled until the student types DELETE, so a stray click can't do it.
export function DeleteAccountDialog({ open, email, onClose, onDeleted }: Props) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return; // don't abandon a deletion halfway through
    setTyped("");
    setError(null);
    onClose();
  }
  const ref = useDialog(open, close);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
      onDeleted();
    } catch (err) {
      setError(
        `Your account could not be deleted. ${err instanceof Error ? err.message : ""}`.trim(),
      );
      setBusy(false);
    }
  }

  const ready = typed.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <motion.div
            ref={ref}
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-desc"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
          >
            <h3 id="delete-account-title">Delete your account?</h3>
            <div id="delete-account-desc">
              <p className="modal-sub">
                This permanently deletes <strong>{email}</strong> and everything saved with it:
              </p>
              <ul className="delete-list">
                <li>All your saved chats and attached photos</li>
                <li>Your progress, mastery scores, streak, and weekly goal</li>
                <li>Your sign-in, so you&apos;ll need to create a new account to come back</li>
              </ul>
              <p className="delete-warning">This can&apos;t be undone.</p>
            </div>
            <label className="auth-label" htmlFor="delete-confirm">
              Type {CONFIRM_WORD} to confirm
            </label>
            <input
              id="delete-confirm"
              className="auth-input"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={typed}
              disabled={busy}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ready && !busy) void confirm();
              }}
            />
            <div role="alert" aria-live="assertive">
              {error && <p className="auth-error">{error}</p>}
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button className="modal-btn danger" onClick={() => void confirm()} disabled={!ready || busy}>
                {busy ? "Deleting..." : "Delete my account"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
