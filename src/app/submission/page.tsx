'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { CheckCircle, FileText, Calendar, CreditCard, MapPin, User as UserIcon, Phone, Download, LogOut, XCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { User } from '@prisma/client';

export default function SubmissionPage() {
    const router = useRouter();
    const [userData, setUserData] = useState<Partial<User> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    toast.error("Session expired. Please login again.");
                    router.push('/verify');
                    return;
                }

                // Get user progress
                const { getUserProgress } = await import('../actions/authActions');
                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    if (result.user.kyc_status == 'pending') {
                        // User hasn't completed KYC, redirect appropriately
                        // const stepRoutes: Record<string, string> = {
                        //     'onboarding': '/onboarding',
                        //     'identity_scan': '/scan',
                        //     'address_scan': '/scan',
                        //     'liveness': '/liveness',
                        // };
                        router.push('/onboarding');
                        return;
                    }
                    setUserData(result.user);
                } else {
                    toast.error("Failed to load your data");
                    router.push('/onboarding');
                }
            } catch (error) {
                console.error('Error loading user data:', error);
                toast.error("Something went wrong");
                router.push('/onboarding');
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.info("Logged out successfully");
        router.push('/');
    };

    const handleReattempt = async () => {
        if (!userData?.supabase_uid) return;

        try {
            setLoading(true);
            const { resetKYCRejection } = await import('../actions/authActions');
            const result = await resetKYCRejection(userData.supabase_uid);

            if (result.success) {
                toast.success("Application reopened. Please update your details.");
                router.push('/onboarding');
            } else {
                toast.error("Failed to reset application status");
                setLoading(false);
            }
        } catch (error) {
            console.error('Error resetting status:', error);
            toast.error("Something went wrong");
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading your information...</p>
                </div>
            </div>
        );
    }

    if (!userData) {
        return null;
    }

    const formatDate = (date: Date | string | null | undefined) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl w-full space-y-6"
            >
                {/* Rejection or Success Header */}
                <div className="text-center space-y-4">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${userData.is_rejected
                            ? 'bg-red-100'
                            : userData.kyc_status === 'verified'
                                ? 'bg-green-100'
                                : 'bg-amber-100'
                            }`}
                    >
                        {userData.is_rejected ? (
                            <XCircle className="w-12 h-12 text-red-600" />
                        ) : userData.kyc_status === 'verified' ? (
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        ) : (
                            <div className="relative">
                                <AlertCircle className="w-12 h-12 text-amber-600" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" style={{ margin: '-8px' }}></div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            {userData.is_rejected
                                ? 'Action Required'
                                : userData.kyc_status === 'verified'
                                    ? 'KYC Verified'
                                    : 'Application Under Review'}
                        </h1>
                        <p className="text-slate-600 mt-2">
                            {userData.is_rejected
                                ? 'Your verification application was returned.'
                                : userData.kyc_status === 'verified'
                                    ? 'User completed KYC successfully.'
                                    : 'Your application is currently being reviewed by our team.'}
                        </p>

                        {(userData.is_rejected || userData.kyc_status === 'completed') && (
                            <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                                <RotateCcw className="w-4 h-4 mr-2" />
                                {Math.max(0, 3 - (userData.kyc_attempts || 0))} attempts left
                            </div>
                        )}
                    </div>
                </div>

                {/* Rejection Reason or Reference ID */}
                {userData.is_rejected ? (
                    <Card className="border-2 border-red-200 bg-white shadow-xl">
                        <CardHeader className="border-b bg-red-50/50 pb-3">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertCircle className="w-5 h-5" />
                                <h3 className="font-semibold">Reason for Rejection</h3>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <p className="text-slate-700 font-medium">
                                {userData.rejection_reason || 'Verification failed. Please ensure all documents are clear and valid.'}
                            </p>
                            <p className="text-sm text-slate-500 mt-4">
                                Please review the reason above and re-submit your application with corrected details/documents.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-2 border-green-200 bg-white shadow-xl">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Reference ID</p>
                                    <p className="text-2xl font-bold text-slate-900">{userData.reference_id}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-3">
                                Save this reference ID for future correspondence
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Submitted Information */}
                <Card className="shadow-xl bg-white">
                    <CardHeader className="border-b bg-slate-50">
                        <CardTitle className="text-lg">Submitted Information</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        {/* Personal Info */}
                        {userData.full_name && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                                <UserIcon className="w-5 h-5 text-slate-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500">Full Name</p>
                                    <p className="text-sm font-medium text-slate-900">{userData.full_name}</p>
                                </div>
                            </div>
                        )}

                        {/* Date of Birth */}
                        {userData.date_of_birth && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                                <Calendar className="w-5 h-5 text-slate-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500">Date of Birth</p>
                                    <p className="text-sm font-medium text-slate-900">{formatDate(userData.date_of_birth)}</p>
                                </div>
                            </div>
                        )}

                        {/* Mobile */}
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                            <Phone className="w-5 h-5 text-slate-600 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs text-slate-500">Mobile Number</p>
                                <p className="text-sm font-medium text-slate-900">{userData.mobile_number}</p>
                            </div>
                        </div>

                        {/* Identity Document */}
                        {userData.identity_doc_type && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                                <CreditCard className="w-5 h-5 text-slate-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500">Identity Document</p>
                                    <p className="text-sm font-medium text-slate-900 capitalize">
                                        {userData.identity_doc_type.replace('_', ' ')}
                                    </p>
                                    {userData.identity_doc_number && (
                                        <p className="text-xs text-slate-600 mt-1">{userData.identity_doc_number}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Address Document */}
                        {userData.address_doc_type && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                                <MapPin className="w-5 h-5 text-slate-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500">Address Proof</p>
                                    <p className="text-sm font-medium text-slate-900 capitalize">
                                        {userData.address_doc_type.replace('_', ' ')}
                                    </p>
                                    {userData.address_line && (
                                        <p className="text-xs text-slate-600 mt-1">{userData.address_line}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Submission Date */}
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs text-green-700">Submitted On</p>
                                <p className="text-sm font-medium text-green-900">{formatDate(userData.completed_at)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Status Note - Only show if not rejected (as rejected has its own card) */}
                {!userData.is_rejected && (
                    <Card className={`${userData.kyc_status === 'verified'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                        }`}>
                        <CardContent className="p-4">
                            <p className={`text-sm ${userData.kyc_status === 'verified'
                                ? 'text-green-900'
                                : 'text-amber-900'
                                }`}>
                                <strong>Status: </strong>
                                {userData.kyc_status === 'verified'
                                    ? 'Your KYC has been successfully verified. No further action is required.'
                                    : 'Your application is currently under review. You will be notified once the verification process is complete.'}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    {userData.is_rejected ? (
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            onClick={handleReattempt}
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reattempt KYC
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => window.print()}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Print/Save
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
