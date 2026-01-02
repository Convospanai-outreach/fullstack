# ConvoSpan Setup Guide

## Prerequisites

- **Node.js** 18.x or higher
- **PostgreSQL** 14.x or higher
- **npm** or **yarn** package manager
- **Git** for version control

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd fullstack
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure the following **required** variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/convospan

# Authentication
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your-secret

# Email
SMTP_FROM_EMAIL=noreply@yourdomain.com

# AI (choose one)
OPENAI_API_KEY=sk-xxxxx
```

### 4. Set Up Database

Create a PostgreSQL database:

```bash
createdb convospan
```

Run Prisma migrations:

```bash
npx prisma migrate dev
```

Generate Prisma client:

```bash
npx prisma generate
```

### 5. Seed Database (Optional)

```bash
npm run db:seed
```

### 6. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Detailed Configuration

### Database Setup

1. **Install PostgreSQL**:
   - macOS: `brew install postgresql`
   - Ubuntu: `sudo apt install postgresql`
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/)

2. **Create Database**:
   ```bash
   createdb convospan
   ```

3. **Update DATABASE_URL** in `.env`:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/convospan
   ```

### Authentication Setup

1. **Generate Secret**:
   ```bash
   openssl rand -base64 32
   ```

2. **Google OAuth** (Optional):
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth 2.0 credentials
   - Add to `.env`:
     ```
     GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=your-secret
     ```

### Payment Gateway Setup

1. **Razorpay Account**:
   - Sign up at [razorpay.com](https://razorpay.com)
   - Get API keys from Dashboard → Settings → API Keys
   - Add to `.env`:
     ```
     NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
     RAZORPAY_KEY_SECRET=your-secret
     ```

### Email Service Setup

**Option 1: SendPulse** (Recommended - already integrated)
- Configure in SendPulse dashboard
- No additional env vars needed

**Option 2: Resend**
```bash
RESEND_API_KEY=re_xxxxx
```

**Option 3: Gmail SMTP**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### AI Service Setup

Choose ONE provider:

**OpenAI**:
```bash
OPENAI_API_KEY=sk-xxxxx
```

**Anthropic**:
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

**Google Gemini**:
```bash
GEMINI_API_KEY=xxxxx
```

---

## Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

---

## Building for Production

```bash
# Build
npm run build

# Start production server
npm start
```

---

## Deployment to Vercel

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy

```bash
vercel
```

### 3. Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (your production URL)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `OPENAI_API_KEY` (or your chosen AI provider)
- All other required variables from `.env.example`

### 4. Set Up Database

Use a managed PostgreSQL service:
- **Vercel Postgres** (recommended)
- **Supabase**
- **Railway**
- **Neon**

Update `DATABASE_URL` in Vercel environment variables.

### 5. Run Migrations

```bash
# In Vercel dashboard, run:
npx prisma migrate deploy
```

---

## Troubleshooting

### Database Connection Issues

**Error**: `Can't reach database server`

**Solution**:
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL is correct
- Check firewall settings

### Build Errors

**Error**: `Module not found`

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Prisma Issues

**Error**: `Prisma Client not generated`

**Solution**:
```bash
npx prisma generate
```

### Email Not Sending

**Solution**:
- Check email service credentials
- Verify SMTP settings
- Check console for verification link (fallback)

---

## Project Structure

```
fullstack/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── lib/             # Utilities and configs
│   ├── modules/         # Feature modules
│   └── hooks/           # Custom React hooks
├── prisma/
│   └── schema.prisma    # Database schema
├── tests/               # Unit tests
├── e2e/                 # E2E tests
└── docs/                # Documentation
```

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server

# Database
npx prisma studio        # Open Prisma Studio
npx prisma migrate dev   # Create migration
npx prisma db push       # Push schema changes

# Testing
npm run test             # Run tests
npm run test:watch       # Watch mode
npm run test:e2e         # E2E tests

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # TypeScript check
```

---

## Getting Help

- **Documentation**: Check `/docs` folder
- **API Reference**: See `docs/API_REFERENCE.md`
- **Issues**: Create an issue on GitHub
- **Email**: support@convospan.com

---

## Next Steps

1. ✅ Complete environment setup
2. ✅ Run the application locally
3. 📖 Read the [API Reference](./API_REFERENCE.md)
4. 🧪 Run tests to verify setup
5. 🚀 Deploy to Vercel

Happy coding! 🎉
