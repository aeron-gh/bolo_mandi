"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons.tsx";

export type Message = { author: "owner" | "bolo"; text: string };

export function Conversation({ messages, reply, words, onReplay, onExample, disabled, greeting, example, openBill, children }: {
  messages: Message[];
  reply: string | null;
  words: string;
  onReplay: (() => void) | null;
  onExample: (text: string) => void;
  disabled: boolean;
  greeting: string;
  example: string | null;
  openBill: string | null;
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
        {openBill
          ? <h2 className="is-open">{openBill}'s bill is open</h2>
          : <h2>Hello{greeting && `, ${greeting}`}</h2>}
        <p>{words || (openBill ? "Keep speaking, or type below." : "Whose bill shall we make? Speak, or type below.")}</p>
        <div className="suggestions">
          <button disabled={disabled} onClick={() => onExample("Aaj kitni sale hui?")}><Icon name="chart" />Today's sales</button>
          {example && <button disabled={disabled} onClick={() => onExample(`${example} ka hisaab batao`)}><Icon name="book" />{example}'s account</button>}
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
        <span className="sr-only">{author === "owner" ? "You" : "Bolo"} </span>
        <p>{text}</p>
        {onReplay && <button type="button" onClick={onReplay} className="replay"><Icon name="speaker" />Play again</button>}
      </div>
    </article>
  );
}
