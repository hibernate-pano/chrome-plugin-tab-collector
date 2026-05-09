const SESSION_NAME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export const deriveTimestampSessionName = (now: string) => {
  return SESSION_NAME_FORMATTER.format(new Date(now));
};
