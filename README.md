# Plus One

A premium companion booking marketplace built with Next.js 14, Prisma, and SQLite.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Generate Prisma client:
```bash
npx prisma generate
```

4. Push database schema:
```bash
npx prisma db push
```

5. Seed the database with test data:
```bash
npx prisma db seed
```

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Test Accounts

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | admin@plusone.com | admin123 | Full platform access |
| Client (FREE) | client1@test.com | client123 | Limited to 8 messages/20 companions |
| Client (PREMIUM) | client2@test.com | client123 | Unlimited access |
| Companion | priya@plusone.com | companion123 | Pre-seeded companion |
| Companion | ananya@plusone.com | companion123 | Pre-seeded companion |
| Companion | vikram@plusone.com | companion123 | Pre-seeded companion |

## Business Logic

### Free Tier
- Maximum 8 messages per companion
- Can only browse first 20 companions (sorted by distance)
- Upgrade to Premium for ₹5,000

### Premium Tier
- Unlimited companion browsing
- Unlimited messaging
- Priority booking requests

### Companion Accounts
- Created by admin only (no public signup)
- Requires admin approval before being visible to clients
- Can set availability and hourly rates

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** SQLite with Prisma ORM
- **Authentication:** JWT with httpOnly cookies
- **Styling:** Tailwind CSS
- **Realtime:** Polling (4 second intervals)
- **PWA:** next-pwa with service worker

## Project Structure

```
plus-one/
├── app/
│   ├── (auth)/         # Login, signup pages
│   ├── (client)/       # Client dashboard and features
│   ├── (companion)/    # Companion dashboard and features
│   ├── (admin)/        # Admin panel
│   ├── api/            # API routes
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Landing page
├── components/
│   ├── ui/             # UI components
│   ├── layout/         # Navigation components
│   ├── chat/           # Chat components
│   ├── booking/        # Booking components
│   ├── companion/      # Companion components
│   └── admin/          # Admin components
├── lib/
│   ├── auth.ts         # JWT helpers
│   ├── prisma.ts       # Prisma client
│   ├── constants.ts    # Business logic constants
│   └── utils.ts        # Utility functions
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── seed.ts         # Seed data
└── public/
    ├── manifest.json   # PWA manifest
    └── sw.js           # Service worker
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:seed` - Seed database
- `npm run db:studio` - Open Prisma Studio

## Production Deployment

### Quick Deploy

#### Vercel (Easiest)
```bash
npm i -g vercel
vercel --prod
```

#### Docker
```bash
docker-compose up --build -d
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for:
- Vercel
- Railway
- AWS EC2
- Docker

### Environment Variables for Production

Copy `.env` and update with production values:
```bash
cp .env .env.production
# Edit with production values
```

Required production variables:
- `JWT_SECRET` - Generate with `openssl rand -base64 64`
- `NEXT_PUBLIC_APP_URL` - Your production domain
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` - Payment gateway keys
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` - Email configuration
- `ENCRYPTION_KEY` - Generate with `openssl rand -base64 32`

### Health Check

After deployment, verify the app is running:
```bash
curl https://your-domain.com/api/health
```

## Features

### Client Features
- Browse companions with distance-based sorting
- Advanced filters (price, age, gender, languages, interests)
- Favorite companions
- Real-time messaging (8 message limit for free tier)
- Booking management
- Profile management
- Premium subscription upgrade

### Companion Features
- Profile management with availability
- Booking management
- Earnings tracking
- Client messaging

### Admin Features
- User management
- Companion approval
- Booking oversight
- Analytics dashboard
- Verification document review

### Safety Features
- Emergency contact setup
- Safety check-ins
- Verified companion badges
- Report system

## Security

- JWT authentication with httpOnly cookies
- Role-based access control (RBAC)
- CSRF protection
- Security headers (HSTS, CSP, X-Frame-Options)
- Input validation
- Password hashing with bcrypt
- SQL injection prevention via Prisma

## PWA Support

The app is a Progressive Web App with:
- Offline support
- Service worker caching
- Push notifications (ready)
- Mobile-responsive design
- App-like experience

## License

MIT
