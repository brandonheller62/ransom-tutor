"use client";

import { useEffect, useRef } from "react";

const DIALOG_FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// Dialog behavior a styled overlay doesn't give on its own: focus moves in on
// open, Tab stays inside, Escape closes, and focus returns to the opener.
// Don't put autoFocus inside a dialog: React applies it before this effect runs,
// so the effect would record the dialog's own input as the opener.
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    const items = () => (node ? [...node.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE)] : []);
    if (node && !node.contains(document.activeElement)) (items()[0] ?? node).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const list = items();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  return ref;
}
