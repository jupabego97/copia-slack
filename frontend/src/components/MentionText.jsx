const MENTION_REGEX = /(@[a-zA-Z0-9_]+)/g;

export default function MentionText({ text }) {
  const parts = text.split(MENTION_REGEX);

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("@") ? (
          <span key={index} className="rounded bg-accent/15 px-1 font-medium text-accent">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}
