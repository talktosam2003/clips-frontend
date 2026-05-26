// This file replaces the backend server by mocking the needed endpoints client-side with simulated latency.

export type User = {
  id: string;
  email: string;
  name?: string;
  username?: string;
  onboardingStep: number;
  profile?: Record<string, unknown>;
};

// Passwords are kept only in the in-memory store, never exposed on the User type
type UserRecord = User & { passwordHash: string };

// In-memory fake database — passwords never leave this array
const users: UserRecord[] = [];

/** Naive hash for the mock environment (never use in production). */
function mockHash(password: string): string {
  // Simple deterministic obfuscation so plain-text is never stored even in mock
  return btoa(encodeURIComponent(password));
}

function mockVerify(password: string, hash: string): boolean {
  return mockHash(password) === hash;
}

/** Strip the passwordHash before returning a User to callers. */
function toPublicUser(record: UserRecord): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _ph, ...publicUser } = record;
  return publicUser;
}

// Helper to simulate network latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface Summary {
  total: string;
  completed: string;
  pending: string;
}

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  cryptoAmount?: number;
  cryptoCurrency?: 'ETH' | 'SOL' | 'USDC';
  platform: 'YouTube' | 'TikTok' | 'Instagram' | 'Twitch';
  type: 'payout' | 'royalty' | 'mint' | 'referral';
  status: 'completed' | 'pending' | 'failed';
  taxId: string;
};

export const MockApi = {
  /**
   * Check if a user with the given email exists
   */
  checkEmail: async (email: string) => {
    await delay(600); // Simulate network latency
    const user = users.find(u => u.email === email);
    return { exists: !!user };
  },

  /**
   * Login an existing user
   */
  login: async (email: string, password?: string) => {
    await delay(800);
    const record = users.find(u => u.email === email);
    
    // Use a constant-time-like check to avoid timing-based email enumeration
    const passwordValid = record && password ? mockVerify(password, record.passwordHash) : false;
    if (!record || !passwordValid) {
      throw new Error("Invalid credentials");
    }

    // Mock generic token
    const token = `fake-jwt-token-${record.id}`;
    
    return { token, user: toPublicUser(record) };
  },

  /**
   * Signup a new user
   */
  signup: async (email: string, password?: string, name?: string) => {
    await delay(800);
    
    if (users.find(u => u.email === email)) {
      throw new Error("User already exists");
    }

    const newRecord: UserRecord = {
      id: Date.now().toString(),
      email,
      passwordHash: password ? mockHash(password) : "",
      name: name || email.split('@')[0],
      onboardingStep: 1,
      profile: {}
    };

    users.push(newRecord);
    
    const token = `fake-jwt-token-${newRecord.id}`;
    return { token, user: toPublicUser(newRecord) };
  },

  /**
   * Simulate minting an NFT collection — randomly fails to test error handling
   */
  mintCollection: async (data: { collectionName: string; description: string; creatorRoyalty: string; listingPrice: string }) => {
    await delay(1800);

    // Simulate random failure scenarios
    const roll = Math.random();
    if (roll < 0.25) throw new Error("WALLET_REJECTED");
    if (roll < 0.4) throw new Error("NETWORK_ERROR");
    if (roll < 0.5) throw new Error("UPLOAD_FAILED");

    return { success: true, txHash: `0x${Math.random().toString(16).slice(2, 18)}`, collection: data.collectionName };
  },

  /**
   * Simulate posting clips to platforms
   */
  postClips: async (clipIds: string[]) => {
    await delay(1400);

    const roll = Math.random();
    if (roll < 0.2) throw new Error("NETWORK_ERROR");
    if (roll < 0.3) throw new Error("PLATFORM_AUTH_EXPIRED");

    return { success: true, posted: clipIds.length };
  },

  saveOnboarding: async (userId: string, step: number, data: Record<string, unknown>) => {
    await delay(500); // Usually faster for background auto-save
    
    let record: UserRecord | undefined = users.find(u => u.id === userId);
    
    // Auto-recover lost memory db from localStorage on page refresh/HMR
    if (!record && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("clipcash_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          // Validate shape before trusting the stored value
          if (
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.id === "string" &&
            typeof parsed.email === "string" &&
            parsed.id === userId
          ) {
            // Re-hydrate as a record without a real hash (mock only)
            record = { ...(parsed as User), passwordHash: "" };
            users.push(record);
          }
        }
      } catch {
        // Malformed JSON in localStorage — ignore and continue
      }
    }

    if (!record) throw new Error("User not found");

    record.onboardingStep = step;
    record.profile = { ...record.profile, ...data };
    
    return { success: true, user: toPublicUser(record) };
  },

  /**
   * Get earnings report / transaction history for tax purposes
   */
  getEarningsReport: async (userId: string) => {
    await delay(1000 + Math.random() * 500); // Variable latency for realism
    
    // Mock 50+ transactions totaling ~$12,450 matching dashboard
    const baseTransactions: Omit<Transaction, 'id'>[] = [
      { date: '2024-10-15', description: 'YouTube Shorts payout #47', amount: 245.80, platform: 'YouTube', status: 'completed', taxId: 'TX-001' },
      { date: '2024-10-12', description: 'TikTok viral clips batch', amount: 189.50, platform: 'TikTok', status: 'completed', taxId: 'TX-002' },
      { date: '2024-10-10', description: 'Instagram Reels monetization', amount: 156.20, platform: 'Instagram', status: 'completed', taxId: 'TX-003' },
      { date: '2024-10-08', description: 'Twitch highlights payout', amount: 98.75, platform: 'Twitch', status: 'pending', taxId: 'TX-004' },
      // ... more data to sum ~$12k
    ];
    
    // Generate 50+ varied transactions
    const transactions: Transaction[] = [];
    const platforms = ['YouTube', 'TikTok', 'Instagram', 'Twitch'] as const;
    const types = ['payout', 'royalty', 'mint', 'referral'] as const;
    const cryptoCurrencies = ['ETH', 'SOL', 'USDC'] as const;
    
    let totalAmount = 0;
    for (let i = 0; i < 55; i++) {
      const platform = platforms[Math.floor(Math.random() * platforms.length)] as Transaction['platform'];
      const type = types[i % types.length] as Transaction['type'];
      const status = i % 7 === 0 ? 'pending' : (i % 17 === 0 ? 'failed' : 'completed');
      const amount = parseFloat((10 + Math.random() * 300).toFixed(2));
      const date = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hasCrypto = type === 'mint' || type === 'royalty';
      
      const tx: Transaction = {
        id: `TX-${String(i + 1).padStart(5, '0')}`,
        date,
        description: `${platform} ${type} #${i + 1}`,
        amount,
        ...(hasCrypto && {
          cryptoAmount: parseFloat((amount / 2000 + Math.random() * 0.05).toFixed(4)),
          cryptoCurrency: cryptoCurrencies[i % cryptoCurrencies.length],
        }),
        platform,
        type,
        status,
        taxId: `TAX-${String(i + 1).padStart(3, '0')}`,
      };
      
      transactions.push(tx);
      totalAmount += tx.amount;
    }
    
    return {
      transactions,
      summary: {
        total: totalAmount.toFixed(2),
        completed: transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0).toFixed(2),
        pending: transactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0).toFixed(2),
      }
    };
  }
};
