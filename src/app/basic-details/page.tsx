'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, Upload, Loader2, User, Mail, Calendar, Image as ImageIcon, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { KYCProgress } from '@/components/kyc-progress';
import { validatePassportPhoto } from '@/lib/image-utils';

export default function BasicDetailsPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [dob, setDob] = useState('');
    const [passportPhoto, setPassportPhoto] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [showGuidelines, setShowGuidelines] = useState(true);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkSession = async () => {
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
                // Dynamic import to avoid circular dependency if any, though utils is safe
                const { calculateCompletedSteps } = await import('@/lib/kyc-progress-utils'); // Import strictly typed function

                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    const user = result.user;

                    // If KYC completed, redirect to submission
                    if (user.kyc_status === 'completed') {
                        router.push('/submission');
                        return;
                    }

                    // Pre-fill form if data exists
                    if (user.full_name) setFullName(user.full_name);
                    if (user.email) setEmail(user.email);
                    if (user.date_of_birth) {
                        const date = new Date(user.date_of_birth);
                        setDob(date.toISOString().split('T')[0]);
                    }
                    if (user.passport_photo_url) {
                        setPassportPhoto(user.passport_photo_url);
                        setExistingPhotoUrl(user.passport_photo_url);
                    }

                    // Set completed steps based on user progress
                    const steps = calculateCompletedSteps(user);
                    setCompletedSteps(steps);
                }
            } catch (error) {
                console.error('Error checking session:', error);
            }
        };

        checkSession();
    }, [router]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate Image
            try {
                const validation = await validatePassportPhoto(file);

                if (!validation.isValid) {
                    console.log("Validation failed:", validation.errors);
                    setValidationErrors(validation.errors);
                    // Clear the input so user can try again
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }

                // Clear any previous validation errors on success
                setValidationErrors([]);
                setUploadedFile(file);
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        setPassportPhoto(e.target.result as string);
                    }
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error("Image validation failed", error);
                setValidationErrors(["Failed to validate image. Please try another one."]);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fullName || !email || !dob || !passportPhoto) {
            toast.error("Please fill all fields and upload a passport photo");
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error("Please enter a valid email address");
            return;
        }

        // Age validation (must be 18+)
        const birthDate = new Date(dob);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const isOldEnough = age > 18 || (age === 18 && monthDiff >= 0);

        if (!isOldEnough) {
            toast.error("You must be at least 18 years old to complete KYC");
            return;
        }

        if (!userId) {
            toast.error("Session error. Please login again.");
            router.push('/verify');
            return;
        }

        setLoading(true);

        try {
            const { saveProgress } = await import('../actions/authActions');

            // Upload passport photo to Supabase Storage only if a new file was selected
            let uploadedUrl = existingPhotoUrl; // Use existing URL by default

            if (uploadedFile) {
                // New file was uploaded, so upload it
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    toast.error("Session expired. Please login again.");
                    router.push('/verify');
                    setLoading(false);
                    return;
                }

                const fileExt = uploadedFile.name.split('.').pop();
                const fileName = `${userId}_passport_${Date.now()}.${fileExt}`;
                const filePath = `passport-photos/${fileName}`;

                console.log('Uploading new file:', filePath);
                console.log('User authenticated:', session.user.id);

                const { error: uploadError } = await supabase.storage
                    .from('kyc-documents')
                    .upload(filePath, uploadedFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    console.error('Error details:', JSON.stringify(uploadError, null, 2));
                    toast.error(`Failed to upload photo: ${uploadError.message}`);
                    setLoading(false);
                    return;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('kyc-documents')
                    .getPublicUrl(filePath);

                uploadedUrl = urlData.publicUrl;
                console.log('Upload successful:', uploadedUrl);
            } else if (!existingPhotoUrl) {
                // No file uploaded and no existing photo
                toast.error("Please upload a passport photo");
                setLoading(false);
                return;
            } else {
                console.log('Using existing photo URL:', existingPhotoUrl);
            }

            const result = await saveProgress(userId, {
                full_name: fullName,
                email: email,
                date_of_birth: new Date(dob),
                kyc_step: 'document_guidance',
                passport_photo_url: uploadedUrl
            });

            if (result.success) {
                toast.success("Basic details saved!");
                router.push('/document-guidance');
            } else {
                toast.error("Failed to save details. Please try again.");
            }
        } catch (error) {
            console.error('Error saving basic details:', error);
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {/* Header */}
                            <div className="mb-6">
                                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                                    Step 1: Basic Details
                                </div>
                                <h1 className="text-3xl font-bold text-slate-900 mb-2">Personal Information</h1>
                                <p className="text-slate-600">Let&apos;s start with your basic details</p>
                            </div>

                            <Card className="border-none shadow-xl">
                                <CardHeader className="border-b bg-slate-50/50">
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="w-5 h-5 text-blue-600" />
                                        Enter Your Details
                                    </CardTitle>
                                    <CardDescription>
                                        All information must match your identity documents
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        {/* Full Name */}
                                        <div className="space-y-2">
                                            <Label htmlFor="fullName" className="text-sm font-medium">
                                                Full Name <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="fullName"
                                                type="text"
                                                placeholder="Enter your full name as per ID"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                className="h-12 text-base"
                                                required
                                            />
                                            <p className="text-xs text-slate-500">
                                                Enter name exactly as it appears on your ID documents
                                            </p>
                                        </div>

                                        {/* Email */}
                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-sm font-medium">
                                                Email Address <span className="text-red-500">*</span>
                                            </Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="your.email@example.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="h-12 text-base pl-11"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Date of Birth */}
                                        <div className="space-y-2">
                                            <Label htmlFor="dob" className="text-sm font-medium">
                                                Date of Birth <span className="text-red-500">*</span>
                                            </Label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                                <Input
                                                    id="dob"
                                                    type="date"
                                                    value={dob}
                                                    onChange={(e) => setDob(e.target.value)}
                                                    className="h-12 text-base pl-11"
                                                    max={new Date().toISOString().split('T')[0]}
                                                    required
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                You must be at least 18 years old
                                            </p>
                                        </div>

                                        {/* Passport Photo */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">
                                                Passport Size Photo <span className="text-red-500">*</span>
                                            </Label>

                                            {/* Photo Guidelines */}
                                            {showGuidelines && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                >
                                                    <Card className="border-2 border-blue-200 bg-blue-50/50">
                                                        <CardContent className="p-6">
                                                            <div className="flex items-start justify-between mb-4">
                                                                <div className="flex items-center gap-2">
                                                                    <Info className="w-5 h-5 text-blue-600" />
                                                                    <h3 className="text-lg font-semibold text-slate-900">Passport Photo Guidelines</h3>
                                                                </div>
                                                                <button
                                                                    onClick={() => setShowGuidelines(false)}
                                                                    className="text-slate-400 hover:text-slate-600"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>

                                                            <p className="text-sm text-slate-600 mb-4">
                                                                Please ensure your passport photo meets the following requirements for successful verification:
                                                            </p>

                                                            {/* Guidelines Grid */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                                {/* Correct Example */}
                                                                <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                                                        <span className="font-semibold text-green-700">Correct Format</span>
                                                                    </div>
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img
                                                                        src="/passport_img_correct.png"
                                                                        alt="Correct passport photo"
                                                                        className="w-full h-48 object-cover rounded-md mb-2"
                                                                    />
                                                                    <ul className="text-xs text-slate-600 space-y-1">
                                                                        <li>✓ Clear and in focus</li>
                                                                        <li>✓ Good lighting</li>
                                                                        <li>✓ Portrait orientation</li>
                                                                        <li>✓ Plain background</li>
                                                                    </ul>
                                                                </div>

                                                                {/* Incorrect Examples */}
                                                                <div className="space-y-3">
                                                                    <div className="bg-white rounded-lg p-3 border-2 border-red-200">
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="flex-shrink-0">
                                                                                <XCircle className="w-4 h-4 text-red-600 mt-1" />
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <div className="flex gap-2 items-start">
                                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                    <img
                                                                                        src="/passport_img_blurry.png"
                                                                                        alt="Blurry photo"
                                                                                        className="w-16 h-16 object-cover rounded"
                                                                                    />
                                                                                    <div>
                                                                                        <p className="font-semibold text-red-700 text-xs">Too Blurry</p>
                                                                                        <p className="text-xs text-slate-600">Image is out of focus</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="bg-white rounded-lg p-3 border-2 border-red-200">
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="flex-shrink-0">
                                                                                <XCircle className="w-4 h-4 text-red-600 mt-1" />
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <div className="flex gap-2 items-start">
                                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                    <img
                                                                                        src="/passport_img_dark.png"
                                                                                        alt="Dark photo"
                                                                                        className="w-16 h-16 object-cover rounded"
                                                                                    />
                                                                                    <div>
                                                                                        <p className="font-semibold text-red-700 text-xs">Too Dark</p>
                                                                                        <p className="text-xs text-slate-600">Poor lighting</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="bg-white rounded-lg p-3 border-2 border-red-200">
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="flex-shrink-0">
                                                                                <XCircle className="w-4 h-4 text-red-600 mt-1" />
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <div className="flex gap-2 items-start">
                                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                    <img
                                                                                        src="/passport_img_landscape.jpg"
                                                                                        alt="Landscape photo"
                                                                                        className="w-16 h-16 object-cover rounded"
                                                                                    />
                                                                                    <div>
                                                                                        <p className="font-semibold text-red-700 text-xs">Wrong Orientation</p>
                                                                                        <p className="text-xs text-slate-600">Must be portrait</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                                                                <p className="text-xs text-slate-700 font-medium mb-1">Quick Tips:</p>
                                                                <ul className="text-xs text-slate-600 space-y-1 ml-4">
                                                                    <li>• Use natural lighting or a well-lit room</li>
                                                                    <li>• Ensure your face is clearly visible</li>
                                                                    <li>• Use portrait (vertical) orientation</li>
                                                                    <li>• Avoid shadows on your face</li>
                                                                </ul>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </motion.div>
                                            )}

                                            {/* Validation Errors */}
                                            {validationErrors.length > 0 && (
                                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                                                    {validationErrors.map((error, index) => (
                                                        <div key={index} className="flex items-start gap-2">
                                                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                            <p className="text-sm text-red-700">{error}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {!passportPhoto && (
                                                <div className="flex justify-center">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-32 w-full flex-col gap-2 border-2 border-dashed hover:border-blue-500 hover:bg-blue-50"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        <Upload className="w-8 h-8 text-slate-400" />
                                                        <span>Upload Passport Size Photo</span>
                                                    </Button>
                                                </div>
                                            )}

                                            {passportPhoto && (
                                                <div className="space-y-4">
                                                    <div className="relative rounded-lg overflow-hidden border-2 border-slate-200">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={passportPhoto}
                                                            alt="Passport"
                                                            className="w-full max-h-64 object-contain bg-slate-50"
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setPassportPhoto(null);
                                                            setValidationErrors([]);
                                                            fileInputRef.current?.click();
                                                        }}
                                                        className="w-full"
                                                    >
                                                        <ImageIcon className="mr-2 h-4 w-4" />
                                                        Change Photo
                                                    </Button>
                                                </div>
                                            )}

                                            <input
                                                type="file"
                                                accept="image/*"
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={handleFileUpload}
                                            />
                                            <p className="text-xs text-slate-500">
                                                Upload a clear passport-size photo with white background
                                            </p>
                                        </div>

                                        {/* Submit Button */}
                                        <Button
                                            type="submit"
                                            size="lg"
                                            className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                                            disabled={loading || !fullName || !email || !dob || !passportPhoto}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    Continue
                                                    <ArrowRight className="ml-2 h-5 w-5" />
                                                </>
                                            )}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>

                    {/* Progress Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6">
                            <KYCProgress
                                currentStep="basic_details"
                                completedSteps={completedSteps}
                                estimatedTime="2 min"
                                showSaveResume={true}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
