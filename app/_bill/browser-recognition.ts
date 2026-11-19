type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(track: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionClass = new () => Recognition;

let serviceUnavailable = false;

export function listenInBrowser(track: MediaStreamTrack, onWords: (words: string) => void, warmFallback: () => void) {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  const Recognizer = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Recognizer || serviceUnavailable) return;

  const rec = new Recognizer();
  rec.lang = "hi-IN";
  rec.interimResults = true;
  rec.continuous = true;
  let finalized = "";
  let released = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = Promise.withResolvers<string>();

  function settle(text: string) {
    settled = true;
    clearTimeout(timer);
    rec.onresult = rec.onerror = rec.onend = null;
    result.resolve(text);
  }

  function discard() {
    if (settled) return;
    settle("");
    rec.abort();
  }

  rec.onresult = ({ results }) => {
    const all = Array.from(results);
    finalized = all.filter((result) => result.isFinal).map((result) => result[0].transcript.trim()).join(" ").trim();
    onWords(all.map((result) => result[0].transcript.trim()).join(" ").trim());
  };
  rec.onerror = ({ error }) => {
    if (error === "network" || error === "service-not-allowed") {
      serviceUnavailable = true;
      warmFallback();
    }
    discard();
  };
  rec.onend = () => settle(released ? finalized : "");

  try {
    rec.start(track);
  } catch {
    discard();
    return;
  }

  return {
    finish() {
      released = true;
      if (!settled) {
        timer = setTimeout(discard, 1500);
        try {
          rec.stop();
        } catch {
          discard();
        }
      }
      return result.promise;
    },
    discard,
  };
}
