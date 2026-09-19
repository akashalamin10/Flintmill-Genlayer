export const NETWORK = {
  name: "GenLayer Studio Next",
  connectName: "studioDevnet",
  chainId: 61997,
  chainIdHex: "0xf22d",
  currency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpc: "https://studio-next.genlayer.com/api",
  rpcFallback: "https://studio-dev.genlayer.com/api",
  explorer: "https://explorer-studio-next.genlayer.com",
  explorerFallback: "https://explorer-studio-dev.genlayer.com",
  studioUrl: "https://studio-next.genlayer.com",
};

export const SDK = {
  genlayerJs: "2.0.0-rc.1",
  transactionKit: "0.1.0-rc.2",
};

export const WALLETCONNECT_PROJECT_ID = (window.FLINTMILL_WALLETCONNECT_PROJECT_ID || "").trim();

export const APP_METADATA = {
  studioChainId: NETWORK.chainId,
  wc: {
    name: "Flintmill",
    description: "Incident-reproduction bounties judged by GenLayer validator consensus.",
    url: typeof location !== "undefined" ? location.origin : "https://flintmill.example",
    icons: typeof location !== "undefined" ? [`${location.origin}/assets/images/logo.svg`] : [],
  },
};

const DEFAULT_CONTRACT_ADDRESS = "";
const ZERO = "0x0000000000000000000000000000000000000000";
const STORAGE_KEY = "flintmill.contractAddress";

export function getContractAddress() {
  const stored = (localStorage.getItem(STORAGE_KEY) || "").trim();
  if (stored && stored !== ZERO) return stored;
  const baked = (window.FLINTMILL_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS || "").trim();
  if (baked && baked !== ZERO) return baked;
  return "";
}

export function setContractAddress(address) {
  const value = (address || "").trim();
  const prev = getContractAddress();
  if (!value) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, value);
  if (value !== prev) {
    try {
      const drop = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("flintmill.cache.")) drop.push(key);
      }
      drop.forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem("flintmill.flintIds");
    } catch {
      /* ignore */
    }
  }
}

export function explorerTx(hash) {
  if (!hash) return NETWORK.explorer;
  return `${NETWORK.explorer}/tx/${hash}`;
}

export function explorerAddress(address) {
  if (!address) return NETWORK.explorer;
  return `${NETWORK.explorer}/address/${address}`;
}
