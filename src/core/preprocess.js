'use strict';
// Optional image pre-processing to help OCR on low-contrast scans.
const sharp = require('sharp');

/**
 * Grayscale + threshold an image buffer to boost contrast before OCR.
 * If no explicit threshold is given, one is derived from the image's own
 * min/max luminance (midpoint) so faint text of any darkness gets binarized
 * to black against a white background, rather than a single fixed cutoff
 * that only works for a specific darkness of ink.
 * @param {Buffer} imageBuffer
 * @param {{threshold?: number}} opts
 * @returns {Promise<Buffer>} PNG buffer
 */
async function grayscaleThreshold(imageBuffer, opts = {}) {
  const gray = sharp(imageBuffer).grayscale().normalize();
  const grayBuffer = await gray.png().toBuffer();

  let threshold = opts.threshold;
  if (typeof threshold !== 'number') {
    const stats = await sharp(grayBuffer).stats();
    const { min, max } = stats.channels[0];
    threshold = Math.round((min + max) / 2);
  }

  return sharp(grayBuffer).threshold(threshold).png().toBuffer();
}

module.exports = { grayscaleThreshold };
