'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, RefreshCw, Check, AlertTriangle, Camera, FileUp, ArrowLeft, Smartphone, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { KYCProgress } from '@/components/kyc-progress';

type UploadMode = 'choice' | 'camera' | 'upload';
type UploadStep = 'identity' | 'address' | 'complete';

interface ExtractedData {
    name: string;
    idNumber: string;
    dob: string;
    docType: string;
    image: string | null;
}

export default function ScanPage() {
    const webcamRef = useRef<Webcam>(null);
    const fileInputFrontRef = useRef<HTMLInputElement>(null);
    const fileInputBackRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<UploadStep>('identity');
    const [frontImage, setFrontImage] = useState<string | null>(null);
    const [backImage, setBackImage] = useState<string | null>(null);
    const [frontFile, setFrontFile] = useState<File | null>(null);
    const [backFile, setBackFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [docType, setDocType] = useState('pan');
    const [identityData, setIdentityData] = useState<ExtractedData | null>(null);
    const [addressData, setAddressData] = useState<ExtractedData | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
    const [attempts, setAttempts] = useState(1);
    const [userId, setUserId] = useState<string | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);
    const [showMobilePrompt, setShowMobilePrompt] = useState(false);
    const [capturingFor, setCapturingFor] = useState<'front' | 'back' | null>(null);
    const MAX_ATTEMPTS = 3;
    const router = useRouter();

    // Check if user is on desktop
    useEffect(() => {
        const checkDevice = () => {
            const ua = navigator.userAgent;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const isTablet = /iPad|Android/i.test(ua) && !/Mobile/i.test(ua);
            setIsDesktop(!isMobile && !isTablet);
            // Don't show prompt on initial load, only when camera is selected
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

                // Get user progress to resume
                const { getUserProgress } = await import('../actions/authActions');
                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    const user = result.user;

                    // If user has completed KYC, redirect to submission
                    if (user.kyc_status === 'completed') {
                        router.push('/submission');
                        return;
                    }

                    // Resume from saved step
                    if (user.kyc_step === 'identity_scan' || user.kyc_step === 'address_scan') {
                        // Check if identity was already saved
                        if (user.identity_doc_type && user.kyc_step === 'address_scan') {
                            setStep('address');
                            setDocType('aadhaar');
                            toast.info("Resuming address document upload...");
                        } else {
                            setStep('identity');
                            setDocType('pan');
                            if (user.kyc_step === 'identity_scan') {
                                toast.info("Resuming identity document upload...");
                            }
                        }
                    } else if (user.kyc_step === 'liveness') {
                        // User is at liveness step, redirect there
                        router.push('/liveness');
                    }
                }
            } catch (error) {
                console.error('Error checking progress:', error);
            }
        };

        checkProgress();
    }, [router]);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc && capturingFor) {
            if (capturingFor === 'front') {
                setFrontImage(imageSrc);
                toast.success("Front side captured");
            } else {
                setBackImage(imageSrc);
                toast.success("Back side captured");
            }
            setCapturingFor(null);
        } else {
            toast.error("Could not capture image. Try again.");
        }
    }, [webcamRef, capturingFor]);

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

    const handleCameraForSide = (side: 'front' | 'back') => {
        if (isDesktop) {
            setShowMobilePrompt(true);
        } else {
            setCapturingFor(side);
        }
    };

    const finalize = async () => {
        if (!userId) {
            toast.error("Session error. Please login again.");
            router.push('/verify');
            return;
        }

        // Save current document data
        const extractedData = {
            name: "GAUTAM HAZARIKA",
            idNumber: "ABCDE1234F",
            dob: new Date("1995-01-01").toISOString(),
            docType: docType,
            image: imgSrcFront // Store front image (we'll add back later)
        };

        setProcessing(true);

        try {
            const { saveProgress } = await import('../actions/authActions');

            if (step === 'identity') {
                // Save identity document to database
                const result = await saveProgress(userId, {
                    kyc_step: 'address_scan',
                    identity_doc_type: docType,
                    identity_doc_number: extractedData.idNumber,
                    full_name: extractedData.name,
                    date_of_birth: extractedData.dob,
                    // In production, you would upload the image to Supabase Storage
                    // identity_doc_image_url: uploadedUrl
                });

                if (result.success) {
                    setIdentityData(extractedData);
                    // Move to address document
                    setStep('address');
                    setMode('choice');
                    setImgSrc(null);
                    setOcrStep(false);
                    setDocType('aadhaar');
                    toast.success("Identity document saved! Now upload address proof.");
                } else {
                    toast.error("Failed to save progress. Please try again.");
                }
            } else if (step === 'address') {
                // Save address document to database
                const result = await saveProgress(userId, {
                    kyc_step: 'liveness',
                    address_doc_type: docType,
                    address_doc_number: extractedData.idNumber,
                    address_line: '123 Main Street, Mumbai 400001', // From OCR
                    // In production, you would upload the image to Supabase Storage
                    // address_doc_image_url: uploadedUrl
                });

                if (result.success) {
                    setAddressData(extractedData);
                    // Both documents uploaded, proceed to liveness
                    toast.success("Both documents verified!");
                    router.push('/liveness');
                } else {
                    toast.error("Failed to save progress. Please try again.");
                }
            }
        } catch (error) {
            console.error('Error saving progress:', error);
            toast.error("Something went wrong. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    const handleCameraClick = () => {
        // Check if on desktop, show prompt before enabling camera
        if (isDesktop) {
            setShowMobilePrompt(true);
        } else {
            setMode('camera');
        }
    };

    const handleSendLink = async () => {
        const currentUrl = window.location.href;

        try {
            // Copy to clipboard
            await navigator.clipboard.writeText(currentUrl);
            toast.success("Link copied to clipboard! Share it with your phone.");
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = currentUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success("Link copied to clipboard! Share it with your phone.");
        }
    };

    const renderContent = () => {
        // Show mobile prompt for desktop users
        if (showMobilePrompt && isDesktop) {
            return (
                <Card className="max-w-2xl w-full bg-white shadow-xl border-none p-8 space-y-6 mx-auto">
                    <div className="text-center">
                        <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <Smartphone className="w-10 h-10 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Use Your Mobile Phone</h2>
                        <p className="text-slate-600 mb-6">
                            For the best document scanning experience, please continue this process on your mobile phone.
                            Mobile cameras provide better quality for document capture.
                        </p>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-6 space-y-4">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <LinkIcon className="w-5 h-5 text-blue-600" />
                            How to continue on mobile:
                        </h3>
                        <ol className="text-sm text-slate-700 space-y-2 ml-6 list-decimal">
                            <li>Click the &quot;Send Link&quot; button below to copy the link</li>
                            <li>Share the link to your mobile phone (via SMS, email, or messaging app)</li>
                            <li>Open the link on your phone to continue the KYC process</li>
                        </ol>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleSendLink}
                            size="lg"
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            <LinkIcon className="mr-2 h-5 w-5" />
                            Send Link to Phone
                        </Button>
                        <Button
                            onClick={() => {
                                setShowMobilePrompt(false);
                                setMode('camera');
                            }}
                            variant="outline"
                            size="lg"
                            className="w-full"
                        >
                            Continue on Desktop Anyway
                        </Button>
                        <Button
                            onClick={() => setShowMobilePrompt(false)}
                            variant="ghost"
                            className="w-full"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Go Back
                        </Button>
                    </div>
                </Card>
            );
        }

        if (attempts > MAX_ATTEMPTS) {
            return (
                <Card className="max-w-md w-full bg-white shadow-xl border-none text-center p-8 space-y-4 mx-auto">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Maximum Attempts Exceeded</h2>
                    <p className="text-slate-600">
                        You have exceeded the maximum of {MAX_ATTEMPTS} attempts for document verification.
                        Please contact support for assistance.
                    </p>
                    <Button className="w-full" variant="outline" onClick={() => router.push('/')}>
                        Return to Home
                    </Button>
                </Card>
            );
        }

        if (mode === 'choice' && !imgSrc) {
            // ... existing choice rendering logic
            const isIdentityStep = step === 'identity';
            const stepNumber = isIdentityStep ? '2' : '3';
            const stepTitle = isIdentityStep ? 'Proof of Identity' : 'Proof of Address';
            const stepDesc = isIdentityStep
                ? 'Upload a government-issued ID document'
                : 'Upload a document showing your current address';

            return (
                <div className="w-full">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-left mb-8"
                    >
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                            Step {stepNumber}: {stepTitle}
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">{stepTitle}</h1>
                        <p className="text-slate-600">{stepDesc}</p>
                    </motion.div>

                    <Card className="border-none shadow-xl bg-white mb-6">
                        <CardContent className="p-8">
                            {/* ... Content of choice card ... */}
                            <div className="mb-6">
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Document Type</label>
                                <Select value={docType} onValueChange={setDocType}>
                                    <SelectTrigger className="w-full h-12 text-base">
                                        <SelectValue placeholder="Select Document" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isIdentityStep ? (
                                            <>
                                                <SelectItem value="pan">PAN Card</SelectItem>
                                                <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                                                <SelectItem value="passport">Passport</SelectItem>
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
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <button
                                        onClick={() => {
                                            fileInputRef.current?.click();
                                        }}
                                        className="w-full p-6 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                                    >
                                        <div className="flex flex-col items-center text-center">
                                            <div className="w-16 h-16 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center mb-4 transition-colors">
                                                <FileUp className="w-8 h-8 text-blue-600" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload from Device</h3>
                                            <p className="text-sm text-slate-600">Choose an image from your gallery or files</p>
                                        </div>
                                    </button>
                                </motion.div>

                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <button
                                        onClick={handleCameraClick}
                                        className="w-full p-6 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                                    >
                                        <div className="flex flex-col items-center text-center">
                                            <div className="w-16 h-16 rounded-full bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center mb-4 transition-colors">
                                                <Camera className="w-8 h-8 text-indigo-600" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Use Camera</h3>
                                            <p className="text-sm text-slate-600">Capture document using your camera</p>
                                        </div>
                                    </button>
                                </motion.div>
                            </div>

                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return (
            <div className="w-full">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            if (imgSrc) {
                                setImgSrc(null);
                                setOcrStep(false);
                            } else if (mode === 'camera') {
                                setMode('choice');
                            } else if (step === 'address' && identityData) {
                                // Go back to identity step
                                setStep('identity');
                                setMode('choice');
                            } else {
                                router.back();
                            }
                        }}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                </div>

                <Card className="bg-white shadow-xl border-none overflow-hidden">
                    <CardContent className="p-0">
                        <AnimatePresence mode="wait">
                            {/* Camera View */}
                            {mode === 'camera' && !imgSrc && (
                                <motion.div
                                    key="camera"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="relative bg-black min-h-[600px] flex flex-col"
                                >
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        className="w-full h-full object-cover"
                                        videoConstraints={{ facingMode: "environment" }}
                                        onUserMediaError={() => {
                                            toast.error("Camera permission denied.");
                                            setMode('choice');
                                        }}
                                    />

                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <div className="w-4/5 aspect-[1.6/1] border-2 border-white/50 rounded-lg relative">
                                            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                                            <div className="absolute -top-2 -right-2 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                                            <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                                            <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                                        </div>
                                        <div className="mt-6 text-center">
                                            <p className="text-white font-medium bg-black/60 px-4 py-2 rounded-full inline-block mb-2">
                                                Align {docType.toUpperCase()} within the frame
                                            </p>
                                            <p className="text-white/80 text-sm bg-black/40 px-3 py-1 rounded-full inline-block">
                                                {step === 'identity' ? 'Proof of Identity' : 'Proof of Address'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-auto">
                                        <button
                                            onClick={capture}
                                            className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
                                        >
                                            <div className="w-12 h-12 bg-white rounded-full"></div>
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Review Screen */}
                            {imgSrc && !ocrStep && (
                                <motion.div
                                    key="review"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="p-8"
                                >
                                    <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">Review Document</h2>
                                    <div className="mb-6 relative rounded-lg overflow-hidden border-2 border-slate-200">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={imgSrc} alt="Document" className="w-full h-auto" />
                                    </div>
                                    <p className="text-sm text-slate-600 mb-6 text-center">
                                        Ensure all details are clear and readable
                                    </p>
                                    <div className="flex gap-3">
                                        <Button variant="outline" onClick={retake} className="flex-1">
                                            <RefreshCw className="mr-2 h-4 w-4" /> Retake
                                        </Button>
                                        <Button onClick={confirmImage} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={processing}>
                                            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" /> Confirm</>}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {/* OCR Confirmation */}
                            {ocrStep && (
                                <motion.div
                                    key="ocr"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="p-8"
                                >
                                    <div className="text-center mb-6">
                                        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-3">
                                            <Check className="w-6 h-6" />
                                        </div>
                                        <h2 className="text-xl font-bold text-slate-900">Extracted Details</h2>
                                        <p className="text-sm text-slate-600">
                                            {step === 'identity'
                                                ? 'Verify your identity details'
                                                : 'Verify your address details'}
                                        </p>
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Name</p>
                                            <p className="text-base font-medium text-slate-900">GAUTAM HAZARIKA</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <p className="text-xs uppercase text-slate-500 font-semibold mb-1">
                                                {step === 'identity' ? 'ID Number' : 'Document Number'}
                                            </p>
                                            <p className="text-base font-medium text-slate-900">ABCDE1234F</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <p className="text-xs uppercase text-slate-500 font-semibold mb-1">
                                                {step === 'identity' ? 'Date of Birth' : 'Address'}
                                            </p>
                                            <p className="text-base font-medium text-slate-900">
                                                {step === 'identity' ? '01/01/1995' : '123 Main Street, Mumbai 400001'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Button onClick={finalize} size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
                                            {step === 'identity'
                                                ? 'Confirm & Upload Address Proof'
                                                : 'Confirm & Proceed to Liveness'}
                                        </Button>
                                        <Button onClick={retake} variant="ghost" className="w-full text-slate-600">
                                            Details Incorrect? Retake
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        {renderContent()}
                    </div>
                    <div className="lg:col-span-1">
                        <div className="sticky top-6">
                            <KYCProgress
                                currentStep={step === 'identity' ? 'identity_scan' : 'address_scan'}
                                completedSteps={['basic_details', 'document_guidance', ...(step === 'address' ? ['identity_scan'] : [])]}
                                estimatedTime={step === 'identity' ? '3 min' : '2 min'}
                                showSaveResume={true}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
