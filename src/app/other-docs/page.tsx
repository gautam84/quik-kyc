'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Check, AlertTriangle, Camera, FileUp, ArrowLeft, ArrowRight, X, Smartphone, Link as LinkIcon, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { validateDocument, DocumentValidationResult } from '@/lib/document-validator';
import { DocumentScanner, DocumentScannerRef } from '@/components/document-scanner';
import { DetectedDocument } from '@/lib/edge-detection';

export default function OtherDocsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const scannerRef = useRef<DocumentScannerRef>(null);
    const fileInputFrontRef = useRef<HTMLInputElement>(null);
    const fileInputBackRef = useRef<HTMLInputElement>(null);

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
    const [documentDetected, setDocumentDetected] = useState<DetectedDocument | null>(null);

    const [processing, setProcessing] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
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

                const { getUserProgress } = await import('../actions/authActions');

                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    const user = result.user;

                    // Store user data for validation
                    setUserData({
                        full_name: user.full_name || '',
                        date_of_birth: user.date_of_birth ? new Date(user.date_of_birth).toISOString().split('T')[0] : ''
                    });

                    // Store user email for sending link
                    if (user.email) {
                        setUserEmail(user.email);
                    }

                    // Set initial doc type from URL param
                    const suggestedParam = searchParams.get('suggested');
                    if (suggestedParam && (suggestedParam === 'pan' || suggestedParam === 'aadhaar')) {
                        setDocType(suggestedParam);
                    }
                }
            } catch (error) {
                console.error('Error checking progress:', error);
            }
        };

        checkProgress();
    }, [router, searchParams]);

    // Reset images when docType changes
    useEffect(() => {
        setFrontImage(null);
        setBackImage(null);
        setFrontFile(null);
        setBackFile(null);
        setFrontValidation(null);
        setBackValidation(null);
    }, [docType]);

    const handleFrontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFrontFile(file);
            setFrontValidation(null);

            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setFrontImage(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);

            toast.info("Validating document...");
            setValidatingFront(true);

            try {
                const validationResult = await validateDocument(file, {
                    expectedType: docType as 'pan' | 'aadhaar',
                    expectedName: userData?.full_name,
                    expectedDob: userData?.date_of_birth
                });

                setFrontValidation(validationResult);

                if (validationResult.isValid) {
                    toast.success("Document validated successfully!");
                } else {
                    toast.error("Document validation failed. Please check the errors.");
                }

                validationResult.warnings.forEach(warning => {
                    toast.warning(warning);
                });
            } catch (error) {
                console.error('Validation error:', error);
                toast.error("Failed to validate document.");
            } finally {
                setValidatingFront(false);
            }
        }
    };

    const handleBackFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBackFile(file);
            setBackValidation(null);

            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setBackImage(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);

            toast.info("Validating document...");
            setValidatingBack(true);

            try {
                const validationResult = await validateDocument(file, {
                    expectedType: docType as 'pan' | 'aadhaar',
                    expectedName: userData?.full_name,
                    expectedDob: userData?.date_of_birth
                });

                setBackValidation(validationResult);

                if (validationResult.isValid) {
                    toast.success("Document validated successfully!");
                } else if (validationResult.errors.length > 0) {
                    toast.warning("Document validation completed with some warnings.");
                }

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
        setPendingSide(side);
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
            try {
                const res = await fetch(imageSrc);
                const blob = await res.blob();
                const file = new File([blob], `${capturingFor}_${Date.now()}.jpg`, { type: 'image/jpeg' });

                setShowCamera(false);
                setDocumentDetected(null);

                if (capturingFor === 'front') {
                    setFrontImage(imageSrc);
                    setFrontFile(file);
                    setFrontValidation(null);
                    setValidatingFront(true);

                    try {
                        const validationResult = await validateDocument(file, {
                            expectedType: docType as 'pan' | 'aadhaar',
                            expectedName: userData?.full_name,
                            expectedDob: userData?.date_of_birth
                        });

                        setFrontValidation(validationResult);

                        if (validationResult.isValid) {
                            toast.success("Document validated successfully!");
                        } else {
                            toast.error("Document validation failed.");
                        }

                        validationResult.warnings.forEach(warning => toast.warning(warning));
                    } catch (error) {
                        toast.error("Failed to validate document.");
                    } finally {
                        setValidatingFront(false);
                    }
                } else {
                    setBackImage(imageSrc);
                    setBackFile(file);
                    setBackValidation(null);
                    setValidatingBack(true);

                    try {
                        const validationResult = await validateDocument(file, {
                            expectedType: docType as 'pan' | 'aadhaar',
                            expectedName: userData?.full_name,
                            expectedDob: userData?.date_of_birth
                        });

                        setBackValidation(validationResult);

                        if (validationResult.isValid) {
                            toast.success("Document validated successfully!");
                        } else if (validationResult.errors.length > 0) {
                            toast.warning("Validation completed with warnings.");
                        }

                        validationResult.warnings.forEach(warning => toast.warning(warning));
                    } catch (error) {
                        toast.info("Back side uploaded. Manual review required.");
                    } finally {
                        setValidatingBack(false);
                    }
                }

                setCapturingFor(null);
            } catch (error) {
                console.error('Error capturing image:', error);
                toast.error("Failed to capture image.");
            }
        }
    }, [scannerRef, capturingFor, docType, userData]);

    const handleSendLink = async () => {
        const currentUrl = window.location.href;
        try {
            await navigator.clipboard.writeText(currentUrl);
            toast.success("Link copied! Open it on your phone.", { duration: 5000 });
        } catch {
            const textArea = document.createElement('textarea');
            textArea.value = currentUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success("Link copied!", { duration: 5000 });
        }
    };

    const handleSendEmail = async () => {
        if (!userEmail) {
            toast.error("Email not found.");
            return;
        }
        setSendingEmail(true);
        try {
            const currentUrl = window.location.href;
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: userEmail, url: currentUrl })
            });

            if (response.ok) {
                toast.success(`Link sent to ${userEmail}!`);
                setShowMobilePrompt(false);
            } else {
                throw new Error('Failed to send email');
            }
        } catch (error) {
            toast.error("Failed to send email.");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleSubmit = async () => {
        if (!frontImage) {
            toast.error("Please upload the front side");
            return;
        }

        // Back side optional only if logic allows (PAN usually doesn't need back? But we enforce it for consistency or specific rules)
        // Let's enforce back side for Aadhaar, maybe optional for PAN? 
        // QuikKYC validation usually expects both unless passport. Let's enforce both for now for robustness unless strictly PAN.
        // Actually, PAN card usually has no back side validation interest. But the validator handles it.
        // I will enforce both to be safe, or check docType.
        if (!backImage && docType === 'aadhaar') {
            toast.error("Please upload the back side");
            return;
        }

        if (validatingFront || validatingBack) {
            toast.error("Wait for validation to complete");
            return;
        }

        if (frontValidation && !frontValidation.isValid) {
            toast.error("Front document validation failed.");
            return;
        }

        if (!userId) {
            toast.error("Session error.");
            return;
        }

        setProcessing(true);

        try {
            let frontUrl = frontImage;
            let backUrl = backImage;

            if (frontFile) {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Session expired");

                const ext = frontFile.name.split('.').pop();
                const path = `other-documents/${userId}_${docType}_front_${Date.now()}.${ext}`;
                const { error } = await supabase.storage.from('kyc-documents').upload(path, frontFile, { cacheControl: '3600', upsert: false });
                if (error) throw error;
                const { data } = supabase.storage.from('kyc-documents').getPublicUrl(path);
                frontUrl = data.publicUrl;
            }

            if (backFile) {
                const ext = backFile.name.split('.').pop();
                const path = `other-documents/${userId}_${docType}_back_${Date.now()}.${ext}`;
                const { error } = await supabase.storage.from('kyc-documents').upload(path, backFile, { cacheControl: '3600', upsert: false });
                if (error) throw error;
                const { data } = supabase.storage.from('kyc-documents').getPublicUrl(path);
                backUrl = data.publicUrl;
            }

            const { saveProgress } = await import('../actions/authActions');

            // Map docType to specific PAN or Aadhaar slots
            let updateData = {};
            if (docType === 'pan') {
                updateData = {
                    pan_card_front_url: frontUrl,
                    pan_card_back_url: backUrl,
                };
            } else if (docType === 'aadhaar') {
                updateData = {
                    aadhaar_card_front_url: frontUrl,
                    aadhaar_card_back_url: backUrl,
                };
            }

            const result = await saveProgress(userId, updateData as any); // Use 'as any' until types are regenerated globally

            if (result.success) {
                toast.success("Document saved successfully!");
                router.push('/summary');
            } else {
                toast.error("Failed to save progress.");
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error("Something went wrong");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-4xl mx-auto">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Neccessary documents</h1>
                        <p className="text-slate-600 font-medium">PAN Card and Aadhar Card is mandatory for accounts opened digitally.</p>
                    </div>

                    {/* Static Document Type Indicator */}
                    <div className="flex justify-center mb-6">
                        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2">
                            <span className="text-slate-500">Uploading:</span>
                            <span className="font-bold">{docType === 'pan' ? 'PAN Card' : 'Aadhaar Card'}</span>
                        </div>
                    </div>

                    <Card className="border-none shadow-xl mb-6">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">1</div>
                                Front Side
                            </h3>
                            {!frontImage ? (
                                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                                    <FileUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <p className="text-slate-600 mb-4">Upload or scan front side</p>
                                    <div className="flex gap-3 justify-center">
                                        <Button onClick={() => fileInputFrontRef.current?.click()} variant="outline"><FileUp className="mr-2 h-4 w-4" />Choose File</Button>
                                        <Button onClick={() => handleCameraClick('front')} variant="outline"><Camera className="mr-2 h-4 w-4" />Use Camera</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={frontImage} alt="Front" className="w-full h-auto rounded-lg border-2 border-slate-200" />
                                    <Button onClick={() => { setFrontImage(null); setFrontFile(null); setFrontValidation(null); }} variant="destructive" size="sm" className="absolute top-2 right-2"><X className="h-4 w-4 mr-1" />Remove</Button>
                                    {validatingFront && <div className="absolute top-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" />Validating...</div>}
                                    {!validatingFront && frontValidation?.isValid && <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1"><CheckCircle className="h-4 w-4" />Verified</div>}
                                    {!validatingFront && frontValidation && !frontValidation.isValid && <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1"><XCircle className="h-4 w-4" />Failed</div>}
                                    {/* Warnings and Errors rendering could be added here similar to ScanPage */}
                                </div>
                            )}
                            <input ref={fileInputFrontRef} type="file" accept="image/*" onChange={handleFrontFileUpload} className="hidden" />
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl mb-6">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">2</div>
                                Back Side
                            </h3>
                            {!backImage ? (
                                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                                    <FileUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <p className="text-slate-600 mb-4">Upload or scan back side</p>
                                    <div className="flex gap-3 justify-center">
                                        <Button onClick={() => fileInputBackRef.current?.click()} variant="outline"><FileUp className="mr-2 h-4 w-4" />Choose File</Button>
                                        <Button onClick={() => handleCameraClick('back')} variant="outline"><Camera className="mr-2 h-4 w-4" />Use Camera</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={backImage} alt="Back" className="w-full h-auto rounded-lg border-2 border-slate-200" />
                                    <Button onClick={() => { setBackImage(null); setBackFile(null); setBackValidation(null); }} variant="destructive" size="sm" className="absolute top-2 right-2"><X className="h-4 w-4 mr-1" />Remove</Button>
                                    {validatingBack && <div className="absolute top-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" />Validating...</div>}
                                    {!validatingBack && backValidation?.isValid && <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1"><CheckCircle className="h-4 w-4" />Verified</div>}
                                </div>
                            )}
                            <input ref={fileInputBackRef} type="file" accept="image/*" onChange={handleBackFileUpload} className="hidden" />
                        </CardContent>
                    </Card>

                    {/* Camera Modal */}
                    {showCamera && capturingFor && (
                        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
                            <div className="flex-shrink-0 flex justify-between items-center p-4 bg-slate-900/95">
                                <h3 className="text-white font-semibold">Capture {capturingFor}</h3>
                                <Button onClick={() => setShowCamera(false)} variant="ghost" size="sm" className="text-white"><X className="h-5 w-5" /></Button>
                            </div>
                            <div className="flex-1 relative bg-black">
                                <DocumentScanner ref={scannerRef} onDocumentDetected={setDocumentDetected} onError={(e) => toast.error("Camera error")} className="absolute inset-0 w-full h-full" />
                            </div>
                            <div className="p-4 bg-slate-900/95">
                                <Button onClick={capture} className="w-full bg-blue-600" size="lg"><Camera className="mr-2 h-5 w-5" />Capture</Button>
                            </div>
                        </div>
                    )}

                    {/* Mobile Prompt */}
                    {showMobilePrompt && isDesktop && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl p-6 max-w-md w-full relative">
                                <Button onClick={() => setShowMobilePrompt(false)} variant="ghost" size="sm" className="absolute top-2 right-2"><X className="h-4 w-4" /></Button>
                                <h3 className="text-xl font-bold mb-4">Continue on Phone</h3>
                                <div className="space-y-3">
                                    {userEmail && <Button onClick={handleSendEmail} disabled={sendingEmail} className="w-full bg-blue-600">{sendingEmail ? 'Sending...' : 'Send Link to Email'}</Button>}
                                    <Button onClick={handleSendLink} variant="outline" className="w-full">Copy Link</Button>
                                    <Button onClick={handleContinueOnDesktop} variant="ghost" className="w-full">Use Camera Here</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button onClick={() => router.back()} variant="outline" size="lg" className="flex-1"><ArrowLeft className="mr-2 h-5 w-5" />Back</Button>
                        <Button onClick={handleSubmit} disabled={processing || validatingFront || validatingBack} size="lg" className="flex-1 bg-blue-600 hover:bg-blue-700">
                            {processing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Check className="mr-2 h-5 w-5" />Save & Continue</>}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
