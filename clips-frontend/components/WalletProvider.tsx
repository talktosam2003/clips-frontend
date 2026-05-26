"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// EIP-1193 provider type (window.ethereum)
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export type WalletType = "metamask" | "phantom";

export interface WalletState {
  address: string | null;
  chainId: string | null;
  walletType: WalletType | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface WalletContextType extends WalletState {
  connectMetaMask: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

const STORAGE_KEY = "clipcash_wallet";

/**
 * Allowed chain IDs.
 * 0x1 = Ethereum Mainnet, 0xaa36a7 = Sepolia testnet.
 * Extend this set when adding support for other networks.
 */
const ALLOWED_CHAIN_IDS = new Set(["0x1", "0xaa36a7"]);

/** Validate an Ethereum address: 0x followed by exactly 40 hex characters. */
function isValidEthAddress(address: unknown): address is string {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Validate a chainId: must be a hex string like "0x1". */
function isValidChainId(chainId: unknown): chainId is string {
  return typeof chainId === "string" && /^0x[0-9a-fA-F]+$/.test(chainId);
}

/** Wrap a promise with a timeout to prevent indefinite UI hangs. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

const defaultState: WalletState = {
  address: null,
  chainId: null,
  walletType: null,
  isConnected: false,
  isConnecting: false,
  error: null,
};

const WalletContext = createContext<WalletContextType>({
  ...defaultState,
  connectMetaMask: async () => {},
  disconnect: () => {},
  clearError: () => {},
});

export const useWallet = () => useContext(WalletContext);

/** Truncate a wallet address for display: 0x1234...5678 */
export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>(defaultState);

  // Restore persisted session on mount.
  // sessionStorage is used instead of localStorage so the session is cleared
  // when the browser tab is closed, reducing the window for session hijacking.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Partial<WalletState> = JSON.parse(stored);
        // Validate address and walletType before trusting stored data.
        // Reject anything that doesn't look like a real Ethereum address.
        if (
          isValidEthAddress(parsed.address) &&
          (parsed.walletType === "metamask" || parsed.walletType === "phantom")
        ) {
          setState((prev) => ({
            ...prev,
            address: parsed.address!,
            chainId: isValidChainId(parsed.chainId) ? parsed.chainId : null,
            walletType: parsed.walletType!,
            isConnected: true,
          }));
        } else {
          // Stored data is invalid or tampered — clear it
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // Malformed JSON — clear it
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Listen for MetaMask account / chain changes
  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      // Runtime type guard — never trust provider data blindly
      if (!Array.isArray(accounts) || !accounts.every((a) => typeof a === "string")) return;
      const accs = accounts as string[];
      if (accs.length === 0) {
        // User disconnected from MetaMask side
        handleDisconnect();
      } else {
        const address = accs[0];
        // Validate address format before persisting
        if (!isValidEthAddress(address)) return;
        setState((prev) => ({ ...prev, address }));
        persistSession({ address, chainId: state.chainId, walletType: "metamask" });
      }
    };

    const handleChainChanged = (chainId: unknown) => {
      if (!isValidChainId(chainId)) return;
      // If the user switches to an unsupported network, disconnect
      if (!ALLOWED_CHAIN_IDS.has(chainId)) {
        handleDisconnect();
        setState((prev) => ({
          ...prev,
          error: "Unsupported network. Please switch to Ethereum Mainnet or Sepolia.",
        }));
        return;
      }
      setState((prev) => ({ ...prev, chainId }));
      persistSession({ address: state.address, chainId, walletType: state.walletType });
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.address, state.chainId, state.walletType]);

  function persistSession(data: { address: string | null; chainId: string | null; walletType: WalletType | null }) {
    if (data.address) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  function handleDisconnect() {
    setState({ ...defaultState });
    sessionStorage.removeItem(STORAGE_KEY);
  }

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum || !window.ethereum.isMetaMask) {
      setState((prev) => ({
        ...prev,
        error: "MetaMask is not installed. Please install the MetaMask browser extension.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Request accounts with a 30-second timeout to prevent UI freeze
      const rawAccounts = await withTimeout(
        window.ethereum.request({ method: "eth_requestAccounts" }),
        30_000,
        "eth_requestAccounts"
      );

      // Runtime type guard — never trust the provider blindly
      if (!Array.isArray(rawAccounts) || !rawAccounts.every((a) => typeof a === "string")) {
        throw new Error("Unexpected response from wallet provider.");
      }
      const accounts = rawAccounts as string[];

      if (accounts.length === 0) {
        throw new Error("No accounts returned. Please unlock MetaMask and try again.");
      }

      const address = accounts[0];

      // Validate the address format before storing it
      if (!isValidEthAddress(address)) {
        throw new Error("Wallet returned an invalid address. Please try again.");
      }

      const rawChainId = await withTimeout(
        window.ethereum.request({ method: "eth_chainId" }),
        10_000,
        "eth_chainId"
      );

      if (!isValidChainId(rawChainId)) {
        throw new Error("Unexpected chain ID format from wallet provider.");
      }
      const chainId = rawChainId;

      // Enforce network allowlist
      if (!ALLOWED_CHAIN_IDS.has(chainId)) {
        throw new Error(
          "Unsupported network. Please switch MetaMask to Ethereum Mainnet or Sepolia."
        );
      }

      setState({
        address,
        chainId,
        walletType: "metamask",
        isConnected: true,
        isConnecting: false,
        error: null,
      });

      persistSession({ address, chainId, walletType: "metamask" });
    } catch (err: unknown) {
      const message =
        (err as { code?: number; message?: string })?.code === 4001
          ? "Connection rejected. Please approve the request in MetaMask."
          : (err as Error)?.message ?? "Failed to connect wallet. Please try again.";

      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    handleDisconnect();
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <WalletContext.Provider
      value={{ ...state, connectMetaMask, disconnect, clearError }}
    >
      {children}
    </WalletContext.Provider>
  );
}
