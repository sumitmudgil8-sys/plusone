# Plus One Deployment Guide

Complete deployment instructions for taking the Plus One application to production.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Platform-Specific Deployment](#platform-specific-deployment)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] Environment variables are properly configured
- [ ] Database schema is pushed and migrated
- [ ] Test data seeding is complete (optional)
- [ ] SSL certificate is ready (for custom domains)
- [ ] Email service is configured
- [ ] Payment gateway (Razorpay) account is active
- [ ] Domain DNS is configured

---

## Environment Setup

### 1. Generate Strong Secrets

Generate secure secrets for production:

```bash
# JWT Secret (64 characters)
openssl rand -base64 64

# Encryption Key (32 characters)
openssl rand -base64 32
```

### 2. Environment Variables

Update your `.env` file with production values:

```env
# Database
DATABASE_URL="file:./prod.db"

# Authentication
JWT_SECRET="your-generated-jwt-secret"

# App URL (Your production domain)
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Payment - Razorpay
RAZORPAY_KEY_ID="rzp_live_your_key_id"
RAZORPAY_KEY_SECRET="your_live_key_secret"

# Email - SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Security
ENCRYPTION_KEY="your-generated-32-char-key"

# Environment
NODE_ENV="production"
```

**Note:** Never commit the `.env` file to version control. Use your hosting platform's environment variable management.

---

## Platform-Specific Deployment

### Option 1: Vercel (Recommended)

[Vercel](https://vercel.com) is the easiest platform for Next.js deployments.

#### Steps:

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Configure Environment Variables**:
   - Go to your project dashboard
   - Navigate to Settings > Environment Variables
   - Add all variables from your `.env` file

5. **Configure Custom Domain** (optional):
   - Go to Settings > Domains
   - Add your custom domain
   - Follow DNS configuration instructions

#### Vercel Configuration (`vercel.json`):

Create a `vercel.json` file:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["bom1"]
}
```

---

### Option 2: Railway

[Railway](https://railway.app) offers easy deployment with persistent storage.

#### Steps:

1. **Install Railway CLI**:
   ```bash
   npm i -g @railway/cli
   ```

2. **Login**:
   ```bash
   railway login
   ```

3. **Initialize Project**:
   ```bash
   railway init
   ```

4. **Add Environment Variables**:
   ```bash
   railway vars set JWT_SECRET="your-secret"
   railway vars set DATABASE_URL="file:./prod.db"
   # ... add other variables
   ```

5. **Deploy**:
   ```bash
   railway up
   ```

6. **Create Domain**:
   ```bash
   railway domain
   ```

---

### Option 3: Docker Deployment

For self-hosting or cloud providers that support Docker.

#### Dockerfile

Create a `Dockerfile`:

```dockerfile
# Base image
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npx prisma generate
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: plus-one
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./data/prod.db
    env_file:
      - .env
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### Deploy with Docker:

```bash
# Build and run
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

### Option 4: AWS / EC2

For AWS deployment using EC2 with PM2.

#### Steps:

1. **Create EC2 Instance** (Ubuntu 22.04 LTS)

2. **Install Dependencies**:
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm nginx
   ```

3. **Install PM2**:
   ```bash
   sudo npm i -g pm2
   ```

4. **Clone and Build**:
   ```bash
   git clone your-repo-url
   cd plus-one
   npm install
   npx prisma generate
   npm run build
   ```

5. **Create PM2 Config** (`ecosystem.config.js`):
   ```javascript
   module.exports = {
     apps: [{
       name: 'plus-one',
       script: 'node_modules/.bin/next',
       args: 'start',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000,
       },
       log_file: './logs/combined.log',
       out_file: './logs/out.log',
       error_file: './logs/error.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
     }],
   };
   ```

6. **Start with PM2**:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

7. **Configure Nginx**:
   ```bash
   sudo nano /etc/nginx/sites-available/plus-one
   ```

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

8. **Enable Site**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/plus-one /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

9. **Setup SSL with Certbot**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## Post-Deployment Verification

### 1. Health Check

Test the health endpoint:

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected",
  "environment": "production"
}
```

### 2. Test Key Features

- [ ] Sign up as a new client
- [ ] Browse companions
- [ ] Send messages (check 8-message limit for free users)
- [ ] Create a booking
- [ ] Test Razorpay payment flow
- [ ] Check email notifications

### 3. Performance Check

Use Lighthouse in Chrome DevTools to verify:
- Performance score > 90
- Accessibility score > 90
- Best Practices score > 90
- SEO score > 90

### 4. Security Headers

Verify headers are set:

```bash
curl -I https://your-domain.com
```

Check for:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`

---

## Monitoring & Maintenance

### Logs

**Vercel**: Check logs in the dashboard

**Railway**: `railway logs`

**Docker**: `docker-compose logs -f`

**PM2**: `pm2 logs`

### Database Backups

For SQLite:

```bash
# Create backup
cp data/prod.db backups/prod-$(date +%Y%m%d).db

# Automated backup script
crontab -e
# Add: 0 2 * * * cp /app/data/prod.db /backups/prod-$(date +\%Y\%m\%d).db
```

### Updates

To update the application:

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Build
npm run build

# Restart (for PM2)
pm2 restart plus-one

# Or redeploy (for Vercel/Railway)
vercel --prod
# or
railway up
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check if database file exists
ls -la data/

# Fix permissions
chmod 666 data/prod.db
```

### Build Errors

```bash
# Clean build cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### Memory Issues

For low-memory servers:

```bash
# Reduce Node memory usage
NODE_OPTIONS="--max-old-space-size=1024" npm run build
```

---

## Support

For issues:
1. Check logs: `pm2 logs` or `docker-compose logs`
2. Test health endpoint: `/api/health`
3. Review environment variables
4. Check database connectivity

---

**Happy deploying!**
