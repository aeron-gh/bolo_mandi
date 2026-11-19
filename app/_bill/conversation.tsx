"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons.tsx";

export type Message = { author: "owner" | "bolo"; text: string };

export function Conversation({ messages, reply, words, onReplay, onExample, disabled, children }: {
  messages: Message[];
  reply: string | null;
  words: string;
  onReplay: (() => void) | null;
  onExample: (text: string) => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const feed = useRef<HTMLDivElement>(null);
  const welcome = !messages.length && !reply;
  useEffect(() => {
    const view = feed.current;
    if (view) view.scrollTop = view.scrollHeight;
  }, [messages, reply, words]);

  return (
    <div className={welcome ? "chat-body welcome" : "chat-body in-session"}>
      <div ref={feed} className="message-feed" role="log" aria-label="Conversation">
        {messages.map((message, i) => <Bubble key={i} {...message} />)}
        {reply && <Bubble author="bolo" text={reply} onReplay={onReplay} />}
        {!welcome && words && <p className="interim">{words}</p>}
      </div>
      <div className="voice-stage">
        {children}
      </div>
      {welcome && <div className="welcome-copy">
        <h2>Namaste, Aarav<span>.</span></h2>
        <p>{words || "Aaj kis ka bill banayein? Bolo ya neeche likho."}</p>
        <div className="suggestions">
          <button disabled={disabled} onClick={() => onExample("Aaj kitni sale hui?")}><Icon name="chart" />Aaj ki sale<Icon name="arrow" /></button>
          <button disabled={disabled} onClick={() => onExample("Vikas ka hisaab batao")}><Icon name="book" />Vikas ka hisaab<Icon name="arrow" /></button>
        </div>
      </div>}
    </div>
  );
}

function Bubble({ author, text, onReplay }: Message & { onReplay?: (() => void) | null }) {
  return (
    <article className={`chat-message ${author}`}>
      {author === "bolo" && <span aria-hidden className="reply-mark"><Icon name="sound" /></span>}
      <div className="bubble">
        <span className="sr-only">{author === "owner" ? "Aap" : "Bolo"} </span>
        <p>{text}</p>
        {onReplay && <button type="button" onClick={onReplay} className="replay"><Icon name="speaker" />Phir suno</button>}
      </div>
    </article>
  );
}
