'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Check, AlertTriangle, Camera, FileUp, ArrowLeft, ArrowRight, X, Smartphone, Link as LinkIcon, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { KYCProgress } from '@/components/kyc-progress';
import { validateDocument, DocumentValidationResult } from '@/lib/document-validator';
import { DocumentScanner, DocumentScannerRef } from '@/components/document-scanner';
import { DetectedDocument } from '@/lib/edge-detection';

type UploadStep = 'identity' | 'address' | 'complete';

type ScanDocumentProps = {
    scanType: 'identity' | 'address';
    suggestedDocType?: string;
};

export function ScanDocument({ scanType, suggestedDocType }: ScanDocumentProps) {
    const router = useRouter();
    const scannerRef = useRef<DocumentScannerRef>(null);
    const fileInputFrontRef = useRef<HTMLInputElement>(null);
    const fileInputBackRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<UploadStep>(scanType);
    const [docType, setDocType] = useState(suggestedDocType || (scanType === 'identity' ? 'pan' : 'aadhaar'));

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
    const [documentDetected, setDocumentDetected] = useState<DetectedDocument | null>(null);

    const [processing, setProcessing] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [sendingEmail, setSendingEmail] = useState(false);

    // OCR Validation state
    const [validatingFront, setValidatingFront] = useState(false);
    const [validatingBack, setValidatingBack] = useState(false);
    const [frontValidation, setFrontValidation] = useState<DocumentValidationResult | null>(null);
    const [backValidation, setBackValidation] = useState<DocumentValidationResult | null>(null);
    const [userData, setUserData] = useState<{ full_name: string; date_of_birth: string } | null>(null);

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

                const { getUserProgress } = await import('@/app/actions/authActions');
                const { calculateCompletedSteps } = await import('@/lib/kyc-progress-utils');

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

                    // Store user data for validation
                    setUserData({
                        full_name: user.full_name,
                        date_of_birth: new Date(user.date_of_birth).toISOString().split('T')[0]
                    });

                    // Store user email for sending link
                    if (user.email) {
                        setUserEmail(user.email);
                    }

                    // Use 'as any' to bypass strict type checking for now since we know the fields exist in DB schema
                    const userData = user as any;

                    if (scanType === 'identity') {
                        setStep('identity');
                        // If suggested doc type exists, use it, otherwise use existing doc type or default
                        if (!suggestedDocType && user.identity_doc_type) {
                            setDocType(user.identity_doc_type);
                        }

                        // Reset validation states
                        setFrontValidation(null);
                        setBackValidation(null);
                        setFrontFile(null);
                        setBackFile(null);

                        if (!suggestedDocType && user.identity_doc_type) {
                            setFrontImage(userData.identity_doc_front_url);
                            setBackImage(userData.identity_doc_back_url);
                        } else {
                            // Reset images for new upload
                            setFrontImage(null);
                            setBackImage(null);
                        }
                    } else if (scanType === 'address') {
                        setStep('address');
                        // If suggested doc type exists, use it, otherwise use existing doc type or default
                        if (!suggestedDocType && user.address_doc_type) {
                            setDocType(user.address_doc_type);
                        }

                        // Reset validation states
                        setFrontValidation(null);
                        setBackValidation(null);
                        setFrontFile(null);
                        setBackFile(null);

                        if (!suggestedDocType && user.address_doc_type) {
                            setFrontImage(userData.address_doc_front_url || userData.address_doc_image_url);
                            setBackImage(userData.address_doc_back_url);
                        } else {
                            setFrontImage(null);
                            setBackImage(null);
                        }
                    }

                    // Set completed steps based on user progress
                    const steps = calculateCompletedSteps(user);
                    setCompletedSteps(steps);
                }
            } catch (error) {
                console.error('Error checking progress:', error);
            }
        };

        checkProgress();
    }, [router, scanType, suggestedDocType]);

    const handleFrontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFrontFile(file);
            setFrontValidation(null); // Reset previous validation

            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setFrontImage(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);

            // Perform OCR validation
            toast.info("Validating document...");
            setValidatingFront(true);

            try {
                const validationResult = await validateDocument(file, {
                    expectedType: docType as 'pan' | 'aadhaar' | 'passport' | 'voter' | 'driving_license',
                    expectedName: userData?.full_name,
                    expectedDob: userData?.date_of_birth
                });

                setFrontValidation(validationResult);

                if (validationResult.isValid) {
                    toast.success("Document validated successfully!");
                } else {
                    toast.error("Document validation failed. Please check the errors.");
                }

                // Show warnings if any
                validationResult.warnings.forEach(warning => {
                    toast.warning(warning);
                });
            } catch (error) {
                console.error('Validation error:', error);
                toast.error("Failed to validate document. You can still proceed, but manual review may be required.");
            } finally {
                setValidatingFront(false);
            }
        }
    };

    const handleBackFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBackFile(file);
            setBackValidation(null); // Reset previous validation

            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setBackImage(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);

            // Perform OCR validation for back side (less strict)
            toast.info("Validating document...");
            setValidatingBack(true);

            try {
                const validationResult = await validateDocument(file, {
                    expectedType: docType as 'pan' | 'aadhaar' | 'passport' | 'voter' | 'driving_license',
                    expectedName: userData?.full_name,
                    expectedDob: userData?.date_of_birth
                });

                setBackValidation(validationResult);

                if (validationResult.isValid) {
                    toast.success("Document validated successfully!");
                } else if (validationResult.errors.length > 0) {
                    // For back side, we're more lenient - just warn if there are issues
                    toast.warning("Document validation completed with some warnings.");
                }

                // Show warnings if any
                validationResult.warnings.forEach(warning => {
                    toast.warning(warning);
                });
            } catch (error) {
                console.error('Validation error:', error);
                toast.info("Back side uploaded. Manual review may be required.");
            } finally {
                setValidatingBack(false);
            }
        }
    };

    const handleCameraClick = (side: 'front' | 'back') => {
        console.log('Camera clicked for:', side, 'isDesktop:', isDesktop);
        setPendingSide(side);

        // Show mobile prompt for desktop users
        if (isDesktop) {
            setShowMobilePrompt(true);
        } else {
            setCapturingFor(side);
            setShowCamera(true);
        }
    };

    const handleContinueOnDesktop = () => {
        if (pendingSide) {
            setShowMobilePrompt(false);
            setCapturingFor(pendingSide);
            setShowCamera(true);
        }
    };

    const capture = useCallback(async () => {
        const imageSrc = scannerRef.current?.getScreenshot();
        const quality = scannerRef.current?.getImageQuality();

        if (imageSrc && capturingFor) {
            // Convert base64 to File
            try {
                const res = await fetch(imageSrc);
                const blob = await res.blob();
                const file = new File([blob], `${capturingFor}_${Date.now()}.jpg`, { type: 'image/jpeg' });

                // Close camera modal first
                setShowCamera(false);
                setDocumentDetected(null);

                if (capturingFor === 'front') {
                    setFrontImage(imageSrc);
                    setFrontFile(file);
                    setFrontValidation(null); // Reset previous validation
                    toast.success("Front side captured. Analyzing quality and validating document...");

                    // Perform quality checks and OCR validation
                    setValidatingFront(true);

                    try {
                        // Check image quality after capture
                        if (quality?.isBlurry) {
                            toast.warning(`Image appears blurry (score: ${quality.blurScore}). Consider retaking for better results.`);
                        }

                        if (quality?.isLowLight) {
                            toast.warning(`Image has low lighting (brightness: ${quality.brightness}). Consider retaking in better light.`);
                        }

                        const validationResult = await validateDocument(file, {
                            expectedType: docType as 'pan' | 'aadhaar' | 'passport' | 'voter' | 'driving_license',
                            expectedName: userData?.full_name,
                            expectedDob: userData?.date_of_birth
                        });

                        setFrontValidation(validationResult);

                        if (validationResult.isValid) {
                            toast.success("Document validated successfully!");
                        } else {
                            toast.error("Document validation failed. Please check the errors.");
                        }

                        // Show warnings if any
                        validationResult.warnings.forEach(warning => {
                            toast.warning(warning);
                        });
                    } catch (error) {
                        console.error('Validation error:', error);
                        toast.error("Failed to validate document. You can still proceed, but manual review may be required.");
                    } finally {
                        setValidatingFront(false);
                    }
                } else {
                    setBackImage(imageSrc);
                    setBackFile(file);
                    setBackValidation(null); // Reset previous validation
                    toast.success("Back side captured. Analyzing quality and validating document...");

                    // Perform quality checks and OCR validation for back side
                    setValidatingBack(true);

                    try {
                        // Check image quality after capture
                        if (quality?.isBlurry) {
                            toast.warning(`Image appears blurry (score: ${quality.blurScore}). Consider retaking for better results.`);
                        }

                        if (quality?.isLowLight) {
                            toast.warning(`Image has low lighting (brightness: ${quality.brightness}). Consider retaking in better light.`);
                        }

                        const validationResult = await validateDocument(file, {
                            expectedType: docType as 'pan' | 'aadhaar' | 'passport' | 'voter' | 'driving_license',
                            expectedName: userData?.full_name,
                            expectedDob: userData?.date_of_birth
                        });

                        setBackValidation(validationResult);

                        if (validationResult.isValid) {
                            toast.success("Document validated successfully!");
                        } else if (validationResult.errors.length > 0) {
                            // For back side, we're more lenient - just warn if there are issues
                            toast.warning("Document validation completed with some warnings.");
                        }

                        // Show warnings if any
                        validationResult.warnings.forEach(warning => {
                            toast.warning(warning);
                        });
                    } catch (error) {
                        console.error('Validation error:', error);
                        toast.info("Back side uploaded. Manual review may be required.");
                    } finally {
                        setValidatingBack(false);
                    }
                }

                setCapturingFor(null);
            } catch (error) {
                console.error('Error capturing image:', error);
                toast.error("Failed to capture image. Please try again.");
            }
        }
    }, [scannerRef, capturingFor, docType, userData]);

    const handleSendLink = async () => {
        const currentUrl = window.location.href;

        try {
            await navigator.clipboard.writeText(currentUrl);
            toast.success("Link copied! Open it on your phone to continue.", {
                description: "You can paste and send the link via WhatsApp, Email, or any messaging app.",
                duration: 5000
            });
            // Keep modal open so user can see instructions
        } catch (err) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = currentUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success("Link copied! Open it on your phone to continue.", {
                description: "You can paste and send the link via WhatsApp, Email, or any messaging app.",
                duration: 5000
            });
        }
    };

    const handleSendEmail = async () => {
        if (!userEmail) {
            toast.error("Email not found. Please complete your profile first.");
            return;
        }

        setSendingEmail(true);

        try {
            const currentUrl = window.location.href;

            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: userEmail,
                    url: currentUrl
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`Link sent to ${userEmail}!`, {
                    description: "Check your email inbox and click the link to continue on your phone.",
                    duration: 5000
                });
                setShowMobilePrompt(false);
            } else {
                throw new Error(data.error || 'Failed to send email');
            }
        } catch (error) {
            console.error('Error sending email:', error);
            toast.error("Failed to send email. Please try copying the link instead.", {
                description: "You can manually share the link via WhatsApp or other messaging apps.",
                duration: 5000
            });
        } finally {
            setSendingEmail(false);
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

        // Check if validation is still in progress
        if (validatingFront || validatingBack) {
            toast.error("Please wait for document validation to complete");
            return;
        }

        // Check front document validation
        if (frontValidation && !frontValidation.isValid) {
            toast.error("Front document validation failed. Please upload a valid document matching your selection.");
            return;
        }

        // Warn if no validation was performed (validation service might be down)
        if (!frontValidation && frontFile) {
            toast.warning("Document validation was skipped. Manual review will be required.");
        }

        if (!userId) {
            toast.error("Session error. Please login again.");
            router.push('/verify');
            return;
        }

        setProcessing(true);

        try {
            // Upload front and back images to Supabase Storage
            // Initialize with existing URLs if available (and not base64 data URIs)
            let frontUrl = frontImage && !frontImage.startsWith('data:') ? frontImage : null;
            let backUrl = backImage && !backImage.startsWith('data:') ? backImage : null;

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
            const { saveProgress } = await import('@/app/actions/authActions');

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
                    // Immediately mark identity scan as completed in the UI
                    setCompletedSteps(prev => [...prev.filter(s => s !== 'identity_scan'), 'identity_scan']);
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
                                    <Select value={docType} onValueChange={(value) => {
                                        setDocType(value);
                                        // Reset images and validation when doc type changes
                                        setFrontImage(null);
                                        setBackImage(null);
                                        setFrontFile(null);
                                        setBackFile(null);
                                        setFrontValidation(null);
                                        setBackValidation(null);
                                    }}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
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
                                        <div className="space-y-4">
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
                                                        setFrontValidation(null);
                                                    }}
                                                    variant="destructive"
                                                    size="sm"
                                                    className="absolute top-2 right-2"
                                                >
                                                    <X className="h-4 w-4 mr-1" />
                                                    Remove
                                                </Button>

                                                {/* Validation Status Badge */}
                                                {validatingFront && (
                                                    <div className="absolute top-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Validating...
                                                    </div>
                                                )}
                                                {!validatingFront && frontValidation && frontValidation.isValid && (
                                                    <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                        <CheckCircle className="h-4 w-4" />
                                                        Verified
                                                    </div>
                                                )}
                                                {!validatingFront && frontValidation && !frontValidation.isValid && (
                                                    <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                        <XCircle className="h-4 w-4" />
                                                        Failed
                                                    </div>
                                                )}
                                                {!validatingFront && !frontValidation && (
                                                    <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                        <Check className="h-4 w-4" />
                                                        Uploaded
                                                    </div>
                                                )}
                                            </div>

                                            {/* Validation Results */}
                                            {!validatingFront && frontValidation && (
                                                <div className="space-y-2">
                                                    {/* Detected Type */}
                                                    {frontValidation.detectedType && (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="text-slate-600">Detected:</span>
                                                            <span className="font-semibold text-slate-900">
                                                                {frontValidation.detectedType.toUpperCase()}
                                                            </span>
                                                            <span className="text-slate-500">
                                                                ({Math.round(frontValidation.confidence)}% confidence)
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Extracted Data */}
                                                    {frontValidation.extractedData.documentNumber && (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="text-slate-600">Document Number:</span>
                                                            <span className="font-mono font-semibold text-slate-900">
                                                                {frontValidation.extractedData.documentNumber}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Errors */}
                                                    {frontValidation.errors.length > 0 && (
                                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                            <div className="flex items-start gap-2">
                                                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                                <div className="space-y-1">
                                                                    {frontValidation.errors.map((error, idx) => (
                                                                        <p key={idx} className="text-sm text-red-700">{error}</p>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Warnings */}
                                                    {frontValidation.warnings.length > 0 && (
                                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                            <div className="flex items-start gap-2">
                                                                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                                <div className="space-y-1">
                                                                    {frontValidation.warnings.map((warning, idx) => (
                                                                        <p key={idx} className="text-sm text-yellow-700">{warning}</p>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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
                                            <div className="space-y-4">
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
                                                            setBackValidation(null);
                                                        }}
                                                        variant="destructive"
                                                        size="sm"
                                                        className="absolute top-2 right-2"
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Remove
                                                    </Button>

                                                    {/* Validation Status Badge */}
                                                    {validatingBack && (
                                                        <div className="absolute top-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Validating...
                                                        </div>
                                                    )}
                                                    {!validatingBack && backValidation && backValidation.isValid && (
                                                        <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                            <CheckCircle className="h-4 w-4" />
                                                            Verified
                                                        </div>
                                                    )}
                                                    {!validatingBack && backValidation && !backValidation.isValid && (
                                                        <div className="absolute top-2 left-2 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                            <AlertTriangle className="h-4 w-4" />
                                                            Warning
                                                        </div>
                                                    )}
                                                    {!validatingBack && !backValidation && (
                                                        <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                                            <Check className="h-4 w-4" />
                                                            Uploaded
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Validation Results */}
                                                {!validatingBack && backValidation && (
                                                    <div className="space-y-2">
                                                        {/* Detected Type */}
                                                        {backValidation.detectedType && (
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <span className="text-slate-600">Detected:</span>
                                                                <span className="font-semibold text-slate-900">
                                                                    {backValidation.detectedType.toUpperCase()}
                                                                </span>
                                                                <span className="text-slate-500">
                                                                    ({Math.round(backValidation.confidence)}% confidence)
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Address if extracted */}
                                                        {backValidation.extractedData.address && (
                                                            <div className="flex flex-col gap-1 text-sm">
                                                                <span className="text-slate-600">Address:</span>
                                                                <span className="text-slate-900">
                                                                    {backValidation.extractedData.address}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Errors */}
                                                        {backValidation.errors.length > 0 && (
                                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                                <div className="flex items-start gap-2">
                                                                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                                    <div className="space-y-1">
                                                                        {backValidation.errors.map((error, idx) => (
                                                                            <p key={idx} className="text-sm text-yellow-700">{error}</p>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Warnings */}
                                                        {backValidation.warnings.length > 0 && (
                                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                                <div className="flex items-start gap-2">
                                                                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                                    <div className="space-y-1">
                                                                        {backValidation.warnings.map((warning, idx) => (
                                                                            <p key={idx} className="text-sm text-yellow-700">{warning}</p>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
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
                                    className="fixed inset-0 bg-black z-[100] flex flex-col"
                                    style={{ height: '100dvh' }}
                                >
                                    {/* Header */}
                                    <div className="flex-shrink-0 flex justify-between items-center p-4 bg-slate-900/95 backdrop-blur-sm">
                                        <h3 className="text-base sm:text-lg font-semibold text-white">
                                            Capture {capturingFor === 'front' ? 'Front' : 'Back'} Side
                                        </h3>
                                        <Button
                                            onClick={() => {
                                                setShowCamera(false);
                                                setCapturingFor(null);
                                                setDocumentDetected(null);
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="text-white hover:bg-slate-800"
                                        >
                                            <X className="h-5 w-5" />
                                        </Button>
                                    </div>

                                    {/* Camera View */}
                                    <div className="flex-1 relative overflow-hidden bg-black">
                                        <DocumentScanner
                                            ref={scannerRef}
                                            onDocumentDetected={setDocumentDetected}
                                            onError={(err) => toast.error("Camera error: " + (typeof err === 'string' ? err : err.message))}
                                            detectionInterval={500}
                                            className="absolute inset-0 w-full h-full"
                                        />
                                    </div>

                                    {/* Controls */}
                                    <div className="flex-shrink-0 p-4 bg-slate-900/95 backdrop-blur-sm space-y-3 safe-bottom">
                                        <Button
                                            onClick={capture}
                                            className={`w-full ${documentDetected && documentDetected.confidence > 0.7
                                                ? 'bg-green-600 hover:bg-green-700'
                                                : 'bg-blue-600 hover:bg-blue-700'
                                                }`}
                                            size="lg"
                                        >
                                            <Camera className="mr-2 h-5 w-5" />
                                            {documentDetected && documentDetected.confidence > 0.7
                                                ? 'Capture Now'
                                                : 'Capture Photo'}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Mobile Continuation Prompt Modal */}
                            {showMobilePrompt && isDesktop && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                                    onClick={() => setShowMobilePrompt(false)}
                                >
                                    <motion.div
                                        initial={{ scale: 0.95, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                                    >
                                        {/* Header */}
                                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white relative">
                                            <Button
                                                onClick={() => setShowMobilePrompt(false)}
                                                variant="ghost"
                                                size="sm"
                                                className="absolute top-3 right-3 text-white hover:bg-white/20"
                                            >
                                                <X className="h-5 w-5" />
                                            </Button>
                                            <div className="flex items-center gap-3 mb-2">
                                                <Smartphone className="w-10 h-10" />
                                                <div>
                                                    <h3 className="text-xl font-bold">Continue on Phone</h3>
                                                    <p className="text-sm text-blue-100">Better quality & easier scanning</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-5 space-y-4">
                                            {/* Email Display */}
                                            {userEmail && (
                                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                                    <p className="text-xs text-blue-600 font-medium mb-1">Sending to:</p>
                                                    <p className="text-sm text-blue-900 font-semibold">{userEmail}</p>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="space-y-2">
                                                {userEmail && (
                                                    <Button
                                                        onClick={handleSendEmail}
                                                        disabled={sendingEmail}
                                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                                        size="lg"
                                                    >
                                                        {sendingEmail ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                                Sending Email...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Smartphone className="mr-2 h-5 w-5" />
                                                                Send Link to Email
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                                <Button
                                                    onClick={handleSendLink}
                                                    variant="outline"
                                                    className="w-full"
                                                >
                                                    <LinkIcon className="mr-2 h-4 w-4" />
                                                    Copy Link
                                                </Button>
                                                <Button
                                                    onClick={handleContinueOnDesktop}
                                                    variant="ghost"
                                                    className="w-full text-slate-600"
                                                >
                                                    Use Camera Here
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                </motion.div>
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
                                    disabled={
                                        !frontImage ||
                                        (!backImage && docType !== 'passport') ||
                                        processing ||
                                        validatingFront ||
                                        validatingBack ||
                                        Boolean(frontValidation && !frontValidation.isValid)
                                    }
                                    size="lg"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                >
                                    {processing ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Processing...
                                        </>
                                    ) : validatingFront || validatingBack ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Validating Document...
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
                                completedSteps={completedSteps}
                                estimatedTime="3 min"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
