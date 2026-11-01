"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUESTION_LIMIT, recentHistory, type ChatMessage } from "@/lib/ask-ai/shared";

export function AskAIChat({ videoId, signedIn }: { videoId: string | null; signedIn: boolean }) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = React.useState<string | null>(null);
  const controller = React.useRef<AbortController | null>(null);
  const scroll = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => () => controller.current?.abort(), []);
  React.useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, pending, error]);

  async function send(retry = false) {
    const question = retry ? failedQuestion : draft.trim();
    if (controller.current || !signedIn || !question || question.length > QUESTION_LIMIT) return;
    const history = retry ? messages.slice(0, -1) : messages;
    const abort = new AbortController();
    controller.current = abort;
    setPending(true);
    setError(null);
    if (!retry) {
      setMessages([...history, { role: "user", content: question }]);
      setDraft("");
    }
    setFailedQuestion(question);
    const timer = setTimeout(() => abort.abort(), 45000);
    try {
      const response = await fetch("/api/ask-ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, question, history: recentHistory(history) }), signal: abort.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not get an answer. Please try again.");
      if (typeof body.answer !== "string" || !body.answer.trim()) throw new Error("The answer was empty. Please try again.");
      setMessages([...history, { role: "user", content: question }, { role: "assistant", content: body.answer }]);
      setFailedQuestion(null);
    } catch (cause) {
      setError(abort.signal.aborted ? "The request timed out. Please try again." : cause instanceof Error ? cause.message : "Connection failed. Please try again.");
    } finally {
      clearTimeout(timer);
      controller.current = null;
      setPending(false);
    }
  }

  return (
    <div className="flex h-[min(32rem,65dvh)] min-h-64 flex-col lg:h-full lg:min-h-0">
      <div ref={scroll} role="log" aria-label="Ask AI conversation" aria-live="polite" aria-busy={pending} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-3">
        {messages.length === 0 && <p className="text-sm text-muted-foreground">Ask about vocabulary, grammar, or the video you are watching.</p>}
        {messages.map((message, index) => (
          <div key={index} className={`w-fit max-w-[95%] rounded-xl px-3 py-2 text-sm ${message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
            <p className="mb-1 text-xs font-semibold">{message.role === "user" ? "You" : "Ask AI"}</p>
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
          </div>
        ))}
        {pending && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Thinking…</p>}
        {error && <div role="alert" className="space-y-2 text-sm"><p>{error}</p><Button type="button" variant="outline" size="sm" onClick={() => void send(true)} disabled={pending}>Retry</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setMessages(messages.slice(0, -1)); setDraft(failedQuestion ?? ""); setFailedQuestion(null); setError(null); }}>Edit question</Button></div>}
      </div>
      <form className="shrink-0 space-y-2 border-t pt-3" onSubmit={event => { event.preventDefault(); void send(); }}>
        {!signedIn && <p className="text-sm text-muted-foreground">Please sign in to use Ask AI.</p>}
        <label htmlFor="ask-ai-question" className="sr-only">Your question for Ask AI</label>
        <textarea id="ask-ai-question" value={draft} onChange={event => setDraft(event.target.value)} maxLength={QUESTION_LIMIT} rows={2} disabled={!signedIn || pending || !!failedQuestion} placeholder="Ask a question…" className="block max-h-32 min-h-16 w-full resize-y rounded-md border bg-background px-3 py-2 text-base disabled:opacity-50 sm:text-sm" onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void send(); }
        }} />
        <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{draft.length}/{QUESTION_LIMIT} · Shift+Enter for a new line</span><Button type="submit" size="sm" disabled={!signedIn || pending || !!failedQuestion || !draft.trim()}><Send className="size-4" aria-hidden="true" />Send</Button></div>
      </form>
    </div>
  );
}
