'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, Variants } from 'framer-motion';
import { ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        // Check for existing session
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Get user progress to route appropriately
                const { getUserProgress } = await import('./actions/authActions');
                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    const user = result.user;

                    toast.info("Welcome back! Continuing session...");

                    if (user.kyc_status === 'completed') {
                        router.replace('/submission');
                    } else if (user.kyc_step && user.kyc_step !== 'onboarding') {
                        const stepRoutes: Record<string, string> = {
                            'identity_scan': '/scan/poi',
                            'address_scan': '/scan/poa',
                            'liveness': '/liveness',
                        };
                        router.replace(stepRoutes[user.kyc_step] || '/onboarding');
                    } else {
                        router.replace('/onboarding');
                    }
                } else {
                    router.replace('/onboarding');
                }
            }
        };

        checkSession();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session) {
                const { getUserProgress } = await import('./actions/authActions');
                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    const user = result.user;

                    toast.info("Welcome back! Continuing session...");

                    if (user.kyc_status === 'completed') {
                        router.replace('/submission');
                    } else if (user.kyc_step && user.kyc_step !== 'onboarding') {
                        const stepRoutes: Record<string, string> = {
                            'identity_scan': '/scan/poi',
                            'address_scan': '/scan/poa',
                            'liveness': '/liveness',
                        };
                        router.replace(stepRoutes[user.kyc_step] || '/onboarding');
                    } else {
                        router.replace('/onboarding');
                    }
                } else {
                    router.replace('/onboarding');
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants: Variants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: 'spring', stiffness: 50 }
        }
    };

    return (
        <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6 overflow-hidden">
            <motion.main
                className="max-w-4xl w-full"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <Card className="bg-white shadow-2xl border border-slate-200 overflow-hidden">
                    <CardContent className="p-8">
                        {/* Header */}
                        <motion.div variants={itemVariants} className="text-center mb-6">
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">
                                Digital KYC Verification
                            </h1>
                            <p className="text-sm text-slate-600">
                                Complete verification in under 2 minutes
                            </p>
                        </motion.div>

                        {/* Feature Tags */}
                        <motion.div variants={itemVariants} className="flex justify-center gap-6 mb-6 pb-6 border-b border-slate-200">
                            <div className="flex items-center gap-2 text-slate-700">
                                <Clock className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium">Instant Verification</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-700">
                                <ShieldCheck className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium">Bank-Grade Security</span>
                            </div>
                        </motion.div>

                        {/* Accepted Documents Section */}
                        <motion.div variants={itemVariants} className="mb-6">
                            <h2 className="text-base font-semibold text-slate-900 mb-5 text-center uppercase tracking-wide text-xs">
                                Accepted Documents
                            </h2>

                            <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                                {/* Identity Documents */}
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Proof of Identity</h3>
                                    <div className="space-y-2">
                                        {['PAN Card', 'Aadhaar Card', 'Passport'].map((doc, idx) => (
                                            <motion.div
                                                key={doc}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 + 0.3 }}
                                                className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                                            >
                                                <p className="text-sm font-medium text-slate-700">{doc}</p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Address Documents */}
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Proof of Address</h3>
                                    <div className="space-y-2">
                                        {['Aadhaar Card', 'Passport', 'Voter ID'].map((doc, idx) => (
                                            <motion.div
                                                key={doc}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 + 0.45 }}
                                                className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                                            >
                                                <p className="text-sm font-medium text-slate-700">{doc}</p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Important Notice */}
                        <motion.div variants={itemVariants} className="mb-4">
                            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                            <span className="text-amber-700 font-bold text-sm">!</span>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-amber-900 mb-1">Important</p>
                                        <p className="text-xs text-amber-700 leading-relaxed">
                                            You have <span className="font-bold">3 attempts only</span> to complete the KYC process. Please ensure good lighting and clear images before capturing documents.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* CTA Section */}
                        <motion.div variants={itemVariants} className="text-center pt-4 border-t border-slate-200">
                            <Link href="/verify">
                                <Button size="lg" className="text-base px-10 h-12 rounded-lg bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all">
                                    Start Verification <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </Link>
                            <p className="mt-3 text-xs text-slate-500 flex items-center justify-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                Encrypted & Secure
                            </p>
                        </motion.div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="text-center mt-4 text-slate-400 text-xs">&copy; 2024 Quik KYC. Secure & Compliant.</p>
            </motion.main>
        </div>
    );
}
