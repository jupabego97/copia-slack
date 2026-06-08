export function formatRelativeDate(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getDmLabel(channel, currentUserId) {
  const other = channel.members?.find((member) => member.id !== currentUserId);
  return other?.display_name || channel.name;
}

export function getChannelTitle(channel, currentUserId) {
  if (!channel) return "Canal";
  if (!channel.is_direct_message) return channel.name;
  return getDmLabel(channel, currentUserId);
}
