'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { CheckCircle, FileText, Calendar, CreditCard, MapPin, User as UserIcon, Phone, Download, LogOut } from 'lucide-react';
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
                    if (result.user.kyc_status !== 'completed') {
                        // User hasn't completed KYC, redirect appropriately
                        const stepRoutes: Record<string, string> = {
                            'onboarding': '/onboarding',
                            'identity_scan': '/scan',
                            'address_scan': '/scan',
                            'liveness': '/liveness',
                        };
                        router.push(stepRoutes[result.user.kyc_step] || '/onboarding');
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
                {/* Success Header */}
                <div className="text-center space-y-4">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center"
                    >
                        <CheckCircle className="w-12 h-12 text-green-600" />
                    </motion.div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">KYC Completed!</h1>
                        <p className="text-slate-600 mt-2">Your verification has been successfully submitted.</p>
                    </div>
                </div>

                {/* Reference ID Card */}
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

                {/* Status Note */}
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                        <p className="text-sm text-blue-900">
                            <strong>Status:</strong> Your KYC verification is complete. You will be notified once it has been reviewed and approved.
                        </p>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.print()}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Print/Save
                    </Button>
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
