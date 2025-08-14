import Compressor from "compressorjs";

/**
 * Compress and resize an image file using Compressor.js.
 * @param {File} file - The image file to compress.
 * @param {Object} options - Additional compression options.
 * @returns {Promise<File>} - The compressed and resized image file.
 */
export function compressImage(file, options = {}) {
  return new Promise((resolve, reject) => {
    const quality = 0.7;

    const defaultOptions = {
      quality,
      maxWidth: 500,
      maxHeight: 500,
      resize: "contain",
      convertTypes: ["image/jpeg", "image/png", "image/webp"],
    };

    // Merge default options with any custom options
    const compressorOptions = {
      ...defaultOptions,
      ...options,
      success(result) {
        resolve(result);
      },
      error(err) {
        reject(err);
      },
    };

    new Compressor(file, compressorOptions);
  });
}
