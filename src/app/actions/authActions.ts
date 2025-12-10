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
        const referenceId = `KYC${Date.now()}${Math.floor(Math.random() * 1000)}`;

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
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error completing KYC:', error);
        return { success: false, error: 'Database error' };
    }
}

export async function verifyLiveness(supabaseUid: string) {
    try {
        const user = await prisma.user.update({
            where: {
                supabase_uid: supabaseUid,
            },
            data: {
                liveness_verified: true,
                kyc_step: 'summary',
                updated_at: new Date(),
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error verifying liveness:', error);
        return { success: false, error: 'Database error' };
    }
}
