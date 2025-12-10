# Email Setup with Resend

This project uses [Resend](https://resend.com) for sending emails to users who want to continue their KYC process on mobile devices.

## Setup Instructions

### 1. Get Your Resend API Key

1. Sign up for a free account at [resend.com](https://resend.com)
2. Navigate to the API Keys section in your dashboard
3. Create a new API key
4. Copy the API key (it starts with `re_`)

### 2. Configure Environment Variables

The Resend API key is already configured in your `.env` file:

```env
RESEND_API_KEY=re_6SVqY6H9_NrSMbACfccod3i69gNTvmJKz
```

**Important:** This API key is already set up and working. Keep it secure and never commit it to public repositories.

### 3. Verify Your Sending Domain (Optional but Recommended)

By default, Resend allows you to send emails from `onboarding@resend.dev` for testing. For production use:

1. Go to your Resend dashboard
2. Navigate to "Domains" section
3. Add and verify your custom domain
4. Update the `from` field in `/src/app/api/send-email/route.ts`:

```typescript
from: 'KYC Verification <noreply@yourdomain.com>',
```

## How It Works

### API Endpoint

**Location:** `/src/app/api/send-email/route.ts`

**Method:** POST

**Request Body:**
```json
{
  "to": "user@example.com",
  "url": "https://yourapp.com/scan?step=identity"
}
```

**Response (Success):**
```json
{
  "success": true,
  "messageId": "msg_xyz123"
}
```

**Response (Error):**
```json
{
  "error": "Error message",
  "details": {}
}
```

### Email Template

The email includes:
- Professional HTML template with responsive design
- Prominent "Continue on Mobile" CTA button
- Alternative text link for manual copying
- Benefits section explaining why to use mobile
- Mobile-friendly styling

### Frontend Integration

**Location:** `/src/app/scan/page.tsx`

The `handleSendEmail()` function:
1. Fetches the user's email from the backend
2. Sends a POST request to `/api/send-email`
3. Shows success/error toast notifications
4. Closes the modal on success

## Testing

### Test the Email Flow

1. Run your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the scan page
3. Click "Use Camera" button (on desktop)
4. Click "Send Link to Email" button
5. Check your email inbox for the KYC continuation link

### Email Preview

The email template includes:
- ✅ Blue gradient header with phone icon
- ✅ Clear call-to-action button
- ✅ Alternative text link
- ✅ Benefits section with checkmarks
- ✅ Professional footer with disclaimer

## Security Best Practices

1. **API Key Protection:**
   - Never expose your Resend API key in client-side code
   - Keep it in `.env` file (server-side only)
   - Add `.env` to `.gitignore`

2. **Email Validation:**
   - The API validates email format before sending
   - Prevents sending to invalid addresses

3. **Rate Limiting:**
   - Consider adding rate limiting to prevent abuse
   - Resend has built-in rate limits for free tier

## Troubleshooting

### Email Not Received

1. Check spam/junk folder
2. Verify the email address is correct
3. Check Resend dashboard for delivery logs
4. Ensure API key is valid and active

### API Errors

1. Check server logs for detailed error messages
2. Verify `RESEND_API_KEY` is set in `.env`
3. Ensure Resend API is not rate-limited
4. Check network connectivity

### Domain Issues

If using custom domain:
1. Verify DNS records are properly configured
2. Wait for DNS propagation (up to 48 hours)
3. Check domain verification status in Resend dashboard

## Resend Free Tier Limits

- 100 emails per day
- 3,000 emails per month
- Rate limit: 2 emails per second

For higher limits, upgrade to a paid plan at [resend.com/pricing](https://resend.com/pricing).

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend Node.js SDK](https://github.com/resendlabs/resend-node)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
