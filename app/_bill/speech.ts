export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}

export function speakHindi(text: string) {
  const speaker = window.speechSynthesis;
  if (!speaker || typeof SpeechSynthesisUtterance === "undefined") return;
  speaker.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "hi-IN";
  const voice = speaker.getVoices().find((voice) => /^hi(?:-|$)/i.test(voice.lang));
  if (voice) utterance.voice = voice;
  speaker.speak(utterance);
}
