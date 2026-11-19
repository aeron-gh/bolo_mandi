"use client";
import { useEffect, useRef } from "react";

export type Message = { author: "owner" | "bolo"; text: string };

export function Conversation({ messages, reply, words, onReplay, onExample, disabled }: {
  messages: Message[];
  reply: string | null;
  words: string;
  onReplay: (() => void) | null;
  onExample: (text: string) => void;
  disabled: boolean;
}) {
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const view = feed.current;
    if (view) view.scrollTop = view.scrollHeight;
  }, [messages, reply, words]);

  return (
    <div ref={feed} className="min-h-48 flex-1 space-y-4 overflow-y-auto px-1 py-3 sm:px-4">
      {messages.length === 0 && !reply && !words && (
        <div className="mx-auto flex h-full max-w-md flex-col justify-center px-3 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-[#243651] sm:text-4xl">Aaj kya bill banayein?</h2>
          <p className="mt-2 text-sm text-[#52627b] sm:text-base">Daba ke bolo, ya bill aur khata ka sawaal likho.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Aaj kitni sale hui?", "Vikas ka hisaab batao"].map((text) => (
              <button key={text} type="button" onClick={() => onExample(text)} disabled={disabled}
                className="rounded-xl border border-[#d6e0ec] bg-white/70 px-3 py-2 text-sm font-medium text-[#304761] hover:bg-white disabled:opacity-50">
                {text}
              </button>
            ))}
          </div>
        </div>
      )}
      <div role="log" aria-label="Conversation" className="space-y-4">
        {messages.map((message, i) => <Bubble key={i} {...message} />)}
        {reply && <Bubble author="bolo" text={reply} onReplay={onReplay} />}
      </div>
      {words && <p className="ml-auto max-w-[90%] wrap-anywhere rounded-2xl border border-[#cfd9e8] bg-white/70 px-4 py-2 text-sm text-[#4a5e78]">{words}</p>}
    </div>
  );
}

function Bubble({ author, text, onReplay }: Message & { onReplay?: (() => void) | null }) {
  return (
    <article className={`flex items-start gap-2 ${author === "owner" ? "justify-end" : ""}`}>
      {author === "bolo" && <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#e1ecf4] text-xs font-bold text-[#294967]">B</span>}
      <div className={`max-w-[85%] wrap-anywhere rounded-2xl px-4 py-3 text-sm sm:text-base ${author === "owner" ? "rounded-tr-md bg-[#253953] text-white" : "rounded-tl-md border border-white bg-white/85 text-[#253953] shadow-sm"}`}>
        <span className="sr-only">{author === "owner" ? "Aap" : "Bolo"} </span>
        <p>{text}</p>
        {onReplay && <button type="button" onClick={onReplay} className="mt-2 rounded-md text-sm font-semibold text-[#365b84] hover:underline">Phir suno</button>}
      </div>
    </article>
  );
}
