import { cleanText } from '@/lib/config';

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[char]);
}

export async function GET(_request, { params }) {
  const { name: rawName } = await params;
  const name = escapeXml(cleanText(rawName || 'U', 2).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#ff77d9"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs><rect width="100%" height="100%" rx="36" fill="url(#g)"/><text x="50%" y="55%" text-anchor="middle" font-size="56" font-family="Arial" fill="white" font-weight="700">${name}</text></svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
