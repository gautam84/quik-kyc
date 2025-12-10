'use client';

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import Webcam from 'react-webcam';
import { detectDocumentEdges, drawDocumentOverlay, DetectedDocument, analyzeImageQuality, ImageQuality } from '@/lib/edge-detection';

export interface DocumentScannerRef {
    getScreenshot: () => string | null;
    getCurrentDetection: () => DetectedDocument | null;
    getImageQuality: () => ImageQuality | null;
}

interface DocumentScannerProps {
    onDocumentDetected?: (detected: DetectedDocument | null) => void;
    onError?: (error: string | DOMException) => void;
    detectionInterval?: number;
    className?: string;
}

export const DocumentScanner = forwardRef<DocumentScannerRef, DocumentScannerProps>(
    ({ onDocumentDetected, onError, detectionInterval = 500, className }, ref) => {
        const webcamRef = useRef<Webcam>(null);
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
        const animationFrameRef = useRef<number | undefined>(undefined);
        const lastDetectionRef = useRef<number>(0);
        const [currentDetection, setCurrentDetection] = useState<DetectedDocument | null>(null);
        const [imageQuality, setImageQuality] = useState<ImageQuality | null>(null);
        const [isProcessing, setIsProcessing] = useState(false);
        const [cameraError, setCameraError] = useState<string | null>(null);

        const [permissionStatus, setPermissionStatus] = useState<PermissionState | 'unknown'>('unknown');

        useImperativeHandle(ref, () => ({
            getScreenshot: () => {
                return webcamRef.current?.getScreenshot() || null;
            },
            getCurrentDetection: () => currentDetection,
            getImageQuality: () => imageQuality
        }));

        // Check permission status on mount
        useEffect(() => {
            if (navigator.permissions && navigator.permissions.query) {
                navigator.permissions.query({ name: 'camera' as PermissionName })
                    .then((status) => {
                        setPermissionStatus(status.state);
                        status.onchange = () => {
                            setPermissionStatus(status.state);
                            // If permission granted, clear error
                            if (status.state === 'granted') {
                                setCameraError(null);
                            }
                        };
                    })
                    .catch(() => {
                        // Permissions API not supported or error
                        setPermissionStatus('unknown');
                    });
            }
        }, []);

        const handleOneTimePermissionRequest = async () => {
            try {
                // Explicitly request user media to trigger prompt
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                // If successful, stop the tracks immediately - Webcam component will take over
                stream.getTracks().forEach(track => track.stop());
                setCameraError(null);
                setPermissionStatus('granted');
            } catch (error: any) {
                console.error("Manual permission request failed:", error);
                setCameraError(error.message || "Permission denied");
                setPermissionStatus('denied');
                if (onError) {
                    onError(error);
                }
            }
        };

        const handleUserMediaError = (error: string | DOMException) => {
            console.error('Webcam error:', error);
            const errorMessage = typeof error === 'string' ? error : error.message || 'Failed to access camera';
            setCameraError(errorMessage);
            setPermissionStatus('denied');
            if (onError) {
                onError(error);
            }
        };

        useEffect(() => {
            const processFrame = () => {
                const now = Date.now();

                // Only process at specified interval to avoid performance issues
                if (
                    !isProcessing &&
                    webcamRef.current?.video?.readyState === 4 &&
                    canvasRef.current &&
                    overlayCanvasRef.current &&
                    now - lastDetectionRef.current > detectionInterval
                ) {
                    const video = webcamRef.current.video;
                    const canvas = canvasRef.current;
                    const overlayCanvas = overlayCanvasRef.current;

                    // Match canvas size to video
                    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        overlayCanvas.width = video.videoWidth;
                        overlayCanvas.height = video.videoHeight;
                    }

                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    const overlayCtx = overlayCanvas.getContext('2d');

                    if (ctx && overlayCtx) {
                        setIsProcessing(true);
                        lastDetectionRef.current = now;

                        try {
                            // Draw video frame to canvas
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                            // Get image data
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                            // Analyze image quality
                            const quality = analyzeImageQuality(imageData);
                            setImageQuality(quality);

                            // Detect document edges
                            const detected = detectDocumentEdges(imageData, {
                                minArea: 0.15, // Document should be at least 15% of frame
                                maxArea: 0.85, // But not more than 85%
                                epsilon: 0.02
                            });

                            // Update state
                            setCurrentDetection(detected);

                            // Call callback if provided
                            if (onDocumentDetected) {
                                onDocumentDetected(detected);
                            }

                            // Draw overlay
                            drawDocumentOverlay(
                                overlayCtx,
                                overlayCanvas.width,
                                overlayCanvas.height,
                                detected
                            );
                        } catch (error) {
                            console.error('Error processing frame:', error);
                        } finally {
                            setIsProcessing(false);
                        }
                    }
                }

                animationFrameRef.current = requestAnimationFrame(processFrame);
            };

            // Start processing loop
            animationFrameRef.current = requestAnimationFrame(processFrame);

            return () => {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            };
        }, [detectionInterval, isProcessing, onDocumentDetected]);

        if (cameraError) {
            return (
                <div className={`flex flex-col items-center justify-center bg-slate-900 text-white p-6 ${className || ''}`}>
                    <div className="text-red-500 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-camera-off"><line x1="2" x2="22" y1="2" y2="22" /><path d="M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16" /><path d="M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.5" /><path d="M14.121 15.121A3 3 0 1 1 9.88 10.88" /></svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Camera Access Needed</h3>
                    <p className="text-center text-slate-300 text-sm mb-6 max-w-xs">
                        {permissionStatus === 'denied'
                            ? "Camera access was denied. Please enable it in your browser settings."
                            : "We need access to your camera to scan documents."}
                    </p>

                    {permissionStatus !== 'denied' && (
                        <button
                            onClick={handleOneTimePermissionRequest}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-full transition-colors"
                        >
                            Allow Camera Access
                        </button>
                    )}

                    {permissionStatus === 'denied' && (
                        <div className="text-xs text-slate-500 font-mono bg-black/50 p-2 rounded max-w-full overflow-hidden text-ellipsis">
                            Error: {cameraError}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className={`relative w-full h-full ${className || ''}`}>
                {/* Hidden canvas for edge detection processing */}
                <canvas
                    ref={canvasRef}
                    className="hidden"
                />

                {/* Webcam video */}
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    onUserMediaError={handleUserMediaError}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{
                        facingMode: "environment",
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }}
                    mirrored={false}
                />

                {/* Overlay canvas for visual feedback */}
                <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{
                        mixBlendMode: 'normal',
                        imageRendering: 'crisp-edges'
                    }}
                />

                {/* Quality warnings */}
                {imageQuality && imageQuality.warnings.length > 0 && (
                    <div className="absolute top-4 left-4 right-4 z-10 space-y-2">
                        {imageQuality.warnings.map((warning, idx) => (
                            <div
                                key={idx}
                                className="px-3 py-2 rounded-lg text-sm font-medium bg-yellow-500/90 backdrop-blur-sm text-white flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                    <path d="M12 9v4" />
                                    <path d="M12 17h.01" />
                                </svg>
                                <span className="text-xs sm:text-sm">{warning}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Confidence indicator */}
                {currentDetection && !imageQuality?.isBlurry && !imageQuality?.isLowLight && (
                    <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-sm font-medium bg-black/50 backdrop-blur-sm flex items-center gap-2 z-10">
                        <div
                            className={`w-2 h-2 rounded-full ${currentDetection.confidence > 0.7
                                ? 'bg-green-500 animate-pulse'
                                : 'bg-yellow-500'
                                }`}
                        />
                        <span className="text-white text-xs sm:text-sm">
                            {currentDetection.confidence > 0.7 ? 'Ready' : 'Align'}
                        </span>
                    </div>
                )}

                {/* Processing indicator */}
                {isProcessing && (
                    <div className="absolute bottom-4 left-4 px-2 py-1 rounded text-xs bg-black/30 backdrop-blur-sm text-white z-10">
                        Processing...
                    </div>
                )}
            </div>
        );
    }
);

DocumentScanner.displayName = 'DocumentScanner';
