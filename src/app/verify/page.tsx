'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, ShieldCheck, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function VerifyPage() {
    const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Check for existing session
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                toast.info("Session restored. Redirecting...");
                router.replace('/onboarding');
            }
        };

        checkSession();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && event === 'SIGNED_IN') {
                router.replace('/onboarding');
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (mobile.length !== 10) {
            toast.error("Please enter a valid 10-digit mobile number");
            return;
        }

        setLoading(true);
        try {
            // Prepend country code +91
            const phoneNumber = `+91${mobile}`;

            const { error } = await supabase.auth.signInWithOtp({
                phone: phoneNumber,
            });

            if (error) throw error;

            setStep('otp');
            toast.success("OTP sent successfully!");
        } catch (error: unknown) {
            // Only log in development
            if (process.env.NODE_ENV === 'development') {
                console.error("Send OTP Error:", error);
            }

            // Handle specific error cases
            const errorMessage = (error as Error)?.message || '';
            if (errorMessage.includes('phone')) {
                toast.error("Invalid phone number format.");
            } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
                toast.error("Too many attempts. Please try again later.");
            } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                toast.error("Network error. Please check your connection.");
            } else {
                toast.error("Failed to send OTP. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            toast.error("Please enter the complete 6-digit OTP");
            return;
        }

        setLoading(true);
        try {
            const phoneNumber = `+91${mobile}`;

            const { data, error } = await supabase.auth.verifyOtp({
                phone: phoneNumber,
                token: otp,
                type: 'sms'
            });

            if (error) throw error;

            if (data.user) {
                // Sync with Supabase DB and get user progress
                const { syncUser, getUserProgress } = await import('../actions/authActions');
                await syncUser(data.user.id, mobile);

                // Get user's current progress
                const progressResult = await getUserProgress(data.user.id);

                toast.success("Verification Successful!");

                // Route based on user's KYC status
                if (progressResult.success && progressResult.user) {
                    const user = progressResult.user;

                    // Slight delay before navigation for better UX
                    setTimeout(() => {
                        if (user.kyc_status === 'completed' || user.kyc_status === 'verified') {
                            // User has completed KYC - show submission page
                            router.push('/submission');
                        } else if (user.kyc_step && user.kyc_step !== 'onboarding') {
                            // User has started but not completed - resume from where they left
                            const stepRoutes: Record<string, string> = {
                                'basic_details': '/basic-details',
                                'identity_scan': '/scan/poi',
                                'address_scan': '/scan/poa',
                                'liveness': '/liveness',
                            };
                            router.push(stepRoutes[user.kyc_step] || '/onboarding');
                        } else {
                            // New user - start from onboarding
                            router.push('/onboarding');
                        }
                    }, 500);
                } else {
                    // Fallback to onboarding if progress check fails
                    setTimeout(() => {
                        router.push('/onboarding');
                    }, 500);
                }
            }
        } catch (error: unknown) {
            // Only log in development
            if (process.env.NODE_ENV === 'development') {
                console.error("Verification Error:", error);
            }

            // Clear OTP field on error
            setOtp('');

            // Handle specific error cases
            const errorMessage = (error as Error)?.message || '';
            if (errorMessage.includes('invalid') || errorMessage.includes('token')) {
                toast.error("Invalid OTP. Please check and try again.");
            } else if (errorMessage.includes('expired')) {
                toast.error("OTP has expired. Please request a new one.");
                setStep('mobile');
            } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
                toast.error("Too many attempts. Please try again later.");
                setStep('mobile');
            } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                toast.error("Network error. Please check your connection.");
            } else {
                toast.error("Verification failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
                        <CardHeader className="space-y-1 text-center pb-8 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                                <ShieldCheck className="w-6 h-6 text-blue-600" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-slate-900">Secure Verification</CardTitle>
                            <CardDescription className="text-slate-500">
                                We need to verify your identity to proceed.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <AnimatePresence mode="wait">
                                {step === 'mobile' ? (
                                    <motion.form
                                        key="mobile-form"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        onSubmit={handleSendOtp}
                                        className="space-y-4"
                                    >
                                        <div className="space-y-2">
                                            <Label htmlFor="mobile">Mobile Number</Label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-3 text-slate-500 text-sm font-medium border-r border-slate-200 pr-2">
                                                    +91
                                                </div>
                                                <Input
                                                    id="mobile"
                                                    type="tel"
                                                    placeholder="Enter 10-digit number"
                                                    className="pl-14 text-lg tracking-wide"
                                                    value={mobile}
                                                    onChange={(e) => {
                                                        const re = /^[0-9\b]+$/;
                                                        if (e.target.value === '' || re.test(e.target.value)) {
                                                            setMobile(e.target.value.slice(0, 10))
                                                        }
                                                    }}
                                                    disabled={loading}
                                                />
                                                <Phone className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                We will send a 6-digit OTP to this number.
                                            </p>
                                        </div>
                                        <Button type="submit" className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700" disabled={loading || mobile.length < 10}>
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>Send OTP <ArrowRight className="ml-2 w-4 h-4" /></>}
                                        </Button>
                                    </motion.form>
                                ) : (
                                    <motion.div
                                        key="otp-form"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-6"
                                    >
                                        <div className="text-center space-y-1">
                                            <p className="text-sm text-slate-500">Enter validation code sent to</p>
                                            <p className="font-medium text-slate-900 text-lg">+91 {mobile}</p>
                                            <button
                                                onClick={() => setStep('mobile')}
                                                className="text-xs text-blue-600 hover:underline font-medium"
                                            >
                                                Change Number
                                            </button>
                                        </div>

                                        <div className="flex justify-center py-2">
                                            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                                                <InputOTPGroup>
                                                    <InputOTPSlot index={0} />
                                                    <InputOTPSlot index={1} />
                                                    <InputOTPSlot index={2} />
                                                </InputOTPGroup>
                                                <InputOTPGroup className="ml-2">
                                                    <InputOTPSlot index={3} />
                                                    <InputOTPSlot index={4} />
                                                    <InputOTPSlot index={5} />
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </div>

                                        <Button
                                            onClick={handleVerifyOtp}
                                            className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700"
                                            disabled={loading || otp.length < 6}
                                        >
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Proceed"}
                                        </Button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </CardContent>
                        <CardFooter className="justify-center border-t p-4 bg-slate-50/50">
                            <p className="text-xs text-slate-400">
                                Secured with bank-grade encryption.
                            </p>
                        </CardFooter>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
