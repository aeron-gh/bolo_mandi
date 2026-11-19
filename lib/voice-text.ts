// Bound recognition output before showing it or treating it as a customer name.
export function clearSpeech(text: string): boolean {
  if (!text.trim() || text.length > 500) return false;
  const words = text.toLowerCase().normalize("NFC").match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  if (!words.length || words.some((word) => word.length > 32)) return false;

  for (let index = 0; index < words.length - 4; index++) {
    if (words.slice(index, index + 5).every((word) => word === words[index])) return false;
  }
  return true;
}
