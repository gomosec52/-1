// ============================================================
//  MAIN.JS — Общая инициализация
//  ИСПРАВЛЕНИЯ:
//  - Мобильный: header высота пересчитывается для padding-top
//  - Фон: оптимизированное переключение video→gif
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  var vid = document.getElementById('bgVideo');
  var gif = document.getElementById('bgGif');

  function showGif() {
    if (vid) { vid.style.display = 'none'; vid.pause && vid.pause(); }
    if (gif) gif.style.display = 'block';
  }

  function showVid() {
    if (gif) gif.style.display = 'none';
    if (vid) vid.style.display = 'block';
  }

  if (!vid) {
    showGif();
  } else {
    vid.addEventListener('error',   showGif);
    vid.addEventListener('stalled', showGif);
    vid.addEventListener('playing', showVid);

    // Если видео не стартовало за 3 секунды — fallback
    var fallbackTimer = setTimeout(function() {
      if (vid && vid.readyState < 2) showGif();
    }, 3000);

    vid.addEventListener('playing', function() { clearTimeout(fallbackTimer); });

    var playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise.catch(function() {
        clearTimeout(fallbackTimer);
        showGif();
      });
    }
  }

  // ---- Фикс: учитываем реальную высоту шапки для padding-top на мобиле ----
  function adjustMainPadding() {
    var header = document.querySelector('.site-header');
    var main   = document.getElementById('mainContent');
    if (header && main) {
      var h = header.getBoundingClientRect().height;
      main.style.paddingTop = (h + 24) + 'px';
    }
  }

  adjustMainPadding();
  window.addEventListener('resize', adjustMainPadding);
  // После загрузки шрифтов высота может измениться
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(adjustMainPadding);
  }
});
