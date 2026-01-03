export function getPageText(): string {
  const body = document.body;
  if (!body) return '';

  let text = body.innerText || body.textContent || '';

  // collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // limit to 50k chars
  if (text.length > 50000) {
    text = text.slice(0, 50000) + '\n\n[truncated]';
  }

  return text;
}
