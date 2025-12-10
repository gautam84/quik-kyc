export type StepId = 'basic_details' | 'identity_scan' | 'address_scan' | 'liveness' | 'summary';

/**
 * Calculates the completed steps based on the user object from the database.
 * @param user The user object containing KYC data
 * @returns An array of completed step IDs
 */
export function calculateCompletedSteps(user: any): StepId[] {
    const steps: StepId[] = [];

    if (!user) return steps;

    // 1. Basic Details
    // Considered complete if essential fields are present
    if (user.full_name && user.email && user.date_of_birth && user.passport_photo_url) {
        steps.push('basic_details');
    }

    // 2. Identity Scan
    // Considered complete if doc type is selected (upload happens immediately after selection in the flow usually,
    // but strictly speaking we should check for URLs. However, checking type is consistent with existing logic).
    // Better check: type AND front image url
    if (user.identity_doc_type || user.identity_doc_front_url) {
        steps.push('identity_scan');
    }

    // 3. Address Scan
    if (user.address_doc_type || user.address_doc_front_url) {
        steps.push('address_scan');
    }

    // 4. Liveness
    // Check both liveness_verified and selfie_image_url to ensure liveness was properly completed
    if (user.liveness_verified === true || user.selfie_image_url) {
        steps.push('liveness');
    }

    // 5. Summary/Completion
    if (user.kyc_status === 'completed') {
        steps.push('summary');
    }

    return steps;
}
