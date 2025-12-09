/**
 * Validates a passport photo for dimensions, lighting, and blurriness.
 */
export async function validatePassportPhoto(file: File): Promise<{
    isValid: boolean;
    errors: string[];
}> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const errors: string[] = [];

            // 1. Check Dimensions & Aspect Ratio
            // Standard passport photo is roughly 35mm x 45mm (ratio ~0.77) or 2x2 inches (ratio 1.0)
            // We'll accept a range of aspect ratios between 0.7 and 1.1 to be flexible but reasonably compliant.
            const width = img.width;
            const height = img.height;
            const aspectRatio = width / height;

            if (width < 300 || height < 300) {
                errors.push("Image resolution is too low. Please use a higher quality photo.");
            }

            if (aspectRatio < 0.7 || aspectRatio > 1.1) {
                errors.push("Image dimensions do not match standard passport photo aspect ratio (approx 3.5:4.5 or 1:1).");
            }

            // 2. Check Lighting (Brightness) and Blurriness using Canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve({ isValid: errors.length === 0, errors });
                return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            let totalBrightness = 0;
            let minBrightness = 255;
            let maxBrightness = 0;

            // Convert to grayscale for simple blur/lighting check
            // We will perform a simple check on a subset of pixels to save performance if checking full image
            // But for client side single image, full iteration is usually fine for reasonable sizes.

            const grayData = new Uint8ClampedArray(width * height);

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Luminance formula
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                grayData[i / 4] = brightness;

                totalBrightness += brightness;
                if (brightness < minBrightness) minBrightness = brightness;
                if (brightness > maxBrightness) maxBrightness = brightness;
            }

            const avgBrightness = totalBrightness / (width * height);

            // Lighting Thresholds (0-255)
            // Too dark < 40, Too bright > 220 (approximate)
            if (avgBrightness < 50) {
                errors.push("Image is too dark. Please ensure good lighting.");
            } else if (avgBrightness > 200) {
                errors.push("Image is too bright/overexposed.");
            }

            // 3. Simple Blur Detection (Laplacian Variance approximate)
            // We'll calculate the variance of the differences between adjacent pixels.
            // Sharp images have high variance in localized pixel differences (edges).
            // Blurry images have low variance.
            // Using a simpler "Edginess" metric: Average difference between neighbor pixels.

            let score = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (x === 0 || y === 0) continue;

                    const idx = y * width + x;
                    const val = grayData[idx];

                    // Compare with left and top neighbor
                    const left = grayData[idx - 1];
                    const top = grayData[idx - width];

                    score += Math.abs(val - left) + Math.abs(val - top);
                }
            }

            const avgEdgeScore = score / (width * height);
            console.log("Image focus score:", avgEdgeScore);

            // Threshold is empirical and should be adjusted for human portraits, not text documents.
            // Human faces have naturally softer features with smooth skin tones and gradual transitions.
            // Text documents typically have sharp edges (>10), but passport photos of humans are much softer.
            // Setting threshold to 2.0 - only extremely blurry/out-of-focus images will be rejected.
            // This prevents false positives on clear portrait photos that naturally have lower edge scores.
            if (avgEdgeScore < 2.0) {
                errors.push("Image appears to be blurry. Please upload a clearer photo.");
            }

            resolve({
                isValid: errors.length === 0,
                errors
            });
        };

        img.onerror = () => {
            reject(new Error("Failed to load image for validation."));
        };

        img.src = objectUrl;
    });
}
