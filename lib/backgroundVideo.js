const LOCAL_BACKGROUND_VIDEO = '/assets/anime-bg.mp4';

export function cleanBackgroundVideoUrl(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');

  if (!cleaned) return '';
  if (cleaned.startsWith('/')) return cleaned;

  try {
    const parsed = new URL(cleaned);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

export { LOCAL_BACKGROUND_VIDEO };
