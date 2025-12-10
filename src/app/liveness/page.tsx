'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function LivenessPage() {
    const webcamRef = useRef<Webcam>(null);
    const [step, setStep] = useState<'position' | 'blink' | 'capture' | 'processing' | 'verifying' | 'success'>('position');
    const [progress, setProgress] = useState(0);
    const [userId, setUserId] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkProgress = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    toast.error("Please login first");
                    router.push('/verify');
                    return;
                }

                setUserId(session.user.id);

                // Get user progress
                const { getUserProgress } = await import('../actions/authActions');
                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    const user = result.user;

                    // If user has completed KYC, redirect to submission
                    if (user.kyc_status === 'completed') {
                        router.push('/submission');
                        return;
                    }

                    // If user hasn't uploaded documents yet, redirect back
                    // If user hasn't uploaded documents yet, redirect back
                    if (!user.identity_doc_type) {
                        toast.error("Please complete identity document upload first");
                        router.push('/scan/poi');
                        return;
                    }

                    if (!user.address_doc_type) {
                        toast.error("Please complete address document upload first");
                        router.push('/scan/poa');
                        return;
                    }
                }
            } catch (error) {
                console.error('Error checking progress:', error);
            }
        };

        checkProgress();
    }, [router]);

    useEffect(() => {
        let timer: NodeJS.Timeout;

        if (step === 'position') {
            // Simulate face detection delay
            timer = setTimeout(() => {
                setStep('blink');
                toast("Face detected. Please blink naturally.", { duration: 3000 });
            }, 2500);
        } else if (step === 'blink') {
            // Simulate blink detection
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        setStep('verifying');
                        return 100;
                    }
                    return prev + 2;
                });
            }, 50);
            return () => clearInterval(interval);
        } else if (step === 'verifying') {
            timer = setTimeout(async () => {
                if (userId && webcamRef.current) {
                    try {
                        const screenshot = webcamRef.current.getScreenshot();
                        if (!screenshot) {
                            throw new Error("Failed to capture image");
                        }

                        // Upload to Supabase Storage
                        const res = await fetch(screenshot);
                        const blob = await res.blob();
                        const file = new File([blob], `liveness_${userId}_${Date.now()}.jpg`, { type: 'image/jpeg' });

                        const fileName = `liveness-checks/liveness_${userId}_${Date.now()}.jpg`;
                        const { error: uploadError } = await supabase.storage
                            .from('kyc-documents')
                            .upload(fileName, file, { cacheControl: '3600', upsert: false });

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                            .from('kyc-documents')
                            .getPublicUrl(fileName);

                        // Verify Liveness with image URL
                        const { verifyLiveness } = await import('../actions/authActions');
                        const result = await verifyLiveness(userId, publicUrl);

                        if (result.success) {
                            setStep('success');
                            toast.success("Liveness verified successfully!");
                        } else {
                            toast.error("Failed to verify liveness. Please try again.");
                            setStep('position'); // Retry
                        }
                    } catch (error) {
                        console.error('Error verifying liveness:', error);
                        toast.error("Liveness check failed. Please try again.");
                        setStep('position'); // Retry
                    }
                } else {
                    // Fallback for demo/no-user (should mostly not happen in flow)
                    setStep('success');
                }
            }, 500); // Small delay to allow UI to show "Processing"
        } else if (step === 'success') {
            timer = setTimeout(() => {
                router.push('/summary');
            }, 1500);
        }

        return () => clearTimeout(timer);
    }, [step, router, userId]);

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">

            {/* Background/Webcam */}
            <div className="absolute inset-0 z-0">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    mirrored={true}
                    className="w-full h-full object-cover opacity-60"
                    videoConstraints={{ facingMode: "user" }}
                />
            </div>

            {/* Main Overlay */}
            <div className="relative z-10 w-full max-w-md flex flex-col items-center justify-between h-[80vh] p-6">

                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-2xl font-semibold text-white tracking-wide">
                        {step === 'position' && "Position your face"}
                        {step === 'blink' && "Blink your eyes"}
                        {step === 'verifying' && "Verifying..."}
                        {step === 'success' && "Verification Complete"}
                    </h1>
                    <p className="text-slate-300 text-sm">
                        {step === 'position' && "Fit your face within the oval frame."}
                        {step === 'blink' && "Prove that you are real."}
                    </p>
                </div>

                {/* Oval Guide */}
                <motion.div
                    className={`
               w-64 h-80 rounded-[50%] border-4 transition-all duration-500 relative
               ${step === 'success' ? 'border-green-500 box-shadow-[0_0_50px_rgba(34,197,94,0.5)]' : 'border-white/80'}
               ${step === 'blink' ? 'scale-105 border-blue-400' : 'scale-100'}
            `}
                    animate={step === 'blink' ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                >
                    {/* Scanning Scanline during 'blink' phase */}
                    {step === 'blink' && (
                        <motion.div
                            className="absolute top-0 left-0 right-0 h-1 bg-blue-500/50 blur-sm"
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                    )}

                    {step === 'success' && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-[50%]"
                        >
                            <CheckCircle2 className="w-20 h-20 text-green-500" />
                        </motion.div>
                    )}
                </motion.div>

                {/* Footer Status */}
                <div className="w-full space-y-4 mt-8">
                    {step === 'blink' && (
                        <Progress value={progress} className="h-2 w-full bg-white/20" indicatorClassName="bg-blue-500" />
                    )}

                    {step === 'verifying' && (
                        <div className="flex items-center justify-center gap-2 text-white">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Processing biometrics...</span>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
