function isToken(part) {
  return (
    (part.startsWith("`") && part.endsWith("`") && part.length >= 2) ||
    (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
    (part.startsWith("_") && part.endsWith("_") && part.length >= 2 && !part.includes(" ")) ||
    (part.startsWith("~") && part.endsWith("~") && part.length >= 2) ||
    /^@[a-zA-Z0-9_]+$/.test(part)
  );
}

const TOKEN_REGEX =
  /(`[^`]+`|\*\*[^*]+\*\*|_[^_\s]+_|~[^~]+~|@[a-zA-Z0-9_]+)/g;

function renderToken(token, key, currentUsername) {
  if (token.startsWith("`") && token.endsWith("`")) {
    return (
      <code key={key} className="rounded bg-[rgba(255,255,255,0.08)] px-1 py-0.5 font-mono text-[13px] text-[#E01E5A]">
        {token.slice(1, -1)}
      </code>
    );
  }
  if (token.startsWith("**") && token.endsWith("**")) {
    return <strong key={key}>{token.slice(2, -2)}</strong>;
  }
  if (token.startsWith("_") && token.endsWith("_")) {
    return <em key={key}>{token.slice(1, -1)}</em>;
  }
  if (token.startsWith("~") && token.endsWith("~")) {
    return <s key={key}>{token.slice(1, -1)}</s>;
  }
  if (token.startsWith("@")) {
    const isSelf = currentUsername && token.slice(1).toLowerCase() === currentUsername.toLowerCase();
    return (
      <span key={key} className={isSelf ? "mention-self" : "mention"}>
        {token}
      </span>
    );
  }
  return <span key={key}>{token}</span>;
}

export default function MentionText({ text, currentUsername }) {
  const parts = String(text || "").split(TOKEN_REGEX);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (isToken(part)) return renderToken(part, i, currentUsername);
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
