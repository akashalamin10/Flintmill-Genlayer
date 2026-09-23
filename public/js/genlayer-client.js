import { NETWORK, SDK, getContractAddress } from "./config.js";
import { showBusy, hideBusy, setBusyMessage } from "./ui.js";

let sdk = null;
let chains = null;

export async function loadSdk() {
  if (sdk) return sdk;
  const version = SDK.genlayerJs;
  const mod = await import(`https://esm.sh/genlayer-js@${version}?bundle`);
  let chainMod = {};
  try {
    chainMod = await import(`https://esm.sh/genlayer-js@${version}/chains?bundle`);
  } catch {
    chainMod = mod;
  }
  sdk = { ...mod, chains: chainMod };
  chains = chainMod;
  return sdk;
}

export function getStudioChain() {
  const fromSdk = chains?.studioDevnet || chains?.studioNext || null;
  const base = fromSdk && Number(fromSdk.id) === NETWORK.chainId ? fromSdk : null;
  return {
    ...(base || {}),
    id: NETWORK.chainId,
    name: NETWORK.name,
    rpcUrls: { default: { http: [NETWORK.rpc] } },
    nativeCurrency: NETWORK.currency,
    blockExplorers: { default: { name: "Studio Next Explorer", url: NETWORK.explorer } },
  };
}

let readClientPromise = null;

export function resetReadClient() {
  readClientPromise = null;
}

export async function createReadClient() {
  if (readClientPromise) return readClientPromise;
  const pending = (async () => {
    const { createClient, createAccount } = await loadSdk();
    const chain = getStudioChain();
    const account = typeof createAccount === "function" ? createAccount() : null;
    return createClient({
      chain,
      endpoint: NETWORK.rpc,
      account: account?.address ? account : undefined,
    });
  })();
  readClientPromise = pending;
  try {
    return await pending;
  } catch (error) {
    if (readClientPromise === pending) readClientPromise = null;
    throw error;
  }
}

export async function createWriteClient(address) {
  const { createClient } = await loadSdk();
  const chain = getStudioChain();
  const { getActiveProvider } = await import("./wallet.js");
  const provider = getActiveProvider() || (typeof window !== "undefined" ? window.ethereum : null);
  if (!provider) throw new Error("No wallet connected. Connect a wallet first.");
  return createClient({
    chain,
    endpoint: NETWORK.rpc,
    account: address,
    provider,
  });
}

const CONNECT_ALIAS_KEY = "flintmill.sdk.connectAlias";
const FEE_FN_KEY = "flintmill.sdk.feeFn";
const WAIT_FN_KEY = "flintmill.sdk.waitFn";

export async function connectClient(client) {
  if (typeof client.connect !== "function") return;
  const cached = sessionStorage.getItem(CONNECT_ALIAS_KEY);
  const names = cached
    ? [cached, NETWORK.connectName, "studio-next", "studio-dev", "studioDevnet"]
    : [NETWORK.connectName, "studio-next", "studio-dev", "studioDevnet"];
  const seen = new Set();
  for (const name of names) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    try {
      await client.connect(name);
      sessionStorage.setItem(CONNECT_ALIAS_KEY, name);
      return;
    } catch {
      /* try next alias */
    }
  }
  sessionStorage.removeItem(CONNECT_ALIAS_KEY);
}

async function attachFees(client, write) {
  const cached = sessionStorage.getItem(FEE_FN_KEY);
  const estimateFns = cached
    ? [cached, "estimateTransactionFeesForWrite", "estimateTransactionFees"]
    : ["estimateTransactionFeesForWrite", "estimateTransactionFees"];
  const seen = new Set();
  for (const fn of estimateFns) {
    if (!fn || seen.has(fn) || typeof client[fn] !== "function") continue;
    seen.add(fn);
    try {
      const estimate = await client[fn](write);
      if (estimate?.distribution && estimate?.feeValue != null) {
        sessionStorage.setItem(FEE_FN_KEY, fn);
        return { ...write, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } };
      }
    } catch (error) {
      console.warn("Fee estimate skipped:", error?.message || error);
    }
  }
  return write;
}

async function waitForTx(client, hash) {
  if (!hash) return null;
  const cached = sessionStorage.getItem(WAIT_FN_KEY);
  const fns = cached
    ? [cached, "waitForDecision", "waitForTransactionReceipt", "waitForFinalization"]
    : ["waitForDecision", "waitForTransactionReceipt", "waitForFinalization"];
  const seen = new Set();
  for (const fn of fns) {
    if (!fn || seen.has(fn) || typeof client[fn] !== "function") continue;
    seen.add(fn);
    try {
      const result = await client[fn]({ hash });
      sessionStorage.setItem(WAIT_FN_KEY, fn);
      return result;
    } catch (error) {
      console.warn(`${fn}:`, error?.message || error);
    }
  }
  sessionStorage.removeItem(WAIT_FN_KEY);
  return { hash };
}

function isRateLimitError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label = "request") {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

const MAX_CONCURRENT_READS = 4;

export async function mapWithLimit(items, fn, limit = MAX_CONCURRENT_READS) {
  const list = Array.from(items || []);
  const results = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      results[i] = await fn(list[i], i);
    }
  }
  const workers = Math.min(limit, list.length);
  if (!workers) return [];
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

async function withRateLimitBackoff(fn, { attempts = 3, baseDelay = 800 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || i === attempts - 1) throw error;
      const jitter = Math.random() * 250;
      await sleep(baseDelay * 2 ** i + jitter);
    }
  }
  throw lastError;
}

export function requireContract() {
  const address = getContractAddress();
  if (!address) {
    throw new Error("Set the deployed Studio Next contract address first (Setup page).");
  }
  return address;
}

export async function readContract(functionName, args = []) {
  const address = requireContract();
  return withRateLimitBackoff(async () => {
    const client = await createReadClient();
    return withTimeout(
      client.readContract({ address, functionName, args }),
      20000,
      functionName
    );
  });
}

export async function writeContract(functionName, args, account, value) {
  showBusy("Waiting for wallet and network\u2026");
  try {
    const client = await createWriteClient(account);
    await connectClient(client);
    const address = requireContract();
    const write = { address, functionName, args };
    if (value != null) write.value = BigInt(value);
    setBusyMessage("Confirm the transaction in your wallet\u2026");
    const withFees = await attachFees(client, write);
    const hash = await client.writeContract(withFees);
    setBusyMessage("Waiting for the transaction to finalize\u2026");
    const receipt = await waitForTx(client, hash);
    return { hash, receipt };
  } finally {
    hideBusy();
  }
}

function parseObject(result) {
  if (result == null || result === "") return null;
  let data = result;
  if (typeof result === "string") {
    try {
      data = JSON.parse(result);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data) && data.length === 0) return null;
  if (!Array.isArray(data) && Object.keys(data).length === 0) return null;
  return data;
}

export async function getFlint(flintId) {
  if (flintId == null || flintId === "") return null;
  const result = await readContract("get_flint", [String(flintId)]);
  return parseObject(result);
}


export async function getCredit(address) {
  const raw = String(address || "").trim();
  const variants = [raw, raw.toLowerCase()].filter((value, index, all) => value && all.indexOf(value) === index);
  let best = 0;
  for (const candidate of variants) {
    const result = await readContract("get_credit", [candidate]).catch(() => 0);
    const value = Number(result || 0);
    if (Number.isFinite(value) && value > best) best = value;
  }
  return best;
}

function parseIdList(result) {
  if (result == null || result === "") return [];
  if (Array.isArray(result)) return result.map(String).filter(Boolean);
  if (typeof result === "string") {
    const trimmed = result.trim();
    if (!trimmed || trimmed === "[]") return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return trimmed ? [trimmed] : [];
    }
  }
  if (typeof result === "object") return Object.keys(result).filter(Boolean);
  return [];
}

export async function listFlints() {
  const result = await withTimeout(readContract("list_flints", []), 12000, "list_flints");
  if (result == null || result === "") {
    throw new Error("list_flints returned empty");
  }
  let data = result;
  if (typeof result === "string") {
    const trimmed = result.trim();
    if (!trimmed || trimmed === "[]") return {};
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error("list_flints returned non-JSON");
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("list_flints returned unexpected shape");
  }
  return data;
}


export async function listFlintIds() {
  const result = await readContract("list_flint_ids", []);
  return parseIdList(result);
}


function mergeIds(primary, extra) {
  const out = [];
  const seen = new Set();
  for (const raw of [...(primary || []), ...(extra || [])]) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function rowsFromMap(all) {
  if (!all || typeof all !== "object") return [];
  return Object.entries(all)
    .filter(([, flint]) => flint && typeof flint === "object" && Object.keys(flint).length)
    .map(([id, flint]) => ({ id: String(id), flint, bounty: flint }));
}

export async function fetchAllFlintRows(extraIds = []) {
  let batched = null;
  try {
    batched = await listFlints();
  } catch (error) {
    console.warn("list_flints unavailable, using per-flint reads:", error?.message || error);
  }

  const batchedRows = rowsFromMap(batched);
  const batchedIds = batchedRows.map((row) => row.id);

  let chainIds = [];
  try {
    chainIds = await listFlintIds();
  } catch (error) {
    console.warn("list_flint_ids failed:", error?.message || error);
  }

  const ids = mergeIds(batchedIds, mergeIds(chainIds, extraIds));
  if (!ids.length) return batchedRows;

  const byId = new Map(batchedRows.map((row) => [row.id, row]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    const fetched = await mapWithLimit(missing, async (id) => {
      const flint = await getFlint(id).catch(() => null);
      return flint ? { id, flint, bounty: flint } : null;
    });
    for (const row of fetched) {
      if (row) byId.set(row.id, row);
    }
  }

  return ids.map((id) => byId.get(id)).filter(Boolean);
}

