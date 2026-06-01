# ClipCash

**Turn your long videos into short viral clips — automatically, with full control, and optional NFT ownership.**

ClipCash helps content creators (YouTubers, podcasters, gamers, coaches…) save many hours of work by turning one long video into dozens or hundreds of short clips ready for TikTok, Instagram Reels, YouTube Shorts, and more.

You always stay in control:  
→ Preview every clip  
→ Choose which ones you like  
→ Delete the bad ones  
→ Then post only the good ones automatically

**Bonus: you can also turn your best clips into NFTs on the Stellar network (very cheap & fast) so you truly own them and can earn royalties forever.**

## What makes ClipCash special?

- **Full preview & selection** — most tools post random clips. ClipCash lets you see and pick only the best ones.
- **Automatic posting** to 7+ platforms (TikTok, Instagram, YouTube Shorts, Facebook Reels, Snapchat Spotlight, Pinterest, LinkedIn)
- **Web2 + Web3 in one app** — normal accounts + optional Stellar NFTs with royalties
- **Simple & beautiful interface** — dark mode, clean design, easy to use

## Main Features (MVP – 2026)

- Upload long video or paste YouTube/TikTok link
- AI creates 50–200 short clips (15–60 seconds each)
- Preview screen: watch short previews, select / deselect / bulk delete
- One-click post selected clips to multiple platforms
- Earnings dashboard (shows money from all platforms)
- Optional: mint selected clips as NFTs on Stellar (Soroban smart contracts)
- Subscription plans + small revenue share (we take 5–10% only if you want)

## Tech Stack – Simple Overview

| Part           | Technology                          | Why we chose it                     |
| -------------- | ----------------------------------- | ----------------------------------- |
| Frontend       | Next.js 15 + React + Tailwind       | Fast, beautiful, mobile-friendly    |
| Backend        | NestJS (TypeScript)                 | Clean, organized, easy to grow      |
| Database       | PostgreSQL (via Supabase or Prisma) | Reliable & real-time updates        |
| Queue / Jobs   | BullMQ + Redis                      | Handles long AI & posting tasks     |
| Social Posting | Ayrshare                            | One tool posts to all platforms     |
| Blockchain     | Stellar Soroban (Rust)              | Very cheap fees, built-in royalties |
| AI             | Runway Gen-3 + Claude               | Finds the most viral moments        |

## Project Folders (very simple view)

clipcash/
├── backend/ ← The API server (NestJS)
├── frontend/ ← The website users see (Next.js)
├── contracts/ ← Stellar smart contracts (Rust)
├── docker-compose.yml ← Easy local setup (database + redis)
└── README.md ← You are reading it right now 😄

## Quick Start (Local Development)

### 1. Requirements

- Node.js 18 or newer
- Docker (recommended for database & redis)
- Git

### 2. Clone & install

```bash
git clone https://github.com/your-username/clipcash.git
cd clipcash
```

### 3. Start everything with Docker (easiest)

```bash
docker-compose up -d
```

This starts: PostgreSQL, Redis, Backend, and Frontend.

### 4. Or start manually

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

**Frontend:**
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

### Important Environment Variables

See `.env.example` files in `backend/` and `frontend/` folders. Most important ones:

```env
# Backend
DATABASE_URL=postgresql://...
AYRSHARE_API_KEY=your-ayrshare-key
STELLAR_NETWORK=testnet

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STELLAR_RPC=https://soroban-testnet.stellar.org
```

## Stellar Wallet Setup

ClipCash uses the **Stellar network** for optional NFT minting of your best clips. Stellar offers very low fees (~$0.00001 per transaction) and fast finality (~5 seconds).

### Supported Wallets

| Wallet | Type | Platform | Download |
|--------|------|----------|----------|
| **Freighter** | Browser extension | Chrome, Firefox, Brave | [freighter.app](https://freighter.app) |
| **Lobstr** | Mobile + Web | iOS, Android, Web | [lobstr.co](https://lobstr.co) |
| **Albedo** | Web-based (no install) | Any browser | [albedo.link](https://albedo.link) |

> **Recommended:** Freighter — it's the most developer-friendly and integrates directly with Soroban smart contracts.

### 1. Install Freighter

1. Go to [freighter.app](https://freighter.app) and install the browser extension.
2. Create a new wallet and **save your 12-word recovery phrase** somewhere safe.
3. Switch to **Testnet** for development (Settings → Network → Testnet).

### 2. Fund Your Testnet Wallet

You need a small amount of XLM to pay transaction fees. On testnet, get free XLM from the Stellar Friendbot:

```bash
curl "https://friendbot.stellar.org?addr=YOUR_STELLAR_ADDRESS"
```

Or visit: https://laboratory.stellar.org/#account-creator?network=test

For mainnet, purchase XLM on any major exchange (Coinbase, Binance, Kraken) and send it to your Freighter address. You only need ~1 XLM to cover fees for hundreds of NFT mints.

### 3. Connect Your Wallet in ClipCash

1. Open ClipCash and go to **Dashboard → Wallet Integration**.
2. Click **Connect Freighter** (or your preferred wallet).
3. Approve the connection request in the wallet popup.
4. Your wallet address will appear — you're ready to mint NFTs.

### 4. Mint a Clip as an NFT

1. Go to your **Clip Library** and select a clip.
2. Click **Mint as NFT**.
3. Review the details (title, royalty %, network fee).
4. Confirm the transaction in your Freighter wallet.
5. Your clip is now an NFT on Stellar — you own it forever and earn royalties on every resale.

### Environment Variables for Stellar

```bash
# Frontend (.env.local)
NEXT_PUBLIC_STELLAR_NETWORK=testnet                          # or "mainnet"
NEXT_PUBLIC_STELLAR_RPC=https://soroban-testnet.stellar.org  # testnet RPC
# NEXT_PUBLIC_STELLAR_RPC=https://soroban-rpc.mainnet.stellar.gateway.fm  # mainnet

# Backend (.env)
STELLAR_NETWORK=testnet
STELLAR_SECRET_KEY=S...          # Server keypair for contract deployment (never commit this)
SOROBAN_CONTRACT_ID=C...         # Deployed NFT contract address
```

### Testnet vs Mainnet

| | Testnet | Mainnet |
|---|---------|---------|
| Cost | Free (Friendbot) | Real XLM (~$0.00001/tx) |
| Purpose | Development & testing | Production |
| RPC | `soroban-testnet.stellar.org` | `soroban-rpc.mainnet.stellar.gateway.fm` |
| Explorer | [stellar.expert/testnet](https://stellar.expert/explorer/testnet) | [stellar.expert](https://stellar.expert/explorer/public) |

### Troubleshooting

**"Freighter not detected"** — Make sure the extension is installed and the page is refreshed. Freighter must be unlocked (enter your password) before connecting.

**"Insufficient balance"** — You need at least 1 XLM in your wallet. On testnet, use Friendbot. On mainnet, send XLM from an exchange.

**"Transaction rejected"** — You manually declined in the wallet popup, or the network fee changed. Try again and confirm in Freighter.

**"Wrong network"** — Open Freighter → Settings → Network and make sure it matches `NEXT_PUBLIC_STELLAR_NETWORK` in your `.env.local`.
