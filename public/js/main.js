// ============================================================
//  MAIN.JS — Общая инициализация (кроссбраузерный)
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  var vid = document.getElementById('bgVideo');
  var gif = document.getElementById('bgGif');

  function showGif() {
    if (vid) vid.style.display = 'none';
    if (gif) gif.style.display = 'block';
  }

  if (vid) {
    vid.addEventListener('error', showGif);
    vid.addEventListener('stalled', showGif);
    // Если через 4 сек видео не играет — показываем gif
    setTimeout(function() {
      if (vid.readyState < 2) showGif();
    }, 4000);
  } else {
    showGif();
  }

  // Яндекс.Браузер / Opera — фикс автовоспроизведения
  if (vid) {
    var playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise.catch(function() { showGif(); });
    }
  }
});
