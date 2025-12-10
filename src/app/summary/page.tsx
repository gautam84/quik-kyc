'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Edit, User, FileText, Home, Smartphone, ArrowRight, AlertTriangle } from 'lucide-react';
import { KYCProgress } from '@/components/kyc-progress';

interface UserData {
    full_name: string | null;
    email: string | null;
    date_of_birth: Date | string | null;
    passport_photo_url: string | null;
    identity_doc_type: string | null;
    identity_doc_number: string | null;
    identity_doc_front_url: string | null;
    identity_doc_back_url: string | null;
    address_doc_type: string | null;
    address_doc_number: string | null;
    address_doc_front_url: string | null;
    address_doc_back_url: string | null;
    address_line: string | null;
    kyc_status: string;
    liveness_verified: boolean;
}

export default function SummaryPage() {
    const router = useRouter();
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    toast.error("Please login first");
                    router.push('/verify');
                    return;
                }

                setUserId(session.user.id);

                // Get user data
                const { getUserProgress } = await import('../actions/authActions');
                const { calculateCompletedSteps } = await import('@/lib/kyc-progress-utils');

                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    setUserData(result.user as any);

                    // Check if all required data is present
                    const user = result.user;
                    if (!user.full_name || !user.identity_doc_type || !user.address_doc_type) {
                        toast.error("Please complete all previous steps");
                        router.push('/basic-details');
                        return;
                    }

                    // If already submitted, redirect to submission page
                    if (user.kyc_status === 'completed') {
                        router.push('/submission');
                        return;
                    }

                    // Set completed steps based on user progress
                    const steps = calculateCompletedSteps(user);
                    setCompletedSteps(steps);
                } else {
                    toast.error("Failed to load your data");
                    router.push('/basic-details');
                }
            } catch (error) {
                console.error('Error loading data:', error);
                toast.error("Something went wrong");
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, [router]);

    const handleSubmit = async () => {
        if (!userId) {
            toast.error("Session error. Please login again.");
            router.push('/verify');
            return;
        }

        setSubmitting(true);

        try {
            const { completeKYC } = await import('../actions/authActions');

            const result = await completeKYC(userId);

            if (result.success) {
                toast.success("KYC submitted successfully!");
                router.push('/submission');
            } else {
                toast.error("Failed to submit. Please try again.");
            }
        } catch (error) {
            console.error('Error submitting:', error);
            toast.error("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString: string | Date | null) => {
        if (!dateString) return 'N/A';
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getDocumentTypeLabel = (docType: string) => {
        const labels: Record<string, string> = {
            'pan': 'PAN Card',
            'aadhaar': 'Aadhaar Card',
            'passport': 'Passport',
            'voter': 'Voter ID',
            'driving_license': 'Driving License'
        };
        return labels[docType] || docType.toUpperCase();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-slate-600">Loading your information...</p>
                </div>
            </div>
        );
    }

    if (!userData) {
        return null;
    }

    const hasPan = userData.identity_doc_type === 'pan' || userData.address_doc_type === 'pan';
    const hasAadhaar = userData.identity_doc_type === 'aadhaar' || userData.address_doc_type === 'aadhaar';
    const missingDocs: string[] = [];

    if (!hasPan) missingDocs.push('PAN Card');
    if (!hasAadhaar) missingDocs.push('Aadhaar Card');

    // Debug logging
    console.log('Submit button check:', {
        identity_doc_type: userData.identity_doc_type,
        address_doc_type: userData.address_doc_type,
        liveness_verified: userData.liveness_verified,
        hasPan,
        hasAadhaar,
        missingDocs,
        buttonDisabled: !userData.liveness_verified || missingDocs.length > 0
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {/* Header */}
                            <div className="mb-6">
                                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                                    Step 5: Review & Submit
                                </div>
                                <h1 className="text-3xl font-bold text-slate-900 mb-2">Review Your Information</h1>
                                <p className="text-slate-600">Please verify all details before final submission</p>
                            </div>

                            {/* Basic Details Section */}
                            <Card className="border-none shadow-xl mb-6">
                                <CardHeader className="border-b bg-slate-50/50">
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="w-5 h-5 text-blue-600" />
                                        Basic Details
                                    </CardTitle>
                                    <CardAction>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push('/basic-details')}
                                            className="text-blue-600 hover:text-blue-700"
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-sm text-slate-500 mb-1">Full Name</p>
                                            <p className="text-base font-semibold text-slate-900">{userData.full_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500 mb-1">Email Address</p>
                                            <p className="text-base font-semibold text-slate-900">{userData.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500 mb-1">Date of Birth</p>
                                            <p className="text-base font-semibold text-slate-900">
                                                {formatDate(userData.date_of_birth)}
                                            </p>
                                        </div>
                                        {userData.passport_photo_url && (
                                            <div>
                                                <p className="text-sm text-slate-500 mb-2">Passport Photo</p>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={userData.passport_photo_url}
                                                    alt="Passport"
                                                    className="w-24 h-24 object-cover rounded-lg border-2 border-slate-200"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Identity Document Section */}
                            <Card className="border-none shadow-xl mb-6">
                                <CardHeader className="border-b bg-slate-50/50">
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        Proof of Identity
                                    </CardTitle>
                                    <CardAction>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                console.log('Navigating to identity scan...');
                                                router.push('/scan/poi');
                                            }}
                                            className="text-blue-600 hover:text-blue-700"
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-slate-500 mb-1">Document Type</p>
                                            <p className="text-base font-semibold text-slate-900">
                                                {userData.identity_doc_type && getDocumentTypeLabel(userData.identity_doc_type)}
                                            </p>
                                        </div>
                                        {/* Display document images */}
                                        {(userData.identity_doc_front_url || userData.identity_doc_back_url) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {userData.identity_doc_front_url && (
                                                    <div>
                                                        <p className="text-sm text-slate-500 mb-2">Front Side</p>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={userData.identity_doc_front_url}
                                                            alt="Identity Document Front"
                                                            className="w-full h-auto rounded-lg border-2 border-slate-200"
                                                            onError={(e) => {
                                                                console.error('Failed to load identity front image:', userData.identity_doc_front_url);
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                {userData.identity_doc_back_url && (
                                                    <div>
                                                        <p className="text-sm text-slate-500 mb-2">Back Side</p>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={userData.identity_doc_back_url}
                                                            alt="Identity Document Back"
                                                            className="w-full h-auto rounded-lg border-2 border-slate-200"
                                                            onError={(e) => {
                                                                console.error('Failed to load identity back image:', userData.identity_doc_back_url);
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Address Document Section */}
                            <Card className="border-none shadow-xl mb-6">
                                <CardHeader className="border-b bg-slate-50/50">
                                    <CardTitle className="flex items-center gap-2">
                                        <Home className="w-5 h-5 text-blue-600" />
                                        Proof of Address
                                    </CardTitle>
                                    <CardAction>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                console.log('Navigating to address scan...');
                                                router.push('/scan/poa');
                                            }}
                                            className="text-blue-600 hover:text-blue-700"
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-slate-500 mb-1">Document Type</p>
                                            <p className="text-base font-semibold text-slate-900">
                                                {userData.address_doc_type && getDocumentTypeLabel(userData.address_doc_type)}
                                            </p>
                                        </div>
                                        {/* Display document images */}
                                        {(userData.address_doc_front_url || userData.address_doc_back_url) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {userData.address_doc_front_url && (
                                                    <div>
                                                        <p className="text-sm text-slate-500 mb-2">Front Side</p>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={userData.address_doc_front_url}
                                                            alt="Address Document Front"
                                                            className="w-full h-auto rounded-lg border-2 border-slate-200"
                                                            onError={(e) => {
                                                                console.error('Failed to load address front image:', userData.address_doc_front_url);
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                {userData.address_doc_back_url && (
                                                    <div>
                                                        <p className="text-sm text-slate-500 mb-2">Back Side</p>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={userData.address_doc_back_url}
                                                            alt="Address Document Back"
                                                            className="w-full h-auto rounded-lg border-2 border-slate-200"
                                                            onError={(e) => {
                                                                console.error('Failed to load address back image:', userData.address_doc_back_url);
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Missing Documents Alert */}
                            {missingDocs.length > 0 && (
                                <Card className="border-2 border-orange-200 bg-orange-50/50 mb-6">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-orange-800">
                                            <AlertTriangle className="w-5 h-5" />
                                            Action Required
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6 pt-2">
                                        <p className="text-sm text-orange-700 mb-4">
                                            To complete your KYC, the following mandatory documents are missing:
                                        </p>
                                        <div className="space-y-3">
                                            {!hasPan && (
                                                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100">
                                                    <div className="flex items-center gap-3">
                                                        <FileText className="w-5 h-5 text-slate-400" />
                                                        <span className="font-medium text-slate-700">PAN Card</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => router.push('/other-docs?suggested=pan')}
                                                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                                    >
                                                        Upload PAN
                                                    </Button>
                                                </div>
                                            )}
                                            {!hasAadhaar && (
                                                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100">
                                                    <div className="flex items-center gap-3">
                                                        <FileText className="w-5 h-5 text-slate-400" />
                                                        <span className="font-medium text-slate-700">Aadhaar Card</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => router.push('/other-docs?suggested=aadhaar')}
                                                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                                    >
                                                        Upload Aadhaar
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Liveness Check Section */}
                            <Card className="border-none shadow-xl mb-6">
                                <CardHeader className="border-b bg-slate-50/50">
                                    <CardTitle className="flex items-center gap-2">
                                        <Smartphone className="w-5 h-5 text-blue-600" />
                                        Liveness Verification
                                    </CardTitle>
                                    {!userData.liveness_verified && (
                                        <CardAction>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => router.push('/liveness')}
                                                className="text-blue-600 hover:text-blue-700"
                                            >
                                                Start Check
                                            </Button>
                                        </CardAction>
                                    )}
                                </CardHeader>
                                <CardContent className="p-6">
                                    {userData.liveness_verified ? (
                                        <div className="flex items-center gap-3 text-green-600">
                                            <CheckCircle2 className="w-6 h-6" />
                                            <p className="font-semibold">Liveness check completed successfully</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 text-orange-600">
                                            <AlertTriangle className="w-6 h-6" />
                                            <div>
                                                <p className="font-semibold">Verification Pending</p>
                                                <p className="text-sm opacity-90">Please complete the liveness check to proceed.</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Confirmation and Submit */}
                            <Card className="border-2 border-blue-200 bg-blue-50/50">
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 mb-2">Ready to Submit</h3>
                                            <p className="text-sm text-slate-600 mb-4">
                                                By submitting, you confirm that all the information provided is accurate and complete.
                                                Your KYC application will be reviewed by our team within 24-48 hours.
                                            </p>
                                            <div className="bg-white rounded-lg p-4 mb-4">
                                                <h4 className="text-sm font-semibold text-slate-700 mb-2">What happens next?</h4>
                                                <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
                                                    <li>Your documents will be verified by our team</li>
                                                    <li>You&apos;ll receive an email update on your application status</li>
                                                    <li>Approval typically takes 24-48 hours</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <div className="flex gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={() => router.push('/basic-details')}
                                                className="flex-1"
                                            >
                                                Review Again
                                            </Button>
                                            <Button
                                                onClick={handleSubmit}
                                                disabled={submitting || !userData.liveness_verified || missingDocs.length > 0}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                size="lg"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    <>
                                                        Submit KYC Application
                                                        <ArrowRight className="ml-2 h-5 w-5" />
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        {(!userData.liveness_verified || missingDocs.length > 0) && (
                                            <p className="text-center text-sm text-red-500 font-medium">
                                                Please complete all required steps (Documents & Liveness) to submit.
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>

                    {/* Progress Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6">
                            <KYCProgress
                                currentStep="summary"
                                completedSteps={completedSteps}
                                estimatedTime="1 min"
                                showSaveResume={false}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
