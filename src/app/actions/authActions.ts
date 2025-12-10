'use server';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';


export async function syncUser(supabaseUid: string, mobileNumber: string) {
    try {
        const user = await prisma.user.upsert({
            where: {
                supabase_uid: supabaseUid,
            },
            update: {
                mobile_number: mobileNumber,
                updated_at: new Date(),
            },
            create: {
                supabase_uid: supabaseUid,
                mobile_number: mobileNumber,
                kyc_status: 'pending',
                kyc_step: 'onboarding',
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error syncing user:', error);
        return { success: false, error: 'Database error' };
    }
}

export async function getUserProgress(supabaseUid: string) {
    try {
        const user = await prisma.user.findUnique({
            where: {
                supabase_uid: supabaseUid,
            },
        });

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        return { success: true, user };
    } catch (error) {
        console.error('Error getting user progress:', error);
        return { success: false, error: 'Database error' };
    }
}

export async function saveProgress(supabaseUid: string, progressData: Prisma.UserUpdateInput) {
    try {
        const user = await prisma.user.upsert({
            where: {
                supabase_uid: supabaseUid,
            },
            update: {
                ...progressData,
                updated_at: new Date(),
            },
            create: {
                supabase_uid: supabaseUid,
                mobile_number: (progressData.mobile_number as string) || 'UNKNOWN',
                ...(progressData as any),
                kyc_status: 'pending',
                kyc_step: 'document_guidance',
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error saving progress:', error);
        return { success: false, error: 'Database error' };
    }
}

export async function completeKYC(supabaseUid: string) {
    try {
        // Generate reference ID
        // Generate reference ID: KYC-XXXX-XXXX
        const generateSegment = () => Math.random().toString(36).substring(2, 6).toUpperCase();
        const referenceId = `KYC-${generateSegment()}-${generateSegment()}`;


        const user = await prisma.user.update({
            where: {
                supabase_uid: supabaseUid,
            },
            data: {
                kyc_status: 'completed',
                kyc_step: 'completed',
                reference_id: referenceId,
                completed_at: new Date(),
                updated_at: new Date(),
                kyc_attempts: {
                    increment: 1,
                },
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error completing KYC:', error);
        return { success: false, error: 'Database error' };
    }
}

export async function verifyLiveness(supabaseUid: string, selfieUrl?: string) {
    try {
        const user = await prisma.user.update({
            where: {
                supabase_uid: supabaseUid,
            },
            data: {
                liveness_verified: true,
                kyc_step: 'summary',
                updated_at: new Date(),
                // Save the selfie URL if provided
                ...(selfieUrl ? { selfie_image_url: selfieUrl } : {}),
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error verifying liveness:', error);
        return { success: false, error: 'Database error' };
    }
}

/**
 * Increments the KYC attempt counter for a user
 * Call this when a user submits their KYC application
 */
export async function incrementKYCAttempt(supabaseUid: string) {
    try {
        const user = await prisma.user.update({
            where: {
                supabase_uid: supabaseUid,
            },
            data: {
                kyc_attempts: {
                    increment: 1,
                },
                updated_at: new Date(),
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error incrementing KYC attempt:', error);
        return { success: false, error: 'Database error' };
    }
}

/**
 * Marks a user's KYC application as rejected
 * @param supabaseUid The user's Supabase UID
 * @param reason The reason for rejection
 */
export async function rejectKYC(supabaseUid: string, reason: string) {
    try {
        const user = await prisma.user.update({
            where: {
                supabase_uid: supabaseUid,
            },
            data: {
                is_rejected: true,
                rejection_reason: reason,
                kyc_status: 'rejected',
                updated_at: new Date(),
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error rejecting KYC:', error);
        return { success: false, error: 'Database error' };
    }
}

/**
 * Resets the rejection status and allows the user to try again
 * @param supabaseUid The user's Supabase UID
 */
export async function resetKYCRejection(supabaseUid: string) {
    try {
        const user = await prisma.user.update({
            where: {
                supabase_uid: supabaseUid,
            },
            data: {
                is_rejected: false,
                rejection_reason: null,
                kyc_status: 'pending',
                kyc_step: 'onboarding',
                updated_at: new Date(),

                // Reset all personal and document details
                full_name: null,
                email: null,
                date_of_birth: null,

                passport_photo_url: null,

                identity_doc_type: null,
                identity_doc_number: null,
                identity_doc_front_url: null,
                identity_doc_back_url: null,

                address_doc_type: null,
                address_doc_number: null,
                address_doc_front_url: null,
                address_doc_back_url: null,
                address_line: null,

                liveness_verified: false,
                selfie_image_url: null,

                reference_id: null,
                completed_at: null
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error resetting KYC rejection:', error);
        return { success: false, error: 'Database error' };
    }
}

/**
 * Gets the current attempt count and rejection status for a user
 */
export async function getKYCAttemptStatus(supabaseUid: string) {
    try {
        const user = await prisma.user.findUnique({
            where: {
                supabase_uid: supabaseUid,
            },
            select: {
                kyc_attempts: true,
                is_rejected: true,
                rejection_reason: true,
                kyc_status: true,
            },
        });

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        return { success: true, data: user };
    } catch (error) {
        console.error('Error getting KYC attempt status:', error);
        return { success: false, error: 'Database error' };
    }
}
