import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { relayTurn } from "../server/sarvam.mjs";

class Socket extends EventEmitter {
  readyState = 1;
  messages: Record<string, unknown>[] = [];
  send(message: string) { this.messages.push(JSON.parse(message)); }
  close() { this.readyState = 3; }
}

function event(socket: Socket, event: string, text?: string) {
  socket.emit("message", Buffer.from(JSON.stringify({ event, text })));
}

describe("Sarvam mic turn", () => {
  it("buffers the first audio and only forwards the final transcript after release", () => {
    const browser = new Socket();
    const sarvam = new Socket();
    relayTurn(browser, sarvam);
    browser.emit("message", Buffer.from([1, 0]), true);
    event(sarvam, "session.begin");
    event(sarvam, "transcript.partial", "Vikas");
    event(sarvam, "transcript.final", "Premature");
    expect(browser.messages).toEqual([{ kind: "partial", text: "Vikas" }]);
    browser.emit("message", Buffer.from("end"), false);
    event(sarvam, "transcript.final", "Vikas ko das piece");
    expect(sarvam.messages).toEqual([
      { event: "speech_start" }, { event: "audio_input", audio: "AQA=" }, { event: "speech_end" }, { event: "end" },
    ]);
    expect(browser.messages.at(-1)).toEqual({ kind: "final", text: "Vikas ko das piece" });
    expect(browser.readyState).toBe(3);
  });

  it("signals the browser to use its recording on a provider error", () => {
    const browser = new Socket();
    const sarvam = new Socket();
    relayTurn(browser, sarvam);
    event(sarvam, "error");
    expect(browser.messages).toEqual([{ kind: "error" }]);
    expect(sarvam.readyState).toBe(3);
  });
});
