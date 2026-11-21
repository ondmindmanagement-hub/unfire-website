(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BannerFitEngine = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  var presets = Object.freeze([
    { id: 'youtube-banner', label: 'Wide channel banner', width: 2560, height: 1440 },
    { id: 'youtube-thumbnail', label: 'Video thumbnail', width: 1280, height: 720 },
    { id: 'square', label: 'Square artwork', width: 1080, height: 1080 },
    { id: 'portrait', label: 'Portrait artwork', width: 1080, height: 1350 },
    { id: 'story', label: 'Vertical story', width: 1080, height: 1920 },
    { id: 'avatar', label: 'Profile image', width: 800, height: 800 },
    { id: 'custom', label: 'Custom size', width: 1280, height: 720 }
  ]);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value)));
  }

  function validateDimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        width < 64 || height < 64 || width > 8192 || height > 8192 ||
        width * height > 16000000) {
      throw new Error('Use dimensions from 64 to 8192 px and up to 16 million pixels total.');
    }
    return { width: width, height: height };
  }

  function computePlacement(sourceWidth, sourceHeight, targetWidth, targetHeight, mode, focusX, focusY) {
    if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(function (n) {
      return Number.isFinite(n) && n > 0;
    })) throw new Error('Image dimensions must be positive.');
    if (mode !== 'cover' && mode !== 'contain') throw new Error('Unknown fit mode.');

    var scale = mode === 'cover'
      ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
      : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    var drawWidth = sourceWidth * scale;
    var drawHeight = sourceHeight * scale;
    var fx = clamp(focusX, 0, 100) / 100;
    var fy = clamp(focusY, 0, 100) / 100;
    var px = (targetWidth - drawWidth) * fx;
    var py = (targetHeight - drawHeight) * fy;
    return {
      x: px === 0 ? 0 : px,
      y: py === 0 ? 0 : py,
      width: drawWidth,
      height: drawHeight
    };
  }

  function exportName(filename, width, height, extension) {
    var base = String(filename || 'artwork').replace(/\.[^.]+$/, '')
      .normalize('NFKC').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-')
      .slice(0, 55) || 'artwork';
    return base + '-' + width + 'x' + height + '.' + (extension === 'jpg' ? 'jpg' : 'png');
  }

  return { presets: presets, clamp: clamp, validateDimensions: validateDimensions,
    computePlacement: computePlacement, exportName: exportName };
});
