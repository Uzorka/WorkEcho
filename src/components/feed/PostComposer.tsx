"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { searchCompanies, type PostFormState } from "@/app/posts/actions";

import { buttonClass, inputClass } from "@/components/styles";
import { POST_CATEGORIES, POST_MAX } from "@/lib/posts";

type Company = { id: string; name: string; slug: string };

export function PostComposer({
  action,
  initial,
  editing = false,
}: {
  action: (prev: PostFormState, formData: FormData) => Promise<PostFormState>;
  initial: { category?: string; body?: string; company?: Company | null };
  editing?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {} as PostFormState);
  const [body, setBody] = useState(initial.body ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [company, setCompany] = useState<Company | null>(initial.company ?? null);
  const e = state.errors ?? {};
  const over = body.length > POST_MAX;

  // Keep what was typed if the server sends the form back with errors.
  useEffect(() => {
    if (state.values) {
      setBody(state.values.body ?? "");
      setCategory(state.values.category ?? "");
    }
  }, [state]);

  return (
    // Submitted by hand (not via the action prop) so React doesn't reset the
    // controlled fields after a validation error.
    <form
      onSubmit={(ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      {state.message && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {state.message}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="post-category" className="font-medium">
          Category
        </label>
        <select
          id="post-category"
          name="category"
          value={category}
          onChange={(ev) => setCategory(ev.target.value)}
          className={inputClass}
          aria-invalid={e.category ? true : undefined}
          aria-describedby={e.category ? "post-category-error" : undefined}
        >
          <option value="" disabled>
            Choose a category
          </option>
          {Object.entries(POST_CATEGORIES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        {e.category && (
          <p id="post-category-error" className="text-sm text-danger">
            {e.category}
          </p>
        )}
      </div>

      {editing ? (
        company && <p className="text-sm text-muted">About {company.name}</p>
      ) : (
        <CompanyPicker value={company} onChange={setCompany} error={e.company_id} />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="post-body" className="font-medium">
          Your post
        </label>
        <p id="post-body-hint" className="text-sm text-muted">
          Shown with your pseudonym. We protect your identity, but what you write can still reveal you. No phone numbers, emails or
          names of individuals.
        </p>
        <textarea
          id="post-body"
          name="body"
          rows={6}
          value={body}
          onChange={(ev) => setBody(ev.target.value)}
          className={`${inputClass} min-h-36 py-2`}
          aria-invalid={e.body || over ? true : undefined}
          aria-describedby={`post-body-hint post-body-count${e.body ? " post-body-error" : ""}`}
        />
        <p id="post-body-count" className={`text-xs ${over ? "font-semibold text-danger" : "text-muted"}`} aria-live="polite">
          {body.length.toLocaleString("en-NG")} / {POST_MAX.toLocaleString("en-NG")}
          {over ? ` — ${(body.length - POST_MAX).toLocaleString("en-NG")} too many` : ""}
        </p>
        {e.body && (
          <p id="post-body-error" className="text-sm text-danger">
            {e.body}
          </p>
        )}
      </div>
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? (editing ? "Saving…" : "Posting…") : editing ? "Save changes" : "Post"}
      </button>
    </form>
  );
}

function CompanyPicker({ value, onChange, error }: { value: Company | null; onChange: (c: Company | null) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setResults(await searchCompanies(q));
      } catch {
        setResults([]);
      }
      setSearched(true);
    }, 250);
  }, [q]);

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name="company_id" value={value?.id ?? ""} />
      {value ? (
        <>
          <span className="font-medium">Company (optional)</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary">{value.name}</span>
            <button type="button" onClick={() => onChange(null)} className="min-h-11 px-2 text-sm font-medium text-primary underline">
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <label htmlFor="post-company" className="font-medium">
            Company <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="post-company"
            type="search"
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder="Search to tag a company"
            autoComplete="off"
            className={inputClass}
            aria-describedby="post-company-results"
          />
          <div id="post-company-results" aria-live="polite">
            {results.length > 0 ? (
              <ul className="flex flex-col gap-1" aria-label="Matching companies">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(c);
                        setQ("");
                      }}
                      className="flex min-h-11 w-full items-center rounded-xl border border-border px-3 text-left hover:bg-primary-soft"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              searched && <p className="text-sm text-muted">No company found. You can post without one.</p>
            )}
          </div>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
