// "Mandi" in ink, "Plus" in brand purple, as the mandiplus.com header writes it.
export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className={onDark ? "wordmark on-dark" : "wordmark"}>
      Mandi<span className="plus">Plus</span>
    </span>
  );
}
