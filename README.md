# Quik KYC

Quik KYC is a streamlined digital KYC (Know Your Customer) onboarding application designed to reduce drop-offs and improve conversion rates. It features a user-friendly wizard for identity verification, document scanning, and liveness checks.

## Features

- **User Onboarding:** A smooth, step-by-step onboarding wizard.
- **Identity & Address Proof:** Support for uploading and validating Aadhaar, PAN, and Passport documents.
- **OCR Integration:** Automatic text extraction from documents using **Tesseract.js**.
- **Liveness Verification:** Selfie verification to ensure the user is present and real.
- **Status Tracking:** Real-time tracking of KYC application status.

### KYC Status Logic

The application uses the following logic to determine and display the user's KYC status:

- **Verified:** If `kyc_status` is `verified`, the user is fully verified.
- **In Review:** If `kyc_status` is `completed` AND `is_rejected` is `false`, the application is under review.
- **Rejected:** If `is_rejected` is `true`, the application has been rejected (regardless of other status flags).

## Live Demo

Check out the live application here: [https://quik-kyc.vercel.app/](https://quik-kyc.vercel.app/)

### Testing Credentials

To test the application, you can use the following credentials:

| Mobile Number | OTP |
| :--- | :--- |
| **8472954359** | `112233` |
| **8638594655** | `123456` |

## Tech Stack

- **Frontend:** [Next.js](https://nextjs.org/), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/)
- **Backend:** Next.js Server Actions, [Resend](https://resend.com/) (Email)
- **Database:** [PostgreSQL](https://www.postgresql.org/), [Prisma](https://www.prisma.io/), [Supabase](https://supabase.com/)
- **Storage:** Supabase Storage
- **OCR:** [Tesseract.js](https://tesseract.projectnaptha.com/)

## Getting Started

Follow these instructions to set up the project locally.

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository_url>
    cd quik-kyc
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Set up environment variables:
    Create a `.env` file in the root directory and add the following variables:
    ```env
    DATABASE_URL="your_postgresql_database_url"
    NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
    RESEND_API_KEY="your_resend_api_key"
    ```

4.  Set up the database:
    ```bash
    npx prisma generate
    npx prisma db push
    ```

5.  Run the development server:
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Service Setup

### Supabase

1.  **Create a Project:** Go to [Supabase](https://supabase.com/) and create a new project.
2.  **Database Connection:**
    - Get your `DATABASE_URL` (Transaction Pooler) and `DIRECT_URL` (Session Pooler) from Project Settings -> Database -> Connection string.
    - Update your `.env` file with these values.
3.  **Storage Buckets:**
    - Go to Storage and create two **public** buckets:
        - `kyc-documents`
4.  **Auth (Twilio OTP):**
    - Go to Authentication -> Providers -> Phone.
    - Enable the **Phone** provider.
    - Select **Twilio** as the SMS provider.
    - Enter your Twilio credentials:
        - `Account SID`
        - `Auth Token`
        - `Message Service SID` (or sender number)
    - Save changes.
5. **After Setting up database**
    - Go to SQL Editor and run the following queries:
    ```sql
    create trigger on_auth_user_created
        after insert on auth.users
        for each row
        execute procedure public.handle_new_supabase_user();
    ```
    ```sql
    create or replace function public.handle_new_supabase_user()
      returns trigger
      language plpgsql
      security definer
      as $$
      begin
      insert into public.users (supabase_uid, mobile_number)
      values (new.id, '');

      return new;
      end;
      $$;
    ```

### Resend (Email)

1.  **Sign Up:** Create an account at [Resend](https://resend.com/).
2.  **Verify Domain:** Add and verify your domain to send emails.
3.  **API Key:** Generate an API Key and add it to your `.env` file as `RESEND_API_KEY`.

## Scripts

- `npm run dev`: Runs the app in development mode.
- `npm run build`: Builds the app for production.
- `npm run start`: Runs the built app in production mode.
- `npm run lint`: Lints the codebase using ESLint.
- `npm run prisma:generate`: Generates the Prisma client.
- `npm run prisma:push`: Pushes the Prisma schema state to the database.

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Resend Documentation](https://resend.com/docs)
