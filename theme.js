(function () {
  var STORAGE_KEY = 'stemmedin-theme';
  var ZOOM_LOCK_CLASS = 'zoom-lock';
  var ZOOM_OVERLAY_CLASS = 'image-zoom-overlay';
  var ZOOM_OPEN_CLASS = 'is-open';

  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);

    var buttons = document.querySelectorAll('[data-theme-toggle]');
    buttons.forEach(function (button) {
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      button.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    });
  }

  function toggleTheme() {
    var current = document.body.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  function setupImageZoom() {
    var images = document.querySelectorAll('img.concept-image');
    if (!images.length) {
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = ZOOM_OVERLAY_CLASS;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="image-zoom-dialog" role="dialog" aria-modal="true" aria-label="Zoomed image">' +
      '  <div class="image-zoom-header">' +
      '    <p class="image-zoom-title">Image zoom</p>' +
      '    <div class="image-zoom-controls" aria-label="Zoom controls">' +
      '      <button type="button" class="image-zoom-btn" data-zoom-out aria-label="Zoom out">-</button>' +
      '      <span class="image-zoom-scale" aria-live="polite">100%</span>' +
      '      <button type="button" class="image-zoom-btn" data-zoom-in aria-label="Zoom in">+</button>' +
      '      <button type="button" class="image-zoom-btn" data-zoom-reset aria-label="Reset zoom">Reset</button>' +
      '      <button type="button" class="image-zoom-close" aria-label="Close image zoom">Close</button>' +
      '    </div>' +
      '  </div>' +
      '  <figure class="image-zoom-figure">' +
      '    <div class="image-zoom-viewport" aria-label="Zoomed image viewport">' +
      '      <img class="image-zoom-img" alt="" />' +
      '    </div>' +
      '    <figcaption class="image-zoom-caption"></figcaption>' +
      '  </figure>' +
      '</div>';
    document.body.appendChild(overlay);

    var MIN_SCALE = 1;
    var MAX_SCALE = 6;
    var SCALE_STEP = 0.5;
    var scale = 1;

    var zoomImg = overlay.querySelector('.image-zoom-img');
    var viewport = overlay.querySelector('.image-zoom-viewport');
    var captionEl = overlay.querySelector('.image-zoom-caption');
    var closeBtn = overlay.querySelector('.image-zoom-close');
    var zoomInBtn = overlay.querySelector('[data-zoom-in]');
    var zoomOutBtn = overlay.querySelector('[data-zoom-out]');
    var zoomResetBtn = overlay.querySelector('[data-zoom-reset]');
    var scaleEl = overlay.querySelector('.image-zoom-scale');
    var lastActive = null;

    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    function applyScale() {
      zoomImg.style.width = (scale * 100).toFixed(0) + '%';
      scaleEl.textContent = (scale * 100).toFixed(0) + '%';
      zoomOutBtn.disabled = scale <= MIN_SCALE;
      zoomInBtn.disabled = scale >= MAX_SCALE;
    }

    function getCaptionFor(img) {
      var figure = img.closest('figure');
      if (figure) {
        var figcaption = figure.querySelector('figcaption');
        if (figcaption && figcaption.textContent) {
          var text = figcaption.textContent.trim();
          if (text) {
            return text;
          }
        }
      }

      return (img.getAttribute('alt') || '').trim();
    }

    function setScale(nextScale, originClientX, originClientY) {
      var prevScale = scale;
      var next = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      if (next === prevScale) {
        return;
      }

      var rect = viewport.getBoundingClientRect();
      var originX = typeof originClientX === 'number' ? originClientX : rect.left + rect.width / 2;
      var originY = typeof originClientY === 'number' ? originClientY : rect.top + rect.height / 2;
      var offsetX = originX - rect.left;
      var offsetY = originY - rect.top;
      var contentX = viewport.scrollLeft + offsetX;
      var contentY = viewport.scrollTop + offsetY;
      var factor = next / prevScale;

      scale = next;
      applyScale();

      viewport.scrollLeft = contentX * factor - offsetX;
      viewport.scrollTop = contentY * factor - offsetY;
    }

    function resetZoom() {
      scale = 1;
      applyScale();
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }

    function openZoom(img) {
      lastActive = document.activeElement;
      document.body.classList.add(ZOOM_LOCK_CLASS);

      overlay.classList.add(ZOOM_OPEN_CLASS);
      overlay.setAttribute('aria-hidden', 'false');

      zoomImg.src = img.currentSrc || img.src;
      zoomImg.alt = img.alt || '';
      captionEl.textContent = getCaptionFor(img);
      resetZoom();

      closeBtn.focus();
    }

    function closeZoom() {
      if (!overlay.classList.contains(ZOOM_OPEN_CLASS)) {
        return;
      }

      overlay.classList.remove(ZOOM_OPEN_CLASS);
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove(ZOOM_LOCK_CLASS);

      zoomImg.removeAttribute('src');
      zoomImg.style.width = '';
      captionEl.textContent = '';
      scale = 1;
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;

      if (lastActive && typeof lastActive.focus === 'function') {
        lastActive.focus();
      }
    }

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeZoom();
      }
    });

    closeBtn.addEventListener('click', closeZoom);
    zoomInBtn.addEventListener('click', function () {
      setScale(scale + SCALE_STEP);
    });
    zoomOutBtn.addEventListener('click', function () {
      setScale(scale - SCALE_STEP);
    });
    zoomResetBtn.addEventListener('click', resetZoom);

    viewport.addEventListener(
      'wheel',
      function (event) {
        if (!overlay.classList.contains(ZOOM_OPEN_CLASS)) {
          return;
        }

        if (!(event.ctrlKey || event.metaKey)) {
          return;
        }

        event.preventDefault();
        var direction = event.deltaY > 0 ? -1 : 1;
        setScale(scale + direction * SCALE_STEP, event.clientX, event.clientY);
      },
      { passive: false }
    );

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeZoom();
      }

      if (!overlay.classList.contains(ZOOM_OPEN_CLASS)) {
        return;
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setScale(scale + SCALE_STEP);
      }

      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setScale(scale - SCALE_STEP);
      }

      if (event.key === '0') {
        event.preventDefault();
        resetZoom();
      }
    });

    images.forEach(function (img) {
      img.classList.add('zoomable-image');
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', (img.alt || 'Zoom image').trim() || 'Zoom image');

      img.addEventListener('click', function () {
        openZoom(img);
      });

      img.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openZoom(img);
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(getPreferredTheme());

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.addEventListener('click', toggleTheme);
    });

    setupImageZoom();
  });
})();
