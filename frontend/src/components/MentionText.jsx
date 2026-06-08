const MENTION_REGEX = /(@[a-zA-Z0-9_]+)/g;

export default function MentionText({ text, currentUserId }) {
  const parts = text.split(MENTION_REGEX);

  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="mention">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
