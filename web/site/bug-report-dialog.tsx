// SPDX-License-Identifier: MIT
import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { BugDiagnostics, BugSubmission } from "../../shared/bug-report";
import {
  isBackdropPointer,
  useMenuScrollLock,
} from "../dice-demo-v2/dialog-lifecycle";
import "./bug-report.css";
export type BugDraft = { id: string; diagnostics: BugDiagnostics };
export function BugReportDialog({
  draft,
  onClose,
}: {
  draft: BugDraft | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId(),
    submitting = useRef(false);
  const [description, setDescription] = useState(""),
    [contact, setContact] = useState(""),
    [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [receipt, setReceipt] = useState("");
  // Retry the identical payload after an ambiguous response, so it cannot create another report.
  const attempted = useRef<BugSubmission | null>(null);
  useMenuScrollLock(!!draft);
  useEffect(() => {
    if (!draft) return;
    setDescription("");
    setContact("");
    setIncludeDiagnostics(true);
    setError("");
    setReceipt("");
    attempted.current = null;
    ref.current?.showModal();
    ref.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    return () => ref.current?.close();
  }, [draft]);
  function close() {
    if (submitting.current) return;
    ref.current?.close();
    onClose();
  }
  function payload(): BugSubmission {
    return (
      attempted.current ?? {
        id: draft!.id,
        description: description.trim(),
        contact: contact.trim(),
        diagnostics: includeDiagnostics ? draft!.diagnostics : null,
        website: "",
      }
    );
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !draft || !description.trim()) return;
    const value = payload();
    attempted.current = value;
    submitting.current = true;
    setPending(true);
    setError("");
    const abort = new AbortController(),
      timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
        signal: abort.signal,
      });
      const result = await response.json();
      if (!response.ok || result.saved !== true || result.id !== value.id) {
        // These statuses prove rejection; the user can correct their payload.
        if ([400, 403, 429].includes(response.status)) attempted.current = null;
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Your report was not saved. Please retry.",
        );
      }
      setReceipt(result.id);
    } catch (reason) {
      setError(
        reason instanceof Error && reason.name !== "AbortError"
          ? reason.message
          : "Could not confirm your report was saved. Retry sends the same report.",
      );
    } finally {
      clearTimeout(timeout);
      submitting.current = false;
      setPending(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload(), null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clickclacks-bug-${draft!.id}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <dialog
      ref={ref}
      className="bug-report-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onPointerDown={(e) => {
        if (isBackdropPointer(e)) close();
      }}
    >
      <header>
        <h2 id={`${id}-title`}>Report a bug</h2>
        <button
          type="button"
          aria-label="Close bug report"
          disabled={pending}
          onClick={close}
        >
          <X aria-hidden />
        </button>
      </header>
      {receipt ? (
        <div role="status">
          <p>Thanks—your report was saved.</p>
          <p className="bug-report-hint">
            Report ID: <code>{receipt}</code>
          </p>
          <button type="button" className="bug-report-submit" onClick={close}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={send}>
          <fieldset disabled={pending || !!attempted.current}>
            <label htmlFor={`${id}-description`}>What went wrong?</label>
            <textarea
              id={`${id}-description`}
              required
              maxLength={4000}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue and what you were doing."
              autoFocus
            />
            <label htmlFor={`${id}-contact`}>
              Contact info <span>(optional)</span>
            </label>
            <input
              id={`${id}-contact`}
              type="text"
              maxLength={300}
              autoComplete="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email or another way to reach you"
              aria-describedby={`${id}-contact-note`}
            />
            <p className="bug-report-hint" id={`${id}-contact-note`}>
              Only if you’d like us to follow up.
            </p>
            <label className="bug-report-check">
              <input
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
              />
              Include app and browser diagnostics
            </label>
            <p className="bug-report-hint">
              Reports are private to maintainers. Diagnostics include app
              settings, browser/device details, timezone and approximate
              country/region. Room codes, names and credentials are excluded.
            </p>
          </fieldset>
          {includeDiagnostics && draft && (
            <details>
              <summary>View diagnostics</summary>
              <pre>{JSON.stringify(draft.diagnostics, null, 2)}</pre>
            </details>
          )}
          {error && (
            <p role="alert" className="bug-report-error">
              {error}
            </p>
          )}
          {attempted.current && !pending && error && (
            <p className="bug-report-hint">
              Retry sends your original report. Download keeps a local copy.
            </p>
          )}
          <footer>
            <button type="button" onClick={close} disabled={pending}>
              Cancel
            </button>
            {error && (
              <button type="button" onClick={download} disabled={pending}>
                Download report
              </button>
            )}
            <button
              className="bug-report-submit"
              type="submit"
              disabled={pending || !description.trim()}
            >
              {pending
                ? "Sending…"
                : attempted.current
                  ? "Retry"
                  : "Send report"}
            </button>
          </footer>
        </form>
      )}
    </dialog>
  );
}
