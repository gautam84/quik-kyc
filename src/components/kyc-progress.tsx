'use client';

import { motion } from 'framer-motion';
import { Check, Clock, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Step = {
    id: string;
    label: string;
    description: string;
    status: 'completed' | 'current' | 'upcoming';
    route?: string;
};

type KYCProgressProps = {
    currentStep: string;
    completedSteps: string[];
    estimatedTime?: string;
    showSaveResume?: boolean;
};

export function KYCProgress({
    currentStep,
    completedSteps,
    estimatedTime = "2 min",
    showSaveResume = true
}: KYCProgressProps) {
    const router = useRouter();

    const steps: Step[] = [
        {
            id: 'basic_details',
            label: 'Basic Details',
            description: 'Personal information',
            status: completedSteps.includes('basic_details')
                ? 'completed'
                : currentStep === 'basic_details'
                    ? 'current'
                    : 'upcoming',
            route: '/basic-details'
        },
        {
            id: 'identity_scan',
            label: 'Proof of Identity',
            description: 'Upload POI document',
            status: completedSteps.includes('identity_scan')
                ? 'completed'
                : currentStep === 'identity_scan'
                    ? 'current'
                    : 'upcoming',
            route: '/scan?type=identity'
        },
        {
            id: 'address_scan',
            label: 'Proof of Address',
            description: 'Upload POA document',
            status: completedSteps.includes('address_scan')
                ? 'completed'
                : currentStep === 'address_scan'
                    ? 'current'
                    : 'upcoming',
            route: '/scan?type=address'
        },
        {
            id: 'liveness',
            label: 'Liveness Check',
            description: 'Facial verification',
            status: completedSteps.includes('liveness')
                ? 'completed'
                : currentStep === 'liveness'
                    ? 'current'
                    : 'upcoming',
            route: '/liveness'
        },
        {
            id: 'summary',
            label: 'Review & Submit',
            description: 'Final confirmation',
            status: completedSteps.includes('summary')
                ? 'completed'
                : currentStep === 'summary'
                    ? 'current'
                    : 'upcoming',
            route: '/summary'
        }
    ];

    const handleSaveResume = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                toast.success("Progress saved! You can resume anytime.");
                router.push('/');
            }
        } catch {
            toast.error("Failed to save progress");
        }
    };

    const handleReview = (step: Step) => {
        if (step.status === 'completed' && step.route) {
            router.push(step.route);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            {/* Header with Time Estimate */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">KYC Progress</h3>
                    <p className="text-sm text-slate-500">Complete all steps to finish verification</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    <span>{estimatedTime} left</span>
                </div>
            </div>

            {/* Progress Steps */}
            <div className="space-y-3 mb-6">
                {steps.map((step, index) => {
                    const isCompleted = step.status === 'completed';
                    const isCurrent = step.status === 'current';

                    return (
                        <div key={step.id}>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`flex items-center gap-4 p-3 rounded-lg transition-all ${isCurrent
                                    ? 'bg-blue-50 border-2 border-blue-500'
                                    : isCompleted
                                        ? 'bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100'
                                        : 'bg-slate-50 border border-slate-200'
                                    }`}
                                onClick={() => handleReview(step)}
                            >
                                {/* Step Icon */}
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold ${isCompleted
                                    ? 'bg-green-500 text-white'
                                    : isCurrent
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-slate-200 text-slate-500'
                                    }`}>
                                    {isCompleted ? (
                                        <Check className="w-5 h-5" />
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </div>

                                {/* Step Details */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className={`font-semibold ${isCurrent
                                            ? 'text-blue-900'
                                            : isCompleted
                                                ? 'text-green-900'
                                                : 'text-slate-500'
                                            }`}>
                                            {step.label}
                                        </h4>
                                        {isCompleted && (
                                            <button
                                                className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReview(step);
                                                }}
                                            >
                                                <Eye className="w-3 h-3" />
                                                Review
                                            </button>
                                        )}
                                    </div>
                                    <p className={`text-xs ${isCurrent
                                        ? 'text-blue-700'
                                        : isCompleted
                                            ? 'text-green-700'
                                            : 'text-slate-400'
                                        }`}>
                                        {step.description}
                                    </p>
                                </div>

                                {/* Current Indicator */}
                                {isCurrent && (
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        className="w-2 h-2 bg-blue-500 rounded-full"
                                    />
                                )}
                            </motion.div>

                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className={`ml-8 h-6 w-0.5 ${isCompleted ? 'bg-green-300' : 'bg-slate-200'
                                    }`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Save and Resume Button */}
            {showSaveResume && (
                <Button
                    variant="outline"
                    className="w-full text-sm"
                    onClick={handleSaveResume}
                >
                    Save & Resume Later
                </Button>
            )}
        </div>
    );
}
