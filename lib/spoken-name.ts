// The customer directory matches Latin spellings. Convert Hindi recognition
// results while leaving any Latin part of a mixed-script name intact.
const VOWELS: Record<string, string> = {
  अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri",
  ए: "e", ऐ: "ai", ओ: "o", औ: "au",
};
const MARKS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e", "्": "",
};
const CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "f", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", व: "v",
  श: "sh", ष: "sh", स: "s", ह: "h", ळ: "l",
};
const NUKTA: Record<string, string> = { क: "q", ख: "kh", ग: "gh", ज: "z", ड: "r", ढ: "rh", फ: "f" };

export function spokenName(text: string): string {
  return text.normalize("NFD").replace(/[\u0900-\u097f]+/g, (word) => {
    // Conventional spelling in the customer directory.
    if (word === "अहमद") return "ahmed";
    const letters = Array.from(word);
    let name = "";
    for (let index = 0; index < letters.length; index++) {
      const letter = letters[index];
      if (Object.hasOwn(CONSONANTS, letter)) {
        const dotted = letters[index + 1] === "़";
        name += dotted ? NUKTA[letter] ?? CONSONANTS[letter] : CONSONANTS[letter];
        if (dotted) index++;
        const mark = letters[index + 1];
        if (Object.hasOwn(MARKS, mark)) {
          name += MARKS[mark];
          index++;
        } else if (mark && (index === 0 || !Object.hasOwn(MARKS, letters[index + 2]))) {
          name += "a";
        }
      } else {
        name += VOWELS[letter] ?? (letter === "ं" || letter === "ँ" ? "n" : "");
      }
    }
    return name;
  });
}
