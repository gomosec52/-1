import { cleanText, packNumber } from './config';

export function gamePayload(body) {
  return {
    pack: packNumber(body.pack),
    video_url: cleanText(body.video_url, 500),
    title: cleanText(body.title, 80),
    size: cleanText(body.size, 40),
    multiplayer: cleanText(body.multiplayer, 80),
    genre: cleanText(body.genre, 80),
    description: cleanText(body.description, 1200)
  };
}
