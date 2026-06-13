import { LOCAL_BACKGROUND_VIDEO, cleanBackgroundVideoUrl } from './backgroundVideo';

export function configuredBackgroundVideoUrl() {
  return cleanBackgroundVideoUrl(process.env.BACKGROUND_VIDEO_URL)
    || cleanBackgroundVideoUrl(process.env.NEXT_PUBLIC_BACKGROUND_VIDEO_URL)
    || LOCAL_BACKGROUND_VIDEO;
}
