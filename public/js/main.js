// ============================================================
//  MAIN.JS — Общая инициализация
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Фоллбэк для фонового видео
  const vid = document.getElementById('bgVideo');
  const gif = document.getElementById('bgGif');
  if (vid) {
    vid.addEventListener('error', () => {
      vid.style.display = 'none';
      if (gif) gif.style.display = 'block';
    });
    // Если через 3 сек видео не играет — показываем gif
    setTimeout(() => {
      if (vid.readyState < 2) {
        vid.style.display = 'none';
        if (gif) gif.style.display = 'block';
      }
    }, 3000);
  }
});
