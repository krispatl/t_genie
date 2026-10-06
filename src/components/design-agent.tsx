"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { z } from "zod";
import { colors, type Design } from "@/lib/catalog";
import {
  conversationMessageSchema,
  type AgentReply,
  type ConversationMessage,
  type DesignBrief,
  type GenerationPlan,
} from "@/lib/design-agent";

const greeting: ConversationMessage = {
  role: "assistant",
  content:
    "Hey, I’m Genie. Tell me the idea in your head, and we’ll turn it into something you can wear. I’ll help with the artwork, the style, and all the little details. What are you imagining?",
};
const starters = [
  "A dragon rapping on stage",
  "Help me find an idea",
  "Design a gift for a friend",
];
type Props = {
  brief: DesignBrief;
  design: Design;
  concepts: Design[];
  enabled: boolean;
  generating: boolean;
  completed: number;
  expected: number;
  elapsed: number;
  generationError: string;
  onApply: (reply: AgentReply) => void;
  onGenerate: (
    brief: DesignBrief,
    plan: GenerationPlan,
    selectedId: string | null,
  ) => Promise<{ count: number; error?: string }>;
  onStopGeneration: () => void;
  onBriefChange: (prompt: string) => void;
};

export default function DesignAgent(props: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>([greeting]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [changes, setChanges] = useState<string[]>([]);
  const [failedHistory, setFailedHistory] = useState<
    ConversationMessage[] | null
  >(null);
  const [ready, setReady] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const chat = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const context = useRef(props);
  context.current = props;
  const disabled = thinking || props.generating;
  useEffect(() => {
    try {
      const raw = localStorage.getItem("t-genie-conversation-v2");
      if (raw) {
        const saved = z
          .array(conversationMessageSchema)
          .min(1)
          .max(40)
          .safeParse(JSON.parse(raw));
        if (saved.success) setMessages(saved.data);
      }
    } catch {
      setStorageFailed(true);
    }
    setReady(true);
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        "t-genie-conversation-v2",
        JSON.stringify(messages.slice(-40)),
      );
    } catch {
      setStorageFailed(true);
    }
  }, [messages, ready]);
  useEffect(() => {
    if (chat.current) chat.current.scrollTop = chat.current.scrollHeight;
  }, [messages, thinking, changes]);

  async function runTurn(history: ConversationMessage[]) {
    if (sending.current || props.generating) return;
    if (!props.enabled) {
      setError(
        "Genie isn’t connected yet. The studio owner needs to configure the OpenAI key. Your message is saved here.",
      );
      setFailedHistory(history);
      return;
    }
    sending.current = true;
    setThinking(true);
    setError("");
    setChanges([]);
    setFailedHistory(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const live = context.current;
      const knownConcepts = [...live.concepts];
      if (!knownConcepts.some((item) => item.id === live.design.id))
        knownConcepts.push(live.design);
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: history.slice(-24),
          brief: live.brief,
          selectedId: live.design.id,
          concepts: knownConcepts.map(({ id, name, prompt, source }) => ({
            id,
            name,
            prompt,
            source,
          })),
        }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Genie couldn’t reply. Please retry.");
      }
      const reply = result as AgentReply;
      if (
        JSON.stringify(context.current.brief) !== JSON.stringify(live.brief) ||
        context.current.design.id !== live.design.id
      )
        throw new Error(
          "Your design changed while Genie was replying. Retry to use your latest settings.",
        );
      context.current.onApply(reply);
      setChanges(reply.changes);
      setMessages(
        (current) =>
          [...current, { role: "assistant", content: reply.reply }].slice(
            -40,
          ) as ConversationMessage[],
      );
      if (reply.generation) {
        // The text reply can finish while the image job runs; the composer remains
        // disabled until it finishes so further turns see the completed result.
        setThinking(false);
        const outcome = await context.current.onGenerate(
          reply.brief,
          reply.generation,
          reply.selectedId,
        );
        const text =
          outcome.count > 0
            ? `${reply.generation.mode === "refine" ? "Your refined artwork is" : `${outcome.count} new concept${outcome.count === 1 ? " is" : "s are"}`} ready in the preview. Choose a favorite, or tell me what you’d like to change.${outcome.error ? " Some concepts could not be completed." : ""}`
            : `The artwork job didn’t complete. ${outcome.error || "Please try again."} Your design brief is saved.`;
        setMessages(
          (current) =>
            [...current, { role: "assistant", content: text }].slice(
              -40,
            ) as ConversationMessage[],
        );
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError")
        setError("Message stopped. Your design hasn’t changed.");
      else
        setError(
          e instanceof Error
            ? e.message
            : "Genie couldn’t reply. Please retry.",
        );
      setFailedHistory(history);
    } finally {
      sending.current = false;
      setThinking(false);
      abort.current = null;
    }
  }
  function send(text: string) {
    if (!text.trim() || disabled) return;
    const history = [
      ...messages,
      { role: "user" as const, content: text.trim() },
    ].slice(-40);
    setMessages(history);
    setDraft("");
    void runTurn(history);
  }
  const hasConversation = messages.some((message) => message.role === "user");
  return (
    <aside className="idea-panel agent-panel">
      <div className="agent-heading">
        <div className="agent-avatar">
          <Sparkles size={22} />
          <span />
        </div>
        <div>
          <h2>Meet your design Genie.</h2>
          <p>Your idea. A conversation. Something yours.</p>
        </div>
        <button
          className="icon-button"
          disabled={disabled}
          aria-label="New conversation"
          title="New conversation"
          onClick={() => {
            setMessages([greeting]);
            setChanges([]);
            setError("");
            setFailedHistory(null);
            setDraft("");
            composer.current?.focus();
          }}
        >
          <Plus size={17} />
        </button>
      </div>
      <div
        ref={chat}
        className="agent-conversation"
        role="log"
        aria-label="Conversation with Genie"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <div className="conversation-date">YOUR NEXT FAVORITE STARTS HERE</div>
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            <span className="message-author">
              {message.role === "assistant" ? (
                <>
                  <span>✦</span> GENIE
                </>
              ) : (
                "YOU"
              )}
            </span>
            <p>{message.content}</p>
          </div>
        ))}
        {thinking && (
          <div className="agent-thinking" role="status">
            <span />
            <span />
            <span />
            <p>Genie is working on your idea</p>
          </div>
        )}
      </div>
      {changes.length > 0 && (
        <div className="agent-changes" aria-label="Applied design changes">
          {changes.slice(0, 4).map((change) => (
            <span key={change}>
              <Check size={11} />
              {change}
            </span>
          ))}
        </div>
      )}
      {!hasConversation && (
        <div className="chat-starters">
          {starters.map((text) => (
            <button key={text} onClick={() => send(text)} disabled={disabled}>
              {text}
              <ArrowRight size={12} />
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="inline-error agent-error" role="alert">
          <p>{error}</p>
          {failedHistory && (
            <button
              className="retry-message"
              onClick={() => void runTurn(failedHistory)}
              disabled={disabled}
            >
              Retry message <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}
      <form
        className="agent-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <label htmlFor="genie-message" className="sr-only">
          Message Genie
        </label>
        <textarea
          ref={composer}
          id="genie-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            hasConversation
              ? "Tell Genie what you’d like to change…"
              : "Tell me what you’re imagining…"
          }
          maxLength={1600}
          disabled={disabled}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send(draft);
            }
          }}
        />
        <div className="composer-footer">
          <span>
            <MessageCircle size={12} /> Let’s design it together
          </span>
          <button
            type="submit"
            aria-label="Send message to Genie"
            disabled={disabled || !draft.trim()}
          >
            {thinking ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Send size={17} />
            )}
          </button>
        </div>
      </form>
      <p className="chat-privacy">
        {storageFailed
          ? "Chat stays in this tab; browser saving is unavailable."
          : "Conversation saved in this browser · Replies powered by OpenAI"}
      </p>
      <details className="agent-brief">
        <summary>
          <span>
            <Sparkles size={14} /> Your design brief
          </span>
          <ChevronDown size={14} />
        </summary>
        <label htmlFor="agent-artwork-brief">Artwork direction</label>
        <textarea
          id="agent-artwork-brief"
          value={props.brief.prompt}
          maxLength={1600}
          onChange={(e) => props.onBriefChange(e.target.value)}
          disabled={disabled}
          placeholder="Your artwork idea takes shape as you chat."
        />
        <div className="brief-tags">
          <span>{props.brief.garment === "hoodie" ? "Hoodie" : "T-shirt"}</span>
          <span>{colors[props.brief.color].name}</span>
          <span>{props.brief.placement} print</span>
          <span>{props.brief.style}</span>
        </div>
      </details>
      <button
        className="primary generate-button"
        disabled={disabled || props.brief.prompt.trim().length < 8}
        onClick={() =>
          send("Generate four concepts from our current design brief.")
        }
      >
        <WandSparkles size={17} />
        {props.generating
          ? "Bringing your idea to life…"
          : "Generate our design"}
        <ArrowRight size={16} />
      </button>
      {props.generating && (
        <>
          <div className="generation-caption">
            <span>
              {props.completed}/{props.expected} concepts · {props.elapsed}s
            </span>
            <button onClick={props.onStopGeneration}>Stop</button>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${Math.max(8, (props.completed / props.expected) * 100)}%`,
              }}
            />
          </div>
        </>
      )}
      {props.generationError && !props.generating && (
        <p className="agent-generation-error" role="status">
          {props.generationError}
        </p>
      )}
    </aside>
  );
}
