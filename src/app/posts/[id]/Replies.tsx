"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Avatar } from "@/components/feed/Avatar";
import { TimeAgo } from "@/components/feed/TimeAgo";
import { SubmitButton } from "@/components/forms";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/styles";
import { REPLY_MAX, type PublicReply } from "@/lib/posts";
import { createReply, deleteReply, updateReply, type PostFormState } from "../actions";

const small = "inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-medium text-muted hover:bg-primary-soft hover:text-text";

function BodyField({ id, defaultValue, error, label }: { id: string; defaultValue?: string; error?: string; label: string }) {
  const [len, setLen] = useState(defaultValue?.length ?? 0);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name="body"
        rows={3}
        defaultValue={defaultValue}
        onChange={(e) => setLen(e.target.value.length)}
        className={`${inputClass} min-h-24 py-2`}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-count${error ? ` ${id}-error` : ""}`}
      />
      <p id={`${id}-count`} className={`text-xs ${len > REPLY_MAX ? "font-semibold text-danger" : "text-muted"}`}>
        {len} / {REPLY_MAX}
      </p>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ReplyForm({ postId }: { postId: string }) {
  type State = PostFormState & { nonce?: number };
  const [state, action] = useActionState(async (prev: State, fd: FormData): Promise<State> => {
    const res = await createReply(postId, prev, fd);
    return res.success ? { ...res, nonce: Date.now() } : res;
  }, {} as State);
  return (
    // key: a fresh (empty) box after each successful reply; keep the text after an error.
    <form key={state.nonce ?? "reply"} action={action} className="flex flex-col gap-3" noValidate>
      {state.message && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm">
          {state.success}
        </p>
      )}
      <BodyField id="reply-body" label="Write a reply" defaultValue={state.success ? "" : state.values?.body} error={state.errors?.body} />
      <SubmitButton className={`${buttonClass} self-start`} pendingText="Replying…">
        Reply
      </SubmitButton>
    </form>
  );
}

function EditReply({ reply, onDone }: { reply: PublicReply; onDone: () => void }) {
  const [state, action] = useActionState(async (prev: PostFormState, fd: FormData) => {
    const res = await updateReply(reply.id, reply.post_id, prev, fd);
    if (res.success) onDone();
    return res;
  }, {} as PostFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state.message && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      <BodyField id={`edit-${reply.id}`} label="Edit your reply" defaultValue={state.values?.body ?? reply.body} error={state.errors?.body} />
      <div className="flex gap-2">
        <SubmitButton className={buttonClass} pendingText="Saving…">
          Save
        </SubmitButton>
        <button type="button" onClick={onDone} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ReplyItem({ reply }: { reply: PublicReply }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  if (deleted) return null;

  return (
    <li className="flex gap-3 border-b border-border py-3 last:border-0">
      <Avatar pseudonym={reply.author_pseudonym} size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm">
          <span className="font-semibold break-all">{reply.author_pseudonym}</span>
          {reply.is_mine && <span className="ml-1 text-xs text-muted">(you)</span>}
          <span className="text-muted">
            {" "}
            · <TimeAgo iso={reply.created_at} />
            {reply.edited_at && " · edited"}
          </span>
        </p>
        {editing ? (
          <EditReply reply={reply} onDone={() => setEditing(false)} />
        ) : (
          <p className="whitespace-pre-line break-words">{reply.body}</p>
        )}
        {reply.is_mine && !editing && (
          <div className="-mx-2 flex flex-wrap items-center">
            <button type="button" className={small} onClick={() => setEditing(true)}>
              Edit
            </button>
            {confirming ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  className={`${small} text-danger`}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await deleteReply(reply.id, reply.post_id).catch(() => ({ ok: false }));
                      if (res.ok) setDeleted(true);
                      else setError(true);
                    })
                  }
                >
                  {pending ? "Deleting…" : "Yes, delete"}
                </button>
                <button type="button" className={small} onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className={small} onClick={() => setConfirming(true)}>
                Delete
              </button>
            )}
            {error && (
              <span role="alert" className="text-xs text-danger">
                Couldn&apos;t delete.
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function ReplyList({ replies }: { replies: PublicReply[] }) {
  if (replies.length === 0) return <p className="text-sm text-muted">No replies yet. Be the first.</p>;
  return (
    <ul className="flex flex-col">
      {replies.map((r) => (
        <ReplyItem key={`${r.id}-${r.edited_at}`} reply={r} />
      ))}
    </ul>
  );
}

export function LoginToReply({ postId }: { postId: string }) {
  return (
    <Link href={`/login?next=${encodeURIComponent(`/posts/${postId}`)}`} className={`${secondaryButtonClass} self-start`}>
      Log in to reply
    </Link>
  );
}
