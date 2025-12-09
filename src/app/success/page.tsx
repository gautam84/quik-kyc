'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { CheckCircle2, Home } from 'lucide-react';
import Link from 'next/link';

export default function SuccessPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.8 }}
            >
                <Card className="max-w-md w-full border-none shadow-2xl text-center overflow-hidden">
                    <div className="bg-green-600 h-2"></div>
                    <CardContent className="pt-12 pb-10 px-8 space-y-6">

                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto"
                        >
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </motion.div>

                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold text-slate-900">KYC Submitted!</h1>
                            <p className="text-slate-500">
                                Your KYC verification has been successfully completed and submitted.
                            </p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-left space-y-2">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Ref ID:</span>
                                <span className="font-mono font-medium text-slate-900">KYC-2024-X9Y</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Status:</span>
                                <span className="font-medium text-green-600">Approved Instantly</span>
                            </div>
                        </div>

                        <Link href="/" className="block">
                            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white" size="lg">
                                <Home className="mr-2 h-4 w-4" /> Back to Home
                            </Button>
                        </Link>

                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
