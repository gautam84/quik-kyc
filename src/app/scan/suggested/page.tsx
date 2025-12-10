'use client';

import { useSearchParams } from 'next/navigation';
import { ScanDocument } from '@/components/scan-document';
import { Suspense } from 'react';

function SuggestedScanContent() {
    const searchParams = useSearchParams();
    const docType = searchParams.get('docType');
    const scanType = searchParams.get('scanType') as 'identity' | 'address' | null;

    // Default to identity if not specified
    const type = scanType || 'identity';

    return <ScanDocument scanType={type} suggestedDocType={docType || undefined} />;
}

export default function SuggestedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <SuggestedScanContent />
        </Suspense>
    );
}
