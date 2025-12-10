export interface Point {
    x: number;
    y: number;
}

export interface DetectedDocument {
    corners: Point[];
    confidence: number;
}

export interface ImageQuality {
    isBlurry: boolean;
    blurScore: number;
    isLowLight: boolean;
    brightness: number;
    warnings: string[];
}

/**
 * Convert image data to grayscale
 */
function toGrayscale(imageData: ImageData): Uint8ClampedArray {
    const gray = new Uint8ClampedArray(imageData.width * imageData.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Use luminosity method for better results
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    return gray;
}

/**
 * Apply Gaussian blur to reduce noise
 */
function gaussianBlur(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const blurred = new Uint8ClampedArray(gray.length);
    const kernel = [
        1, 2, 1,
        2, 4, 2,
        1, 2, 1
    ];
    const kernelSum = 16;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sum = 0;

            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    const kidx = (ky + 1) * 3 + (kx + 1);
                    sum += gray[idx] * kernel[kidx];
                }
            }

            blurred[y * width + x] = sum / kernelSum;
        }
    }

    return blurred;
}

/**
 * Apply Sobel edge detection
 */
function sobelEdgeDetection(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const edges = new Uint8ClampedArray(gray.length);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let gx = 0;
            let gy = 0;

            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    const kidx = (ky + 1) * 3 + (kx + 1);
                    gx += gray[idx] * sobelX[kidx];
                    gy += gray[idx] * sobelY[kidx];
                }
            }

            edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
        }
    }

    return edges;
}

/**
 * Apply threshold to create binary image
 */
function threshold(edges: Uint8ClampedArray, thresh: number = 50): Uint8ClampedArray {
    const binary = new Uint8ClampedArray(edges.length);

    for (let i = 0; i < edges.length; i++) {
        binary[i] = edges[i] > thresh ? 255 : 0;
    }

    return binary;
}

/**
 * Find contours in binary image
 */
function findContours(binary: Uint8ClampedArray, width: number, height: number): Point[][] {
    const visited = new Uint8Array(binary.length);
    const contours: Point[][] = [];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;

            if (binary[idx] === 255 && !visited[idx]) {
                const contour: Point[] = [];
                const stack: Point[] = [{ x, y }];

                while (stack.length > 0) {
                    const point = stack.pop()!;
                    const pidx = point.y * width + point.x;

                    if (visited[pidx] || binary[pidx] !== 255) continue;

                    visited[pidx] = 1;
                    contour.push(point);

                    // Check 8 neighbors (limit contour size to prevent memory issues)
                    if (contour.length < 10000) {
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                const nx = point.x + dx;
                                const ny = point.y + dy;
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    stack.push({ x: nx, y: ny });
                                }
                            }
                        }
                    }
                }

                if (contour.length > 50) {
                    contours.push(contour);
                }
            }
        }
    }

    return contours;
}

/**
 * Approximate polygon from contour using Douglas-Peucker algorithm
 */
function approximatePolygon(contour: Point[], epsilon: number): Point[] {
    if (contour.length <= 2) return contour;

    // Find the point with maximum distance from line segment
    let maxDist = 0;
    let maxIndex = 0;
    const end = contour.length - 1;

    for (let i = 1; i < end; i++) {
        const dist = perpendicularDistance(contour[i], contour[0], contour[end]);
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (maxDist > epsilon) {
        const left = approximatePolygon(contour.slice(0, maxIndex + 1), epsilon);
        const right = approximatePolygon(contour.slice(maxIndex), epsilon);
        return [...left.slice(0, -1), ...right];
    } else {
        return [contour[0], contour[end]];
    }
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const norm = Math.sqrt(dx * dx + dy * dy);

    if (norm === 0) return 0;

    return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / norm;
}

/**
 * Check if polygon is approximately rectangular
 */
function isRectangular(polygon: Point[]): boolean {
    if (polygon.length !== 4) return false;

    // Check if angles are approximately 90 degrees
    for (let i = 0; i < 4; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % 4];
        const p3 = polygon[(i + 2) % 4];

        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        if (mag1 === 0 || mag2 === 0) return false;

        const cos = dot / (mag1 * mag2);
        const angle = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;

        // Allow some tolerance (60-120 degrees)
        if (angle < 60 || angle > 120) return false;
    }

    return true;
}

/**
 * Calculate area of polygon
 */
function polygonArea(polygon: Point[]): number {
    let area = 0;

    for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        area += polygon[i].x * polygon[j].y;
        area -= polygon[j].x * polygon[i].y;
    }

    return Math.abs(area / 2);
}

/**
 * Order corners in clockwise order starting from top-left
 */
function orderCorners(corners: Point[]): Point[] {
    if (corners.length !== 4) return corners;

    // Find center point
    const cx = corners.reduce((sum, p) => sum + p.x, 0) / 4;
    const cy = corners.reduce((sum, p) => sum + p.y, 0) / 4;

    // Sort by angle from center
    const sorted = corners.sort((a, b) => {
        const angleA = Math.atan2(a.y - cy, a.x - cx);
        const angleB = Math.atan2(b.y - cy, b.x - cx);
        return angleA - angleB;
    });

    // Find top-left corner (minimum x + y)
    let minSum = Infinity;
    let minIndex = 0;
    for (let i = 0; i < 4; i++) {
        const sum = sorted[i].x + sorted[i].y;
        if (sum < minSum) {
            minSum = sum;
            minIndex = i;
        }
    }

    // Rotate array to start from top-left
    return [...sorted.slice(minIndex), ...sorted.slice(0, minIndex)];
}

/**
 * Main edge detection function
 */
export function detectDocumentEdges(
    imageData: ImageData,
    options: {
        minArea?: number;
        maxArea?: number;
        epsilon?: number;
    } = {}
): DetectedDocument | null {
    const { minArea = 0.1, maxArea = 0.9, epsilon = 0.02 } = options;

    const { width, height } = imageData;
    const totalArea = width * height;

    // Step 1: Convert to grayscale
    const gray = toGrayscale(imageData);

    // Step 2: Apply Gaussian blur
    const blurred = gaussianBlur(gray, width, height);

    // Step 3: Edge detection
    const edges = sobelEdgeDetection(blurred, width, height);

    // Step 4: Threshold
    const binary = threshold(edges, 50);

    // Step 5: Find contours
    const contours = findContours(binary, width, height);

    // Step 6: Find largest rectangular contour
    let bestMatch: DetectedDocument | null = null;
    let maxMatchArea = 0;

    for (const contour of contours) {
        // Approximate polygon
        const perimeter = contour.length;
        const approx = approximatePolygon(contour, epsilon * perimeter);

        // Check if it's rectangular
        if (isRectangular(approx)) {
            const area = polygonArea(approx);
            const relativeArea = area / totalArea;

            // Check if area is within bounds
            if (relativeArea >= minArea && relativeArea <= maxArea && area > maxMatchArea) {
                maxMatchArea = area;
                const orderedCorners = orderCorners(approx);
                bestMatch = {
                    corners: orderedCorners,
                    confidence: Math.min(1, relativeArea / 0.5) // Higher confidence for larger documents
                };
            }
        }
    }

    return bestMatch;
}

/**
 * Detect blur using Laplacian variance method
 */
export function detectBlur(imageData: ImageData): { isBlurry: boolean; blurScore: number } {
    const { width, height } = imageData;
    const gray = toGrayscale(imageData);

    // Apply Laplacian operator
    const laplacian = [
        0, 1, 0,
        1, -4, 1,
        0, 1, 0
    ];

    let sum = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let value = 0;

            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    const kidx = (ky + 1) * 3 + (kx + 1);
                    value += gray[idx] * laplacian[kidx];
                }
            }

            sum += value * value;
            count++;
        }
    }

    // Calculate variance (higher variance = sharper image)
    const variance = sum / count;
    const blurScore = variance;

    // Threshold for blur detection (adjust based on testing)
    const blurThreshold = 100;
    const isBlurry = variance < blurThreshold;

    return { isBlurry, blurScore: Math.round(variance) };
}

/**
 * Detect low light conditions
 */
export function detectLowLight(imageData: ImageData): { isLowLight: boolean; brightness: number } {
    const data = imageData.data;
    let totalBrightness = 0;
    let pixelCount = 0;

    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate perceived brightness (luminance)
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += brightness;
        pixelCount++;
    }

    const averageBrightness = totalBrightness / pixelCount;

    // Threshold for low light (0-255 scale)
    const lowLightThreshold = 80;
    const isLowLight = averageBrightness < lowLightThreshold;

    return { isLowLight, brightness: Math.round(averageBrightness) };
}

/**
 * Analyze image quality
 */
export function analyzeImageQuality(imageData: ImageData): ImageQuality {
    const blurResult = detectBlur(imageData);
    const lightResult = detectLowLight(imageData);

    const warnings: string[] = [];

    if (blurResult.isBlurry) {
        warnings.push('Image appears blurry. Hold camera steady.');
    }

    if (lightResult.isLowLight) {
        warnings.push('Low light detected. Move to brighter area.');
    }

    return {
        isBlurry: blurResult.isBlurry,
        blurScore: blurResult.blurScore,
        isLowLight: lightResult.isLowLight,
        brightness: lightResult.brightness,
        warnings
    };
}

/**
 * Draw overlay on canvas
 */
export function drawDocumentOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    detected: DetectedDocument | null
): void {
    ctx.clearRect(0, 0, width, height);

    if (detected && detected.corners.length === 4) {
        // Draw detected document outline
        ctx.strokeStyle = detected.confidence > 0.7 ? '#22c55e' : '#eab308';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(detected.corners[0].x, detected.corners[0].y);
        for (let i = 1; i < 4; i++) {
            ctx.lineTo(detected.corners[i].x, detected.corners[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw corner markers
        ctx.fillStyle = detected.confidence > 0.7 ? '#22c55e' : '#eab308';
        for (const corner of detected.corners) {
            ctx.beginPath();
            ctx.arc(corner.x, corner.y, 8, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Draw confidence indicator
        const text = detected.confidence > 0.7 ? '✓ Document Detected' : '⚠ Align Document';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        const textWidth = ctx.measureText(text).width;
        const x = (width - textWidth) / 2;
        const y = 40;
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
    } else {
        // Draw guide frame
        const padding = Math.min(width, height) * 0.1;
        const frameWidth = width - 2 * padding;
        const frameHeight = height - 2 * padding;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.strokeRect(padding, padding, frameWidth, frameHeight);
        ctx.setLineDash([]);

        // Draw corner guides
        const cornerLength = 30;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(padding, padding + cornerLength);
        ctx.lineTo(padding, padding);
        ctx.lineTo(padding + cornerLength, padding);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(width - padding - cornerLength, padding);
        ctx.lineTo(width - padding, padding);
        ctx.lineTo(width - padding, padding + cornerLength);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(padding, height - padding - cornerLength);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(padding + cornerLength, height - padding);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(width - padding - cornerLength, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.lineTo(width - padding, height - padding - cornerLength);
        ctx.stroke();

        // Draw instruction text
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        const text = 'Position document within frame';
        const textWidth = ctx.measureText(text).width;
        const x = (width - textWidth) / 2;
        const y = height - padding / 2;
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
    }
}
