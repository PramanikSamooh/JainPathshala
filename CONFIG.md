# Deployment & Configuration Guide

A complete step-by-step guide for deploying the **Google Workspace-Native Education Platform** from scratch. This platform is a multi-tenant LMS with payments, live classes, certificates, and deep Google Workspace integration.

**Tech Stack:** Next.js 16 + Firebase (Auth, Firestore, Cloud Functions) + Google Workspace APIs + Vercel

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Firebase Setup](#2-firebase-setup)
3. [Google Cloud Console Setup](#3-google-cloud-console-setup)
4. [Google Workspace Admin Console Setup](#4-google-workspace-admin-console-setup)
5. [Razorpay Setup (Payments)](#5-razorpay-setup-payments)
6. [Zoom Setup (Optional)](#6-zoom-setup-optional)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Local Development](#8-local-development)
9. [Vercel Deployment](#9-vercel-deployment)
10. [Firebase Cloud Functions Deployment](#10-firebase-cloud-functions-deployment)
11. [First Run](#11-first-run)
12. [Updating .firebaserc](#12-updating-firebaserc)
13. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

Before you begin, make sure you have the following:

### Software

| Requirement | Version | Installation |
|-------------|---------|-------------|
| Node.js | 20+ (Cloud Functions use Node 22) | [nodejs.org](https://nodejs.org/) |
| npm | Comes with Node.js | Included with Node.js |
| Firebase CLI | Latest | `npm install -g firebase-tools` |
| Git | Latest | [git-scm.com](https://git-scm.com/) |

### Accounts & Services

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Firebase** (Blaze plan) | Authentication, Firestore database, Cloud Functions | [console.firebase.google.com](https://console.firebase.google.com/) |
| **Google Workspace** | Calendar, Classroom, Meet, Drive, Docs, Forms APIs | [workspace.google.com](https://workspace.google.com/) |
| **Razorpay** | Payment processing (INR) | [dashboard.razorpay.com](https://dashboard.razorpay.com/) |
| **Zoom Pro** (optional) | Live classes via Zoom meetings | [zoom.us](https://zoom.us/) |
| **Vercel** | Hosting the Next.js frontend | [vercel.com](https://vercel.com/) |
| **GitHub** | Source code repository (for Vercel integration) | [github.com](https://github.com/) |

> **Note:** Firebase's Blaze (pay-as-you-go) plan is required for Cloud Functions. The free tier quota is generous and you will not be charged unless you exceed it.

---

## 2. Firebase Setup

### 2.1 Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter a project name (e.g., `edu-platform-prod`)
4. Enable or disable Google Analytics (optional -- if enabled, you will get a `MEASUREMENT_ID`)
5. Click **"Create project"** and wait for it to provision

### 2.2 Enable Google Sign-In

1. In the Firebase Console, go to **Authentication** (left sidebar)
2. Click **"Get started"** if this is your first time
3. Go to the **"Sign-in method"** tab
4. Click **"Google"** in the list of providers
5. Toggle the **Enable** switch to ON
6. Enter a **project support email** (your admin email)
7. Click **"Save"**

### 2.3 Enable Cloud Firestore

1. In the Firebase Console, go to **Firestore Database** (left sidebar)
2. Click **"Create database"**
3. Select **"Start in production mode"** (security rules will be deployed later)
4. Choose a Cloud Firestore location closest to your users (e.g., `asia-south1` for India, `us-central1` for US)
5. Click **"Enable"**

> **Important:** The location you choose cannot be changed later. Pick one close to your primary user base.

### 2.4 Enable Cloud Functions

1. Cloud Functions require the **Blaze (pay-as-you-go)** plan
2. In the Firebase Console, click the **"Upgrade"** button in the bottom-left
3. Follow the prompts to set up billing
4. Cloud Functions will be automatically available once you are on the Blaze plan

### 2.5 Get Client SDK Configuration

These are the **public** Firebase configuration values used by the browser.

1. In the Firebase Console, go to **Project Settings** (gear icon in the top-left)
2. Scroll down to **"Your apps"**
3. If no web app exists, click **"Add app"** and select the **Web** icon (`</>`)
4. Register the app with a nickname (e.g., `edu-platform-web`)
5. You will see a config object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  measurementId: "G-XXXXXXXXXX"   // only if Analytics is enabled
};
```

6. Copy each value into the corresponding environment variable:

| Config Key | Environment Variable |
|------------|---------------------|
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |
| `measurementId` | `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` |

### 2.6 Get Admin SDK Credentials

These are **server-only** credentials. Never expose them to the browser.

1. In **Project Settings**, go to the **"Service accounts"** tab
2. Click **"Generate new private key"**
3. A JSON file will be downloaded. Open it and extract:

| JSON Field | Environment Variable |
|------------|---------------------|
| `project_id` | `FIREBASE_PROJECT_ID` |
| `client_email` | `FIREBASE_CLIENT_EMAIL` |
| `private_key` | `FIREBASE_PRIVATE_KEY` |

> **Security:** Delete the downloaded JSON file after extracting the values. Never commit it to version control.

### 2.7 Deploy Security Rules and Indexes

Once the Firebase CLI is set up and `.firebaserc` is configured (see [Section 12](#12-updating-firebaserc)):

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 3. Google Cloud Console Setup

The platform uses Google Workspace APIs (Calendar, Classroom, Drive, Docs, Forms) via a service account with domain-wide delegation.

### 3.1 Enable Required APIs

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Select the **same project** as your Firebase project (they share the same Google Cloud project)
3. Navigate to **APIs & Services > Library**
4. Search for and **enable** each of the following APIs:

| API | Purpose |
|-----|---------|
| **Google Calendar API** | Creating live class events and Google Meet links |
| **Google Classroom API** | Creating Classroom courses and managing rosters |
| **Google Drive API** | Storing certificates, course materials |
| **Google Docs API** | Generating certificate documents from templates |
| **Google Forms API** | Reading form submissions for quizzes/assessments |
| **Admin SDK API** | Looking up Google Workspace user accounts |

To enable each API:
- Click on the API name in the Library
- Click the **"Enable"** button
- Wait for it to activate, then go back and enable the next one

### 3.2 Create or Configure a Service Account

You can either create a new service account or use the Firebase Admin SDK service account created in step 2.6.

**Option A: Use the existing Firebase service account (recommended)**

1. Go to **IAM & Admin > Service Accounts**
2. Find the service account ending in `@your-project-id.iam.gserviceaccount.com` (the one Firebase created)
3. Click on it to view details
4. Note down:
   - **Email** (e.g., `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`) -- this is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - **Unique ID** (a numeric string like `1234567890123456789`) -- you will need this for domain-wide delegation in [Section 4](#4-google-workspace-admin-console-setup)

**Option B: Create a new service account**

1. Go to **IAM & Admin > Service Accounts**
2. Click **"Create Service Account"**
3. Enter a name (e.g., `edu-platform-workspace`)
4. Click **"Create and Continue"**
5. Grant the role **"Editor"** (or more restrictive roles as needed)
6. Click **"Done"**
7. Click on the new service account
8. Go to the **"Keys"** tab
9. Click **"Add Key" > "Create new key"**
10. Select **JSON** and click **"Create"**
11. A JSON file will download. Extract:

| JSON Field | Environment Variable |
|------------|---------------------|
| `client_email` | `GOOGLE_SERVICE_ACCOUNT_EMAIL` |
| `private_key` | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` |

12. Note the **Unique ID** (Client ID) from the service account details page -- you will need this for domain-wide delegation

> **Important:** The **Unique ID** (also called Client ID) is a numeric string found on the service account details page. This is NOT the `client_id` in the JSON file. You need this number for the Google Workspace Admin Console delegation step.

---

## 4. Google Workspace Admin Console Setup

Domain-wide delegation allows the service account to act on behalf of users in your Google Workspace domain (e.g., creating Calendar events as an admin user, managing Classroom courses).

### 4.1 Configure Domain-Wide Delegation

1. Go to [admin.google.com](https://admin.google.com/)
2. Sign in with a **Super Admin** account for your Google Workspace domain
3. Navigate to: **Security > Access and data control > API controls**
4. Scroll down to the **"Domain-wide delegation"** section
5. Click **"Manage Domain Wide Delegation"**
6. Click **"Add new"**
7. Fill in the form:

   - **Client ID:** Paste the service account's **Unique ID** (numeric) from [Section 3](#3-google-cloud-console-setup)
   - **OAuth scopes:** Paste the following scopes as a single comma-separated string (no spaces after commas):

```
https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/classroom.courses,https://www.googleapis.com/auth/classroom.rosters,https://www.googleapis.com/auth/drive.file,https://www.googleapis.com/auth/documents,https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/forms.body.readonly,https://www.googleapis.com/auth/forms.responses.readonly
```

8. Click **"Authorize"**

### 4.2 Set the Admin Email

The service account impersonates a real Google Workspace admin user when calling APIs. Set the `GOOGLE_WORKSPACE_ADMIN_EMAIL` environment variable to the email address of a **Google Workspace admin user** in your domain (e.g., `admin@yourdomain.com`).

Requirements for this user:
- Must be a real user in your Google Workspace domain (not a group or alias)
- Must have admin privileges
- Must have the APIs enabled for their account

### Scope Reference

| Scope | What It Allows |
|-------|---------------|
| `calendar.events` | Create, read, update, delete Calendar events (live classes with Meet links) |
| `classroom.courses` | Create and manage Google Classroom courses |
| `classroom.rosters` | Add/remove students and teachers in Classroom |
| `drive.file` | Create and manage files in Google Drive (certificates, materials) |
| `documents` | Create and edit Google Docs (certificate generation) |
| `admin.directory.user.readonly` | Look up user accounts in Google Workspace directory |
| `forms.body.readonly` | Read Google Forms structure (quizzes) |
| `forms.responses.readonly` | Read Google Forms responses (quiz submissions) |

---

## 5. Razorpay Setup (Payments)

Razorpay handles payment processing for paid courses. It supports UPI, cards, net banking, and wallets for Indian users.

### 5.1 Create a Razorpay Account

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com/)
2. Sign up and complete KYC verification
3. You will start in **Test Mode** -- you can switch to **Live Mode** after testing

### 5.2 Get API Keys

1. In the Razorpay Dashboard, go to **Settings > API Keys**
2. Click **"Generate Key"** (or use existing keys)
3. Copy the values:

| Razorpay Field | Environment Variable(s) |
|----------------|------------------------|
| **Key ID** (starts with `rzp_test_` or `rzp_live_`) | `RAZORPAY_KEY_ID` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` (same value for both) |
| **Key Secret** | `RAZORPAY_KEY_SECRET` |

> **Note:** `NEXT_PUBLIC_RAZORPAY_KEY_ID` is exposed to the browser for the Razorpay checkout widget. This is safe -- the Key ID is a public identifier, not a secret.

### 5.3 Configure Webhooks

Webhooks notify your app when payments are completed.

1. In the Razorpay Dashboard, go to **Settings > Webhooks**
2. Click **"Add New Webhook"**
3. Configure:

| Field | Value |
|-------|-------|
| **Webhook URL** | `https://your-domain.com/api/webhooks/razorpay` |
| **Secret** | Generate a strong random string (save this as `RAZORPAY_WEBHOOK_SECRET`) |
| **Alert Email** | Your admin email |
| **Active Events** | Check the following events: |

Events to enable:
- `payment.authorized`
- `payment.captured`

4. Click **"Create Webhook"**

> **Test Mode vs Live Mode:** Razorpay provides separate API keys for test and live modes. Use test keys during development and switch to live keys for production. Remember to create webhooks in both modes.

---

## 6. Zoom Setup (Optional)

If you want to offer live classes via Zoom in addition to (or instead of) Google Meet, configure a Zoom Server-to-Server OAuth app.

> **Requirement:** You need a Zoom Pro, Business, or Enterprise account. The free Zoom plan does not support Server-to-Server OAuth apps.

### 6.1 Create a Server-to-Server OAuth App

1. Go to [marketplace.zoom.us](https://marketplace.zoom.us/)
2. Sign in with your Zoom account
3. Click **"Develop"** in the top navigation, then **"Build App"**
4. Select **"Server-to-Server OAuth"** as the app type
5. Give your app a name (e.g., `EduPlatform`)
6. Click **"Create"**

### 6.2 Note Credentials

On the **"App Credentials"** page, copy:

| Zoom Field | Environment Variable |
|------------|---------------------|
| **Account ID** | `ZOOM_ACCOUNT_ID` |
| **Client ID** | `ZOOM_CLIENT_ID` |
| **Client Secret** | `ZOOM_CLIENT_SECRET` |

### 6.3 Add Required Scopes

Go to the **"Scopes"** tab and add the following scopes:

| Scope | Purpose |
|-------|---------|
| `meeting:write:meeting:admin` | Create meetings |
| `meeting:write:registrant:admin` | Manage meeting registrations |
| `meeting:read:meeting:admin` | Read meeting details |
| `meeting:read:participant:admin` | Read participant info |
| `meeting:read:registrant:admin` | Read registration info |
| `report:read:meeting:admin` | Read meeting reports |
| `report:read:list_meeting_participants:admin` | Read participant lists |

### 6.4 Set Up Webhooks (Event Subscriptions)

Go to the **"Feature"** tab, then **"Event Subscriptions"**:

1. Toggle **"Event Subscriptions"** to ON
2. Click **"Add Event Subscription"**
3. Configure:

| Field | Value |
|-------|-------|
| **Subscription Name** | `EduPlatform Events` |
| **Event Notification Endpoint URL** | `https://your-domain.com/api/webhooks/zoom` |

4. Click **"Add Events"** and select:
   - `meeting.started`
   - `meeting.ended`
   - `meeting.participant_joined`
   - `meeting.participant_left`

5. Copy the **Secret Token** displayed on the event subscription page:

| Zoom Field | Environment Variable |
|------------|---------------------|
| **Secret Token** | `ZOOM_WEBHOOK_SECRET` |

6. Click **"Save"**

### 6.5 Activate the App

1. Go to the **"Activation"** tab
2. Click **"Activate your app"**
3. The app must show as **Active** for API calls to work

### 6.6 Set Default User

Set the `ZOOM_DEFAULT_USER_ID` environment variable to `me`. This tells the platform to create meetings under the account owner.

```
ZOOM_DEFAULT_USER_ID=me
```

---

## 7. Environment Variables Reference

Below is the complete list of environment variables. Copy `.env.local.example` to `.env.local` for local development, and set these in Vercel for production.

```bash
cp .env.local.example .env.local
```

### Firebase Client SDK (Public -- safe to expose in browser)

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase API key | Firebase Console > Project Settings > General > Your apps |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain (e.g., `project.firebaseapp.com`) | Firebase Console > Project Settings > General > Your apps |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID | Firebase Console > Project Settings > General > Your apps |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket | Firebase Console > Project Settings > General > Your apps |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | FCM sender ID | Firebase Console > Project Settings > General > Your apps |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase app ID | Firebase Console > Project Settings > General > Your apps |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | No | Google Analytics measurement ID | Firebase Console > Project Settings > General > Your apps |

### Firebase Admin SDK (Server Only -- NEVER prefix with NEXT_PUBLIC_)

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `FIREBASE_PROJECT_ID` | Yes | Same as `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Admin SDK JSON (`project_id`) |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email | Firebase Admin SDK JSON (`client_email`) |
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase service account private key (RSA) | Firebase Admin SDK JSON (`private_key`) |

### Google Service Account (Server Only)

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes | Service account email for Google APIs | Google Cloud Console > IAM > Service Accounts |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Yes | Service account private key for Google APIs | Google Cloud Console > IAM > Service Accounts > Keys |
| `GOOGLE_WORKSPACE_ADMIN_EMAIL` | Yes | Google Workspace admin email (for impersonation) | Your Google Workspace admin user email |

### Razorpay (Payments)

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `RAZORPAY_KEY_ID` | Yes | Razorpay API Key ID | Razorpay Dashboard > Settings > API Keys |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay API Key Secret | Razorpay Dashboard > Settings > API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Webhook signing secret | Razorpay Dashboard > Settings > Webhooks |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Public key for Razorpay checkout widget (same value as `RAZORPAY_KEY_ID`) | Same as `RAZORPAY_KEY_ID` |

### Zoom (Optional)

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `ZOOM_ACCOUNT_ID` | No | Zoom Server-to-Server OAuth Account ID | Zoom App Marketplace > App Credentials |
| `ZOOM_CLIENT_ID` | No | Zoom app Client ID | Zoom App Marketplace > App Credentials |
| `ZOOM_CLIENT_SECRET` | No | Zoom app Client Secret | Zoom App Marketplace > App Credentials |
| `ZOOM_WEBHOOK_SECRET` | No | Zoom webhook secret token | Zoom App Marketplace > Event Subscriptions |
| `ZOOM_DEFAULT_USER_ID` | No | Default Zoom user ID (usually `me`) | Set to `me` |

### App Configuration

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `NEXT_PUBLIC_APP_NAME` | No | Platform display name (default: `My Learning Platform`) | Your choice |
| `NEXT_PUBLIC_APP_URL` | Yes | Full URL of the deployed app | e.g., `https://app.example.com` (use `http://localhost:3000` for local dev) |
| `NEXT_PUBLIC_DEFAULT_INSTITUTION_ID` | Yes | Default institution slug/ID | Your institution identifier (e.g., `ifs`, `demo`) |

### Session

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `SESSION_COOKIE_NAME` | No | Session cookie name (default: `__session`) | Set to `__session` (required by Firebase Hosting) |
| `SESSION_COOKIE_MAX_AGE` | No | Cookie expiry in seconds (default: `432000` = 5 days) | Set as needed |

### Google Cloud Storage (Future)

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `GCS_VIDEO_BUCKET` | No | GCS bucket name for video storage | Google Cloud Console > Storage |
| `GCS_SIGNED_URL_EXPIRY_SECONDS` | No | Signed URL expiry (default: `7200` = 2 hours) | Set as needed |

### Security

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `CRON_SECRET` | No | Secret to authenticate cron job endpoints | Generate a random string (e.g., `openssl rand -hex 32`) |

### AI / Testing (Optional)

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `ANTHROPIC_API_KEY` | No | API key for AI-powered test analysis | [console.anthropic.com](https://console.anthropic.com/) |

---

## 8. Local Development

### 8.1 Clone and Install

```bash
git clone https://github.com/your-org/edu-platform.git
cd edu-platform
npm install
```

### 8.2 Configure Environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in all required variables following [Section 7](#7-environment-variables-reference).

### 8.3 Install Cloud Functions Dependencies

```bash
cd functions
npm install
cd ..
```

### 8.4 Run the Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### 8.5 Run Firebase Emulators (Optional)

For local development with emulated Firestore, Auth, and Functions:

```bash
firebase emulators:start
```

The emulator UI will be available at [http://localhost:4000](http://localhost:4000).

| Emulator | Port |
|----------|------|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Emulator UI | 4000 |

---

## 9. Vercel Deployment

### 9.1 Push to GitHub

Ensure your code is pushed to a GitHub repository:

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 9.2 Import to Vercel

1. Go to [vercel.com](https://vercel.com/) and sign in
2. Click **"Add New" > "Project"**
3. Import your GitHub repository
4. Vercel will auto-detect the framework as **Next.js**

### 9.3 Set Environment Variables

1. Before deploying, go to **Settings > Environment Variables**
2. Add **ALL** required environment variables from [Section 7](#7-environment-variables-reference)
3. Set them for the appropriate environments (Production, Preview, Development)

> **IMPORTANT: Private Key Encoding**
>
> For `FIREBASE_PRIVATE_KEY` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`:
> - Paste the key exactly as it appears in the JSON file, with literal `\n` characters
> - Do **NOT** replace `\n` with actual newlines when pasting into Vercel
> - The application code handles the conversion with `.replace(/\\n/g, "\n")`
> - The key should look like: `-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n...\n-----END RSA PRIVATE KEY-----\n`

### 9.4 Deploy

1. Build command: `npm run build` (auto-detected)
2. Output directory: `.next` (auto-detected)
3. Framework preset: **Next.js** (auto-detected)
4. Click **"Deploy"**

### 9.5 Configure Custom Domain (Optional)

1. In Vercel, go to **Settings > Domains**
2. Add your custom domain
3. Follow the DNS configuration instructions
4. Update `NEXT_PUBLIC_APP_URL` to match your production domain

---

## 10. Firebase Cloud Functions Deployment

Cloud Functions handle background tasks like webhook processing, scheduled jobs, and server-side operations that cannot run in Vercel's serverless functions.

### 10.1 Login and Set Project

```bash
firebase login
firebase use your-firebase-project-id
```

### 10.2 Install Dependencies and Deploy

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

> **Note:** The `firebase.json` file has a `predeploy` step that automatically runs `npm run build` (TypeScript compilation) before deploying functions.

### 10.3 Deploy Firestore Rules and Indexes

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Or deploy everything at once:

```bash
firebase deploy --only functions,firestore:rules,firestore:indexes
```

### 10.4 Set Cloud Functions Environment Variables

Cloud Functions need their own environment configuration. You have two options:

**Option A: Using `.env` file in `functions/` directory (recommended)**

Create a `functions/.env` file:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_WORKSPACE_ADMIN_EMAIL=admin@yourdomain.com
```

> **Note:** The `functions/.env` file is automatically loaded by Firebase Cloud Functions (v2). Do not commit this file to version control -- add it to `.gitignore`.

**Option B: Using Firebase Functions config**

```bash
firebase functions:config:set \
  google.service_account_email="your-sa@project.iam.gserviceaccount.com" \
  google.private_key="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n" \
  google.workspace_admin_email="admin@yourdomain.com"
```

---

## 11. First Run

After deploying to Vercel and setting up Firebase, follow these steps to initialize your platform.

### 11.1 Sign In for the First Time

1. Visit your deployed URL (e.g., `https://app.example.com`)
2. Click **"Sign in with Google"**
3. Sign in with your Google account -- this creates your user in Firebase Auth

### 11.2 Seed the Database

The seed script creates an example institution with sample courses:

```bash
npx tsx scripts/seed.ts
```

This creates:
- 1 institution (using the `NEXT_PUBLIC_DEFAULT_INSTITUTION_ID` from `.env.local`)
- 1 free course ("Getting Started") with 1 module and 2 lessons
- 1 paid course ("Sample Paid Course" at Rs. 999)

### 11.3 Make Yourself Super Admin

Set your account as a `super_admin` to access all admin features:

```bash
npx tsx scripts/set-admin-role.ts your-email@example.com
```

> **IMPORTANT:** After running this script, you **must sign out and sign back in** for the custom claims to take effect.

Alternatively, if you just want to promote the first user who signed in:

```bash
npx tsx scripts/setup-admin.ts
```

This script automatically finds the first user in Firebase Auth and sets them as `super_admin`.

### 11.4 Set the Google Workspace Admin Email

Configure the admin email on your institution for Google Workspace API calls:

```bash
npx tsx scripts/set-admin-email.ts <institutionId> admin@yourdomain.com
```

For example:

```bash
npx tsx scripts/set-admin-email.ts ifs admin@ifs.edu
```

You can optionally pass a third argument to set the service account email on the institution:

```bash
npx tsx scripts/set-admin-email.ts ifs admin@ifs.edu sa@project.iam.gserviceaccount.com
```

### 11.5 Configure Branding

1. Sign in as super_admin
2. Go to **Admin > Institutions**
3. Click **Edit** on your institution
4. Configure:
   - Institution name and tagline
   - Logo and favicon URLs
   - Primary, secondary, and accent colors
   - Footer text and contact information
   - Allowed email domains (e.g., `gmail.com`, `yourdomain.com`)
   - Course settings (default access duration, self-registration toggle)

---

## 12. Updating .firebaserc

The `.firebaserc` file tells the Firebase CLI which project to use. Update it with your Firebase project ID:

```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

Replace `your-firebase-project-id` with the actual project ID from Firebase Console (e.g., `edu-platform-prod`).

---

## Troubleshooting

### Private Key Errors

**Error:** `error:1E08010C:DECODER routines::unsupported`

**Cause:** The private key has literal `\n` characters instead of real newline characters.

**Solution:** The application code already handles this with `.replace(/\\n/g, "\n")`. Ensure you are pasting the private key as-is from the JSON file (with the literal `\n` sequences intact). Do not manually convert `\n` to real newlines.

---

### Google Workspace API Errors

**Error:** `invalid_grant: Not a valid email or user ID`

**Checklist:**
1. Verify domain-wide delegation is configured in [Google Workspace Admin Console](#4-google-workspace-admin-console-setup)
2. Confirm the **Client ID** (numeric Unique ID) in the Admin Console matches the service account in Google Cloud Console
3. Ensure `GOOGLE_WORKSPACE_ADMIN_EMAIL` is a valid, active admin user in your Google Workspace domain
4. Check that the service account has not been deleted or disabled
5. Wait 5-10 minutes after setting up delegation -- propagation can take time

---

### Missing Admin Email

**Error:** `Google Workspace admin email is not configured`

**Cause:** The institution document in Firestore does not have the `googleWorkspace.adminEmail` field set.

**Solution:** Run the set-admin-email script:

```bash
npx tsx scripts/set-admin-email.ts <institutionId> admin@yourdomain.com
```

Or set it manually in Firestore: `institutions/{id}` > `googleWorkspace.adminEmail`

---

### Firebase Auth Custom Claims Not Taking Effect

**Symptom:** You ran `set-admin-role.ts` but still see "Access Denied" or cannot access admin features.

**Solution:** Custom claims are embedded in the Firebase ID token. The user must **sign out and sign back in** to get a new token with the updated claims.

---

### Cloud Functions Deployment Fails

**Error:** `Error: Firebase project not found` or `Error: Could not find or parse firebase.json`

**Checklist:**
1. Ensure you are logged in: `firebase login`
2. Ensure `.firebaserc` has the correct project ID ([Section 12](#12-updating-firebaserc))
3. Ensure you are on the Blaze plan (required for Cloud Functions)
4. Run from the project root directory (where `firebase.json` exists)

---

### Razorpay Webhooks Not Firing

**Checklist:**
1. Verify the webhook URL is correct and publicly accessible (not `localhost`)
2. Check that the correct events are selected (`payment.authorized`, `payment.captured`)
3. Verify `RAZORPAY_WEBHOOK_SECRET` matches the secret configured in the Razorpay Dashboard
4. Check Razorpay Dashboard > Webhooks > click the webhook > view recent deliveries for error details

---

### Zoom Meeting Creation Fails

**Checklist:**
1. Verify the Zoom app is **activated** (not just created)
2. Check that all required scopes are added ([Section 6.3](#63-add-required-scopes))
3. Ensure `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, and `ZOOM_CLIENT_SECRET` are all set
4. Verify your Zoom plan supports Server-to-Server OAuth (requires Pro or higher)

---

### Build Failures on Vercel

**Error:** `Module not found` or environment variable-related errors during build

**Checklist:**
1. All `NEXT_PUBLIC_*` variables must be set in Vercel **before** the build runs (they are embedded at build time)
2. Server-only variables (`FIREBASE_PRIVATE_KEY`, etc.) can be set at any time
3. Verify no typos in environment variable names
4. Check that the Vercel deployment environment (Production/Preview) has the variables set

---

### Firestore Permission Denied

**Error:** `PERMISSION_DENIED: Missing or insufficient permissions`

**Checklist:**
1. Deploy security rules: `firebase deploy --only firestore:rules`
2. Ensure the user is authenticated and has the correct role
3. Check that the institution ID in the user's claims matches the data being accessed
4. For admin operations, verify the user has `admin` or `super_admin` role
