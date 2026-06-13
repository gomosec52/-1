export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function cleanText(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

export function packNumber(value) {
  const pack = Math.trunc(Number(value) || 1);
  return Math.min(5, Math.max(1, pack));
}

export function adminIds() {
  return (process.env.ADMIN_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function defaultAvatar(username) {
  return `/api/avatar/${encodeURIComponent(cleanText(username, 32) || 'user')}`;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    public_id: user.public_id,
    provider: user.provider,
    username: user.username,
    avatar_url: user.avatar_url
  };
}
