'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Check, AlertTriangle, Camera, FileUp, ArrowLeft, ArrowRight, X, Smartphone, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { KYCProgress } from '@/components/kyc-progress';

type UploadStep = 'identity' | 'address' | 'complete';

export default function ScanPage() {
    const router = useRouter();
    const webcamRef = useRef<Webcam>(null);
    const fileInputFrontRef = useRef<HTMLInputElement>(null);
    const fileInputBackRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<UploadStep>('identity');
    const [docType, setDocType] = useState('pan');

    // Front and Back images
    const [frontImage, setFrontImage] = useState<string | null>(null);
    const [backImage, setBackImage] = useState<string | null>(null);
    const [frontFile, setFrontFile] = useState<File | null>(null);
    const [backFile, setBackFile] = useState<File | null>(null);

    // Camera state
    const [showCamera, setShowCamera] = useState(false);
    const [capturingFor, setCapturingFor] = useState<'front' | 'back' | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);
    const [showMobilePrompt, setShowMobilePrompt] = useState(false);
    const [pendingSide, setPendingSide] = useState<'front' | 'back' | null>(null);

    const [processing, setProcessing] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Check if user is on desktop
    useEffect(() => {
        const checkDevice = () => {
            const ua = navigator.userAgent;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const isTablet = /iPad|Android/i.test(ua) && !/Mobile/i.test(ua);
            setIsDesktop(!isMobile && !isTablet);
        };
        checkDevice();
    }, []);

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

                const { getUserProgress } = await import('../actions/authActions');
                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    const user = result.user;

                    if (!user.full_name || !user.date_of_birth) {
                        toast.error("Please complete basic details first");
                        router.push('/basic-details');
                        return;
                    }

                    if (user.kyc_status === 'completed') {
                        router.push('/submission');
                        return;
                    }

                    if (user.identity_doc_type) {
                        setStep('address');
                        setDocType('aadhaar');
                    }
                }
            } catch (error) {
                console.error('Error checking progress:', error);
            }
        };

        checkProgress();
    }, [router]);

    const handleFrontFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFrontFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setFrontImage(e.target.result as string);
                    toast.success("Front side uploaded");
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleBackFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBackFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setBackImage(e.target.result as string);
                    toast.success("Back side uploaded");
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCameraClick = (side: 'front' | 'back') => {
        console.log('Camera clicked for:', side, 'isDesktop:', isDesktop);
        setPendingSide(side);
        // Always show camera, but on mobile also show send link option
        setCapturingFor(side);
        setShowCamera(true);
    };

    const handleContinueOnDesktop = () => {
        if (pendingSide) {
            setShowMobilePrompt(false);
            setCapturingFor(pendingSide);
            setShowCamera(true);
        }
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc && capturingFor) {
            // Convert base64 to File
            fetch(imageSrc)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `${capturingFor}_${Date.now()}.jpg`, { type: 'image/jpeg' });

                    if (capturingFor === 'front') {
                        setFrontImage(imageSrc);
                        setFrontFile(file);
                        toast.success("Front side captured");
                    } else {
                        setBackImage(imageSrc);
                        setBackFile(file);
                        toast.success("Back side captured");
                    }

                    setShowCamera(false);
                    setCapturingFor(null);
                });
        }
    }, [webcamRef, capturingFor]);

    const handleSendLink = async () => {
        const currentUrl = window.location.href;

        try {
            await navigator.clipboard.writeText(currentUrl);
            toast.success("Link copied to clipboard! Share it with your phone.");
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = currentUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success("Link copied to clipboard! Share it with your phone.");
        }
    };

    const handleSubmit = async () => {
        if (!frontImage) {
            toast.error("Please upload the front side of the document");
            return;
        }

        // Back side is optional for Passport
        if (!backImage && docType !== 'passport') {
            toast.error("Please upload the back side of the document");
            return;
        }

        if (!userId) {
            toast.error("Session error. Please login again.");
            router.push('/verify');
            return;
        }

        setProcessing(true);

        try {
            // Upload front and back images to Supabase Storage
            let frontUrl = null;
            let backUrl = null;

            if (frontFile) {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    toast.error("Session expired. Please login again.");
                    router.push('/verify');
                    setProcessing(false);
                    return;
                }

                const frontExt = frontFile.name.split('.').pop();
                const frontFileName = `${userId}_${step}_${docType}_front_${Date.now()}.${frontExt}`;
                const frontPath = `${step}-documents/${frontFileName}`;

                const { error: frontError } = await supabase.storage
                    .from('kyc-documents')
                    .upload(frontPath, frontFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (frontError) {
                    console.error('Front upload error:', frontError);
                    toast.error("Failed to upload front image");
                    setProcessing(false);
                    return;
                }

                const { data: frontUrlData } = supabase.storage
                    .from('kyc-documents')
                    .getPublicUrl(frontPath);

                frontUrl = frontUrlData.publicUrl;
            }

            if (backFile) {
                const backExt = backFile.name.split('.').pop();
                const backFileName = `${userId}_${step}_${docType}_back_${Date.now()}.${backExt}`;
                const backPath = `${step}-documents/${backFileName}`;

                const { error: backError } = await supabase.storage
                    .from('kyc-documents')
                    .upload(backPath, backFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (backError) {
                    console.error('Back upload error:', backError);
                    toast.error("Failed to upload back image");
                    setProcessing(false);
                    return;
                }

                const { data: backUrlData } = supabase.storage
                    .from('kyc-documents')
                    .getPublicUrl(backPath);

                backUrl = backUrlData.publicUrl;
            }

            // Save to database
            const { saveProgress } = await import('../actions/authActions');

            if (step === 'identity') {
                const result = await saveProgress(userId, {
                    kyc_step: 'address_scan',
                    identity_doc_type: docType,
                    identity_doc_front_url: frontUrl,
                    identity_doc_back_url: backUrl,
                });

                if (result.success) {
                    toast.success("Identity document saved!");
                    setStep('address');
                    setDocType('aadhaar');
                    setFrontImage(null);
                    setBackImage(null);
                    setFrontFile(null);
                    setBackFile(null);
                } else {
                    toast.error("Failed to save. Please try again.");
                }
            } else if (step === 'address') {
                const result = await saveProgress(userId, {
                    kyc_step: 'liveness',
                    address_doc_type: docType,
                    address_doc_front_url: frontUrl,
                    address_doc_back_url: backUrl,
                });

                if (result.success) {
                    toast.success("Address document saved!");
                    router.push('/liveness');
                } else {
                    toast.error("Failed to save. Please try again.");
                }
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error("Something went wrong");
        } finally {
            setProcessing(false);
        }
    };

    const isIdentityStep = step === 'identity';
    const stepNumber = isIdentityStep ? '2' : '3';
    const stepTitle = isIdentityStep ? 'Proof of Identity' : 'Proof of Address';
    const stepDesc = isIdentityStep
        ? 'Upload both sides of your government-issued ID'
        : 'Upload both sides of your address proof document';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {/* Header */}
                            <div className="mb-6">
                                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                                    Step {stepNumber}: {stepTitle}
                                </div>
                                <h1 className="text-3xl font-bold text-slate-900 mb-2">{stepTitle}</h1>
                                <p className="text-slate-600">{stepDesc}</p>
                            </div>

                            {/* Document Type Selection */}
                            <Card className="border-none shadow-xl mb-6">
                                <CardContent className="p-6">
                                    <Label className="text-sm font-medium mb-2 block">
                                        Select Document Type <span className="text-red-500">*</span>
                                    </Label>
                                    <Select value={docType} onValueChange={setDocType}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isIdentityStep ? (
                                                <>
                                                    <SelectItem value="pan">PAN Card</SelectItem>
                                                    <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                                                    <SelectItem value="passport">Passport</SelectItem>
                                                    <SelectItem value="voter">Voter ID</SelectItem>
                                                </>
                                            ) : (
                                                <>
                                                    <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                                                    <SelectItem value="passport">Passport</SelectItem>
                                                    <SelectItem value="voter">Voter ID</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>

                            {/* Front Side Upload */}
                            <Card className="border-none shadow-xl mb-6">
                                <CardContent className="p-6">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                                            1
                                        </div>
                                        Front Side
                                    </h3>

                                    {!frontImage ? (
                                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                                            <FileUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                            <p className="text-slate-600 mb-4">Upload or scan the front side of your document</p>
                                            <div className="flex gap-3 justify-center">
                                                <Button
                                                    onClick={() => fileInputFrontRef.current?.click()}
                                                    variant="outline"
                                                >
                                                    <FileUp className="mr-2 h-4 w-4" />
                                                    Choose File
                                                </Button>
                                                <Button
                                                    onClick={() => handleCameraClick('front')}
                                                    variant="outline"
                                                >
                                                    <Camera className="mr-2 h-4 w-4" />
                                                    Use Camera
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={frontImage}
                                                alt="Front side"
                                                className="w-full h-auto rounded-lg border-2 border-slate-200"
                                            />
                                            <Button
                                                onClick={() => {
                                                    setFrontImage(null);
                                                    setFrontFile(null);
                                                }}
                                                variant="destructive"
                                                size="sm"
                                                className="absolute top-2 right-2"
                                            >
                                                <X className="h-4 w-4 mr-1" />
                                                Remove
                                            </Button>
                                            <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                <Check className="h-4 w-4" />
                                                Uploaded
                                            </div>
                                        </div>
                                    )}

                                    <input
                                        ref={fileInputFrontRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFrontFileUpload}
                                        className="hidden"
                                    />
                                </CardContent>
                            </Card>

                            {/* Back Side Upload */}
                            {docType !== 'passport' && (
                                <Card className="border-none shadow-xl mb-6">
                                    <CardContent className="p-6">
                                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                                                2
                                            </div>
                                            Back Side
                                        </h3>

                                        {!backImage ? (
                                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                                                <FileUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                                <p className="text-slate-600 mb-4">Upload or scan the back side of your document</p>
                                                <div className="flex gap-3 justify-center">
                                                    <Button
                                                        onClick={() => fileInputBackRef.current?.click()}
                                                        variant="outline"
                                                    >
                                                        <FileUp className="mr-2 h-4 w-4" />
                                                        Choose File
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleCameraClick('back')}
                                                        variant="outline"
                                                    >
                                                        <Camera className="mr-2 h-4 w-4" />
                                                        Use Camera
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                        <div className="relative">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={backImage}
                                                alt="Back side"
                                                className="w-full h-auto rounded-lg border-2 border-slate-200"
                                            />
                                            <Button
                                                onClick={() => {
                                                    setBackImage(null);
                                                    setBackFile(null);
                                                }}
                                                variant="destructive"
                                                size="sm"
                                                className="absolute top-2 right-2"
                                            >
                                                <X className="h-4 w-4 mr-1" />
                                                Remove
                                            </Button>
                                            <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                <Check className="h-4 w-4" />
                                                Uploaded
                                            </div>
                                        </div>
                                    )}

                                    <input
                                        ref={fileInputBackRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleBackFileUpload}
                                        className="hidden"
                                    />
                                </CardContent>
                            </Card>
                            )}

                            {/* Camera Modal - Full Screen Overlay */}
                            {showCamera && capturingFor && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="fixed inset-0 bg-black z-50 flex flex-col"
                                >
                                    <div className="flex justify-between items-center p-4 bg-slate-900">
                                        <h3 className="text-lg font-semibold text-white">
                                            Capture {capturingFor === 'front' ? 'Front' : 'Back'} Side
                                        </h3>
                                        <Button
                                            onClick={() => {
                                                setShowCamera(false);
                                                setCapturingFor(null);
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="text-white hover:bg-slate-800"
                                        >
                                            <X className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center p-4">
                                        <Webcam
                                            ref={webcamRef}
                                            audio={false}
                                            screenshotFormat="image/jpeg"
                                            className="max-w-full max-h-full rounded-lg"
                                            videoConstraints={{
                                                facingMode: "environment",
                                                width: { ideal: 1920 },
                                                height: { ideal: 1080 }
                                            }}
                                        />
                                    </div>
                                    <div className="p-4 bg-slate-900 space-y-3">
                                        <Button
                                            onClick={capture}
                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                            size="lg"
                                        >
                                            <Camera className="mr-2 h-5 w-5" />
                                            Capture Photo
                                        </Button>
                                        {!isDesktop && (
                                            <Button
                                                onClick={handleSendLink}
                                                variant="outline"
                                                className="w-full text-white border-white hover:bg-slate-800"
                                                size="lg"
                                            >
                                                <LinkIcon className="mr-2 h-5 w-5" />
                                                Send Link to Another Device
                                            </Button>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* Mobile Prompt */}
                            {showMobilePrompt && isDesktop && (
                                <Card className="border-2 border-blue-200 bg-blue-50/50 mb-6">
                                    <CardContent className="p-6">
                                        <div className="text-center">
                                            <Smartphone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Use Your Mobile Phone</h3>
                                            <p className="text-slate-600 mb-4">
                                                For the best document scanning experience, please use your mobile phone camera.
                                            </p>
                                            <div className="flex gap-3 justify-center">
                                                <Button
                                                    onClick={handleSendLink}
                                                    variant="outline"
                                                >
                                                    <LinkIcon className="mr-2 h-4 w-4" />
                                                    Send Link
                                                </Button>
                                                <Button
                                                    onClick={() => setShowMobilePrompt(false)}
                                                    variant="ghost"
                                                >
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Submit Button */}
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => router.back()}
                                    variant="outline"
                                    size="lg"
                                    className="flex-1"
                                >
                                    <ArrowLeft className="mr-2 h-5 w-5" />
                                    Back
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!frontImage || !backImage || processing}
                                    size="lg"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                >
                                    {processing ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            Continue
                                            <ArrowRight className="ml-2 h-5 w-5" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    </div>

                    {/* Progress Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6">
                            <KYCProgress
                                currentStep={step === 'identity' ? 'identity_scan' : 'address_scan'}
                                completedSteps={step === 'address' ? ['basic_details', 'identity_scan'] : ['basic_details']}
                                estimatedTime="3 min"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
