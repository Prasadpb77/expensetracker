# 💰 FamilyFinance — Personal Expense Tracker for Couples

A modern, full-featured expense management web app built for married couples.
Track income, expenses, budgets, and savings together — deployed entirely on **free tiers**.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Backend | Supabase (Auth + PostgreSQL + RLS) |
| Hosting | GitHub Pages |

---

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/           # Button, Card, Input, Modal, Toast, Badge, Skeleton, StatCard
│   ├── layout/       # Sidebar, Layout, ProtectedRoute
│   ├── charts/       # IncomeExpenseChart, CategoryPieChart, SavingsTrendChart
│   └── forms/        # IncomeForm, ExpenseForm
├── pages/
│   ├── auth/         # LoginPage, RegisterPage, ForgotPasswordPage
│   ├── dashboard/    # DashboardPage
│   ├── income/       # IncomePage
│   ├── expenses/     # ExpensesPage
│   ├── budget/       # BudgetPage
│   ├── reports/      # ReportsPage
│   └── settings/     # SettingsPage
├── hooks/            # (extend as needed)
├── services/         # auth, profile, income, expense, budget
├── contexts/         # AuthContext, store (Zustand)
├── types/            # index.ts (all TypeScript types)
├── utils/            # index.ts (formatting, helpers, CSV export)
└── lib/              # supabase.ts
```

---

## ✅ Step-by-Step Setup

### STEP 1 — Clone or Create the Repository

```bash
# Option A: Create from scratch
mkdir expense-tracker && cd expense-tracker
git init

# Option B: Clone if you already have a repo
git clone https://github.com/YOUR_USERNAME/expense-tracker.git
cd expense-tracker
```

---

### STEP 2 — Install Dependencies

```bash
npm install
```

---

### STEP 3 — Set Up Supabase

#### 3a. Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Name it `expense-tracker`, choose a region close to India (e.g. **ap-south-1** Singapore)
4. Set a strong database password and save it
5. Wait ~2 minutes for the project to boot

#### 3b. Run the SQL Schema
1. In your Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste it and click **Run** (▶️)
5. You should see: "Success. No rows returned"

#### 3c. Enable Email Auth
1. Go to **Authentication → Providers**
2. Ensure **Email** is enabled
3. (Optional) Turn off "Confirm email" for development

#### 3d. Get Your API Keys
1. Go to **Project Settings → API**
2. Copy:
   - **Project URL** → e.g. `https://abcdefgh.supabase.co`
   - **anon / public key** → long JWT string

---

### STEP 4 — Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit it with your Supabase credentials
nano .env   # or use any text editor
```

Your `.env` should look like:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### STEP 5 — Update Vite Base Path

In `vite.config.ts`, set `base` to your **GitHub repository name**:

```ts
export default defineConfig({
  base: '/expense-tracker/',   // ← change to your repo name
  ...
})
```

Also update `src/App.tsx`:
```tsx
<BrowserRouter basename="/expense-tracker">  // ← same repo name
```

---

### STEP 6 — Run Locally

```bash
npm run dev
```

Open [http://localhost:5173/expense-tracker/](http://localhost:5173/expense-tracker/)

---

### STEP 7 — First-Time App Setup

1. **Register** an account (Prasad)
2. Go to **Settings**
3. Click **"Create Family"** → give it a name (e.g. "Prasad & Priya")
4. Copy the **Invite Code** shown
5. Register a **second account** (Priya / your spouse)
6. Go to **Settings** → **"Join Family"** → paste the invite code
7. Both accounts now share the same family data

---

## 🌐 Deploy to GitHub Pages

### Option A — Automatic (GitHub Actions) — RECOMMENDED

#### 8a. Push code to GitHub

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/expense-tracker.git
git push -u origin main
```

#### 8b. Add Supabase secrets to GitHub

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"** and add:
   - Name: `VITE_SUPABASE_URL` → Value: your Supabase URL
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: your anon key

#### 8c. Enable GitHub Pages

1. Go to **Settings → Pages**
2. Under **Source**, select **"GitHub Actions"**
3. Save

#### 8d. Trigger Deployment

```bash
git push origin main
```

GitHub Actions will automatically build and deploy. Check the **Actions** tab for progress.

Your app will be live at:
```
https://YOUR_USERNAME.github.io/expense-tracker/
```

---

### Option B — Manual Deploy

```bash
npm install -g gh-pages
npm run build
npx gh-pages -d dist
```

---

## 🗄️ Database Schema Summary

| Table | Description |
|-------|-------------|
| `profiles` | Extends Supabase auth.users |
| `families` | Links husband and wife |
| `categories` | Expense/income categories (seeded) |
| `income` | All income records |
| `expenses` | All expense records |
| `budgets` | Monthly budget limits per category |

All tables use **Row Level Security (RLS)** — users can only access their own family's data.

---

## 🔒 Security Notes

- RLS is enabled on all tables
- Users only see data from their own family
- The anon key is safe to expose in the frontend (Supabase is designed this way)
- Never commit `.env` to git (it's in `.gitignore`)

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page on GitHub Pages | Check `base` in `vite.config.ts` matches repo name |
| 404 on page refresh | Ensure `public/404.html` exists in repo |
| Supabase auth not working | Check URL/key in `.env`, confirm Email provider is enabled |
| "No family" on dashboard | Go to Settings and create/join a family |
| RLS errors | Re-run the SQL schema, ensure RLS policies were created |
| Charts not showing | Add at least one income and expense record |

---

## 📱 Features

- ✅ Login / Register / Forgot Password
- ✅ Dashboard with income, expense, savings cards
- ✅ Income vs Expense bar chart (6 months)
- ✅ Category pie chart with interactive legend
- ✅ Savings trend area chart
- ✅ Add / Edit / Delete Income
- ✅ Add / Edit / Delete Expenses with category, paid-by, shared flag
- ✅ Monthly budget tracking with colour-coded progress bars
- ✅ Reports with date range filters and CSV export
- ✅ Multi-user (husband + wife) with invite code
- ✅ Dark mode
- ✅ Mobile responsive
- ✅ Real-time data from Supabase

---

## 📦 npm Commands Reference

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
```

---

## 🆓 Free Tier Limits

| Service | Free Tier |
|---------|-----------|
| Supabase | 500MB DB, 1GB storage, 50K auth users |
| GitHub Pages | Unlimited static hosting |

This app runs entirely within free limits for personal use.
