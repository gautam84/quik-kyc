import Tesseract from 'tesseract.js';

export interface DocumentValidationResult {
    isValid: boolean;
    detectedType: string | null;
    extractedData: {
        name?: string;
        documentNumber?: string;
        dob?: string;
        address?: string;
    };
    confidence: number;
    errors: string[];
    warnings: string[];
}

export interface DocumentValidationOptions {
    expectedType: 'pan' | 'aadhaar' | 'passport' | 'voter' | 'driving_license';
    expectedName?: string;
    expectedDob?: string;
}

/**
 * Validates a document image using OCR to detect document type and extract information
 */
export async function validateDocument(
    file: File,
    options: DocumentValidationOptions
): Promise<DocumentValidationResult> {
    const result: DocumentValidationResult = {
        isValid: false,
        detectedType: null,
        extractedData: {},
        confidence: 0,
        errors: [],
        warnings: []
    };

    try {
        // Perform OCR on the image
        const { data } = await Tesseract.recognize(file, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        const ocrText = data.text.toUpperCase();
        console.log('OCR Text:', ocrText);

        // Detect document type based on OCR text
        const detectedType = detectDocumentType(ocrText);
        result.detectedType = detectedType;
        result.confidence = data.confidence;

        // Validate document type matches expected type
        if (!detectedType) {
            result.errors.push('Could not identify document type. Please ensure the image is clear and well-lit.');
            return result;
        }

        if (detectedType !== options.expectedType) {
            result.errors.push(
                `Document type mismatch! You selected ${formatDocumentType(options.expectedType)} but uploaded ${formatDocumentType(detectedType)}.`
            );
            return result;
        }

        // Extract information based on document type
        result.extractedData = extractDocumentData(ocrText, detectedType);

        // Validate extracted data against expected values
        const validationErrors = validateExtractedData(
            result.extractedData,
            {
                expectedName: options.expectedName,
                expectedDob: options.expectedDob
            }
        );

        result.errors.push(...validationErrors);

        // Check confidence level
        if (data.confidence < 60) {
            result.warnings.push(
                'Low OCR confidence. Please ensure the document is clear, well-lit, and all text is readable.'
            );
        }

        // If no errors, mark as valid
        result.isValid = result.errors.length === 0;

        return result;
    } catch (error) {
        console.error('OCR validation error:', error);
        result.errors.push('Failed to process document. Please try again with a clearer image.');
        return result;
    }
}

/**
 * Detects the document type based on OCR text patterns
 */
function detectDocumentType(text: string): string | null {
    // PAN Card patterns
    if (
        text.includes('INCOME TAX') ||
        text.includes('PERMANENT ACCOUNT NUMBER') ||
        text.includes('PAN') && text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/)
    ) {
        return 'pan';
    }

    // Aadhaar Card patterns (more robust)
    // Aadhaar Card patterns (more robust)
    const aadhaarNumberPattern = /\d{4}[\s-]*\d{4}[\s-]*\d{4}/;
    if (
        /AADHAAR|ADHAR|ADHAAR/i.test(text) ||
        (/GOVERNMENT|GOVT/i.test(text) && /INDIA/i.test(text) && aadhaarNumberPattern.test(text)) ||
        text.includes('VID') ||
        /UIDAI/i.test(text) ||
        // Fallback: 12 digit number AND (DOB OR Gender OR India)
        (aadhaarNumberPattern.test(text) && (/DOB|DATE OF BIRTH|YEAR OF BIRTH/i.test(text) || /MALE|FEMALE/i.test(text) || /INDIA/i.test(text)))
    ) {
        return 'aadhaar';
    }

    // Passport patterns
    if (
        text.includes('PASSPORT') ||
        text.includes('REPUBLIC OF INDIA') ||
        text.includes('SURNAME') && text.includes('GIVEN NAME')
    ) {
        return 'passport';
    }

    // Voter ID patterns
    if (
        text.includes('ELECTION COMMISSION') ||
        text.includes('ELECTOR') ||
        text.includes('ELECTORS PHOTO IDENTITY CARD')
    ) {
        return 'voter';
    }

    // Driving License patterns
    if (
        text.includes('DRIVING LICENCE') ||
        text.includes('DRIVING LICENSE') ||
        text.includes('FORM OF LICENCE')
    ) {
        return 'driving_license';
    }

    return null;
}

/**
 * Extracts relevant data from OCR text based on document type
 */
function extractDocumentData(
    text: string,
    docType: string
): { name?: string; documentNumber?: string; dob?: string; address?: string } {
    const data: { name?: string; documentNumber?: string; dob?: string; address?: string } = {};

    switch (docType) {
        case 'pan':
            // Extract PAN number (format: ABCDE1234F)
            const panMatch = text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
            if (panMatch) {
                data.documentNumber = panMatch[0];
            }

            // Extract name (usually appears after "Name" keyword)
            const panNameMatch = text.match(/NAME[:\s]+([A-Z\s]+)/);
            if (panNameMatch) {
                data.name = panNameMatch[1].trim();
            }

            // Extract DOB
            const panDobMatch = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
            if (panDobMatch) {
                data.dob = panDobMatch[1];
            }
            break;

        case 'aadhaar':
            // Extract Aadhaar number (format: XXXX XXXX XXXX)
            const aadhaarMatch = text.match(/\d{4}[\s-]*\d{4}[\s-]*\d{4}/);
            if (aadhaarMatch) {
                data.documentNumber = aadhaarMatch[0].replace(/[\s-]/g, '');
            }

            // Extract DOB
            const aadhaarDobMatch = text.match(/(?:DOB|DATE OF BIRTH|YEAR OF BIRTH)[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4})/);
            if (aadhaarDobMatch) {
                data.dob = aadhaarDobMatch[1];
            }

            // Extract Name (Strategy: Look for the line preceding the DOB line)
            // Split text into lines to analyze structure
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Find the line index containing DOB
            const dobLineIndex = lines.findIndex(l => /(?:DOB|DATE OF BIRTH|YEAR OF BIRTH)/.test(l));

            if (dobLineIndex > 0) {
                // The name is typically on the line before DOB
                // We skip "Government of India" or similar headers if they appear immediately before
                let nameCandidateIndex = dobLineIndex - 1;
                while (nameCandidateIndex >= 0) {
                    const candidate = lines[nameCandidateIndex];
                    // Skip widely known headers
                    if (/GOVERNMENT|INDIA|BHARAT|SARKAR/i.test(candidate)) {
                        nameCandidateIndex--;
                        continue;
                    }
                    // If line is too short or looks like just a label, skip? 
                    // For now, accept it if it's not a header
                    data.name = candidate;
                    break;
                }
            }

            // Extract address (text after "Address:" or similar)
            const addressMatch = text.match(/ADDRESS[:\s]+([A-Z0-9\s,\.\-]+)/);
            if (addressMatch) {
                data.address = addressMatch[1].trim().substring(0, 200); // Limit length
            }
            break;

        case 'passport':
            // Extract passport number (format varies)
            const passportMatch = text.match(/[A-Z]\d{7}|[A-Z]{2}\d{7}/);
            if (passportMatch) {
                data.documentNumber = passportMatch[0];
            }

            // Extract surname and given name
            const surnameMatch = text.match(/SURNAME[:\s]+([A-Z\s]+)/);
            const givenNameMatch = text.match(/GIVEN NAME[S]?[:\s]+([A-Z\s]+)/);
            if (surnameMatch || givenNameMatch) {
                data.name = `${givenNameMatch?.[1]?.trim() || ''} ${surnameMatch?.[1]?.trim() || ''}`.trim();
            }

            // Extract DOB
            const passportDobMatch = text.match(/DATE OF BIRTH[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
            if (passportDobMatch) {
                data.dob = passportDobMatch[1];
            }
            break;

        case 'voter':
            // Extract voter ID number
            const voterMatch = text.match(/[A-Z]{3}\d{7}/);
            if (voterMatch) {
                data.documentNumber = voterMatch[0];
            }

            // Extract name
            const voterNameMatch = text.match(/NAME[:\s]+([A-Z\s]+)/);
            if (voterNameMatch) {
                data.name = voterNameMatch[1].trim();
            }

            // Extract address
            const voterAddressMatch = text.match(/ADDRESS[:\s]+([A-Z0-9\s,\.\-]+)/);
            if (voterAddressMatch) {
                data.address = voterAddressMatch[1].trim().substring(0, 200);
            }
            break;

        case 'driving_license':
            // Extract DL number (format varies by state)
            const dlMatch = text.match(/[A-Z]{2}\d{13}|[A-Z]{2}[-\s]?\d{2}[-\s]?\d{11}/);
            if (dlMatch) {
                data.documentNumber = dlMatch[0].replace(/[-\s]/g, '');
            }

            // Extract name
            const dlNameMatch = text.match(/NAME[:\s]+([A-Z\s]+)/);
            if (dlNameMatch) {
                data.name = dlNameMatch[1].trim();
            }

            // Extract DOB
            const dlDobMatch = text.match(/DOB[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
            if (dlDobMatch) {
                data.dob = dlDobMatch[1];
            }

            // Extract address
            const dlAddressMatch = text.match(/ADDRESS[:\s]+([A-Z0-9\s,\.\-]+)/);
            if (dlAddressMatch) {
                data.address = dlAddressMatch[1].trim().substring(0, 200);
            }
            break;
    }

    return data;
}

/**
 * Validates extracted data against expected values
 */
function validateExtractedData(
    extractedData: { name?: string; documentNumber?: string; dob?: string; address?: string },
    expected: { expectedName?: string; expectedDob?: string }
): string[] {
    const errors: string[] = [];

    // Validate name if provided
    if (expected.expectedName && extractedData.name) {
        const similarity = calculateNameSimilarity(
            expected.expectedName.toUpperCase(),
            extractedData.name
        );

        if (similarity < 0.6) {
            errors.push(
                `Name mismatch! Document shows "${extractedData.name}" but you entered "${expected.expectedName}".`
            );
        }
    }

    // Validate DOB if provided
    if (expected.expectedDob && extractedData.dob) {
        const normalizedExpectedDob = normalizeDateString(expected.expectedDob);
        const normalizedExtractedDob = normalizeDateString(extractedData.dob);

        if (normalizedExpectedDob && normalizedExtractedDob && normalizedExpectedDob !== normalizedExtractedDob) {
            errors.push(
                `Date of birth mismatch! Document shows "${extractedData.dob}" but you entered "${expected.expectedDob}".`
            );
        }
    }

    return errors;
}

/**
 * Calculates similarity between two names (simple Levenshtein-like approach)
 */
function calculateNameSimilarity(name1: string, name2: string): number {
    // Remove extra spaces and normalize
    const n1 = name1.replace(/\s+/g, ' ').trim();
    const n2 = name2.replace(/\s+/g, ' ').trim();

    // Simple character-based similarity
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;

    if (longer.length === 0) return 1.0;

    // Check if shorter name is contained in longer (handles middle name differences)
    if (longer.includes(shorter)) return 0.8;

    // Calculate edit distance
    const editDistance = getEditDistance(n1, n2);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Calculates Levenshtein distance between two strings
 */
function getEditDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Normalizes date string to YYYY-MM-DD format
 */
function normalizeDateString(dateStr: string): string | null {
    // Try to parse various date formats
    const formats = [
        /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, // DD/MM/YYYY or DD-MM-YYYY
        /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/, // YYYY/MM/DD or YYYY-MM-DD
    ];

    for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
            // Determine if it's DD/MM/YYYY or YYYY/MM/DD
            if (match[1].length === 4) {
                // YYYY/MM/DD
                return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
            } else {
                // DD/MM/YYYY - convert to YYYY-MM-DD
                return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
            }
        }
    }

    return null;
}

/**
 * Formats document type for display
 */
function formatDocumentType(type: string): string {
    const labels: Record<string, string> = {
        'pan': 'PAN Card',
        'aadhaar': 'Aadhaar Card',
        'passport': 'Passport',
        'voter': 'Voter ID',
        'driving_license': 'Driving License'
    };
    return labels[type] || type.toUpperCase();
}
