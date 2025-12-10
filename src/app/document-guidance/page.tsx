'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Shield, FileCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { KYCProgress } from '@/components/kyc-progress';
import Image from 'next/image';

export default function DocumentGuidancePage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.push('/verify');
                    return;
                }
                setUserId(session.user.id);

                // Get user progress
                const { getUserProgress } = await import('../actions/authActions');
                const result = await getUserProgress(session.user.id);

                if (result.success && result.user) {
                    const user = result.user;

                    // Set completed steps based on user progress
                    const steps = [];
                    if (user.full_name && user.email && user.date_of_birth && user.passport_photo_url) {
                        steps.push('basic_details');
                    }
                    if (user.identity_doc_type) {
                        steps.push('identity_scan');
                    }
                    if (user.address_doc_type) {
                        steps.push('address_scan');
                    }
                    if (user.liveness_verified) {
                        steps.push('liveness');
                    }
                    setCompletedSteps(steps);
                }
            } catch (error) {
                console.error('Error checking session:', error);
            }
        };
        checkSession();
    }, [router]);

    const handleContinue = async () => {
        if (!userId) return;

        try {
            const { saveProgress } = await import('../actions/authActions');
            await saveProgress(userId, {
                kyc_step: 'identity_scan'
            });
            router.push('/scan');
        } catch (error) {
            console.error(error);
            toast.error("Something went wrong");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="mb-6">
                                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                                    Document Guidance
                                </div>
                                <h1 className="text-3xl font-bold text-slate-900 mb-2">Document Verification</h1>
                                <p className="text-slate-600">Please review the guidelines before scanning.</p>
                            </div>

                            <Card className="border-none shadow-xl mb-6">
                                <CardHeader>
                                    <CardTitle>Required Documents</CardTitle>
                                    <CardDescription>Keep these documents handy</CardDescription>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-4">
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
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-xl mb-8">
                                <CardHeader>
                                    <CardTitle>Photo Guidelines</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 border border-green-200 bg-green-50 rounded-lg text-center">
                                            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-green-800">Good Lighting</p>
                                            <p className="text-xs text-green-600">Avoid shadows and glare</p>
                                        </div>
                                        <div className="p-4 border border-green-200 bg-green-50 rounded-lg text-center">
                                            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-green-800">Clear Text</p>
                                            <p className="text-xs text-green-600">Ensure text is readable</p>
                                        </div>
                                        <div className="p-4 border border-green-200 bg-green-50 rounded-lg text-center">
                                            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-green-800">Full Document</p>
                                            <p className="text-xs text-green-600">Show all four corners</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-xl mb-8">
                                <CardHeader>
                                    <CardTitle>Scanning Guidelines</CardTitle>
                                    <CardDescription>Follow these examples for a successful verification</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <div className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-green-500 shadow-sm">
                                                <Image
                                                    src="/pan_correct.png"
                                                    alt="Correct Document"
                                                    fill
                                                    className="object-cover"
                                                />
                                                <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-green-700">
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span className="text-sm font-medium">Perfect</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-red-200 opacity-80">
                                                <Image
                                                    src="/pan_blurry.png"
                                                    alt="Blurry Document"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1.5 text-red-600">
                                                <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">✕</div>
                                                <span className="text-sm font-medium">Too Blurry</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-red-200 opacity-80">
                                                <Image
                                                    src="/pan_dark.png"
                                                    alt="Dark Document"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1.5 text-red-600">
                                                <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">✕</div>
                                                <span className="text-sm font-medium">Too Dark</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-red-200 opacity-80">
                                                <Image
                                                    src="/pan_exposed.png"
                                                    alt="Glare on Document"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1.5 text-red-600">
                                                <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">✕</div>
                                                <span className="text-sm font-medium">Has Glare</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-red-200 opacity-80">
                                                <Image
                                                    src="/pan_out_of_frame.png"
                                                    alt="Cut off Document"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1.5 text-red-600">
                                                <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">✕</div>
                                                <span className="text-sm font-medium">Cut Off</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Button
                                onClick={handleContinue}
                                size="lg"
                                className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                            >
                                Start Verification <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </motion.div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="sticky top-6">
                            <KYCProgress
                                currentStep="identity_scan"
                                completedSteps={completedSteps}
                                estimatedTime="5 min"
                                showSaveResume={true}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
