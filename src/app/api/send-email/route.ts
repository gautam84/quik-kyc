import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { to, url } = body;

        if (!to || !url) {
            return NextResponse.json(
                { error: 'Missing required fields: to, url' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        const { data, error } = await resend.emails.send({
            from: 'KYC Verification <onboarding@resend.dev>', // Change this to your verified domain
            to: [to],
            subject: 'Continue Your KYC on Mobile',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Continue Your KYC Process</title>
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
                        <tr>
                            <td align="center">
                                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                                    <!-- Header -->
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
                                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                                                📱 Continue on Your Phone
                                            </h1>
                                        </td>
                                    </tr>

                                    <!-- Content -->
                                    <tr>
                                        <td style="padding: 40px 30px;">
                                            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                                Hi there,
                                            </p>
                                            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                                You requested to continue your KYC verification on your mobile device. For the best document scanning experience with edge detection and better image quality, we recommend using your mobile phone's camera.
                                            </p>

                                            <!-- CTA Button -->
                                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                                <tr>
                                                    <td align="center">
                                                        <a href="${url}"
                                                           style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center;">
                                                            Continue on Mobile
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>

                                            <!-- Divider -->
                                            <div style="border-top: 1px solid #e2e8f0; margin: 30px 0;"></div>

                                            <!-- Alternative Link -->
                                            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                                                Or copy and paste this link in your phone's browser:
                                            </p>
                                            <div style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; word-break: break-all;">
                                                <code style="color: #475569; font-size: 13px; font-family: 'Courier New', Courier, monospace;">
                                                    ${url}
                                                </code>
                                            </div>

                                            <!-- Benefits -->
                                            <div style="margin-top: 30px; padding: 20px; background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 6px;">
                                                <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 10px 0;">
                                                    ✓ Why use mobile?
                                                </p>
                                                <ul style="color: #1e40af; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                                                    <li>Better camera quality for document scanning</li>
                                                    <li>Automatic edge detection and alignment</li>
                                                    <li>More convenient and easier to handle</li>
                                                </ul>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0 0 5px 0;">
                                                This link will take you directly to the document scanning page.
                                            </p>
                                            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                                                If you didn't request this email, you can safely ignore it.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Resend error:', error);
            return NextResponse.json(
                { error: 'Failed to send email', details: error },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { success: true, messageId: data?.id },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error sending email:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
