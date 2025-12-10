'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, FileCheck } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Header } from '@/components/header';

export default function OnboardingPage() {
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

                // Get user progress to handle routing
                const { getUserProgress } = await import('../actions/authActions');
                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    const user = result.user;

                    // If user has completed KYC, show submission page
                    if (user.kyc_status === 'completed') {
                        router.push('/submission');
                        return;
                    }

                    // If user is on a later step, resume from there
                    if (user.kyc_step && user.kyc_step !== 'onboarding') {
                        const stepRoutes: Record<string, string> = {
                            'basic_details': '/basic-details',
                            'identity_scan': '/scan/poi',
                            'address_scan': '/scan/poa',
                            'liveness': '/liveness',
                        };
                        const targetRoute = stepRoutes[user.kyc_step];
                        if (targetRoute) {
                            toast.info("Resuming from where you left off...");
                            router.push(targetRoute);
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking progress:', error);
            }
        };

        checkProgress();
    }, [router]);


    return (
        <>
            <Header />
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 pt-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full space-y-6"
                >
                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl font-bold text-slate-900">Ready to verify?</h1>
                        <p className="text-slate-500">Please keep the following documents handy.</p>
                    </div>

                    <Card className="border-none shadow-xl overflow-hidden bg-white/80 backdrop-blur-md">
                        <CardContent className="p-6">

                            {/* Documents Section */}
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="space-y-3 p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2">
                                        <Shield className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-900 leading-tight">Proof of Identity</h3>
                                    <ul className="text-sm text-slate-500 space-y-1">
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-blue-400"></div>PAN Card</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-blue-400"></div>Aadhaar Card</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-blue-400"></div>Passport</li>
                                    </ul>
                                </div>

                                <div className="space-y-3 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                                        <FileCheck className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-900 leading-tight">Proof of Address</h3>
                                    <ul className="text-sm text-slate-500 space-y-1">
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-indigo-400"></div>Aadhaar Card</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-indigo-400"></div>Passport</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-indigo-400"></div>Voter ID</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Privacy Note */}
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100 mb-6">
                                <Shield className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    By processing, you agree to allow camera access for document scanning and liveness detection. Your data is encrypted.
                                </p>
                            </div>

                            <Link href="/basic-details" className="block w-full">
                                <Button size="lg" className="w-full text-lg h-12 bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-300">
                                    Start Verification <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                </motion.div>
            </div>
        </>
    );
}
