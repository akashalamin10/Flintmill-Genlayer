import { NETWORK, getContractAddress, explorerAddress } from "./config.js";
import { connectWallet, getAccount, onAccountsChanged, shortAddr, disconnectWallet, getActiveWalletName } from "./wallet.js";
import { injectBackdrop, startClock, openModal } from "./fx.js";

export const BRAND_MARK = `<img class="brand-logo" src="/assets/images/logo.png" alt="Flintmill" width="36" height="36">`;

const WALLET_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3H5a2 2 0 0 1-2-2Z"/><path d="M3 9v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a1 1 0 0 0-1-1H8"/><circle cx="16.6" cy="14.5" r="1.15" fill="currentColor" stroke="none"/></svg>`;

const NAV_ITEMS = [
  { href: "/pages/mill.html", key: "mill", label: "Mill" },
  { href: "/pages/strike.html", key: "strike", label: "Strike" },
  { href: "/pages/ledger.html", key: "ledger", label: "Ledger" },
  { href: "/pages/setup.html", key: "setup", label: "Setup" },
  { href: "/pages/verify.html", key: "verify", label: "How to verify" },
];

export function pageShell({ active } = {}) {
  const address = getContractAddress();
  const links = NAV_ITEMS.map(
    (item) => `<a href="${item.href}" class="${active === item.key ? "is-active" : ""}">${item.label}</a>`
  ).join("\n");
  return `
  <header class="navbar">
    <div class="navbar-inner">
      <a href="/" class="brand">${BRAND_MARK}<span>FLINTMILL</span></a>
      <nav class="nav-links" id="navLinks">
        ${links}
        <div class="wallet-menu-wrap" id="walletMenuWrap">
          <button class="wallet-chip" id="walletBtn" type="button">
            <span class="wallet-dot" id="walletDot"></span>
            <span id="walletLabel">Connect wallet</span>
          </button>
          <div class="wallet-menu" id="walletMenu">
            <span class="mono" id="walletMenuAddr"></span>
            <button class="btn-secondary" id="walletSwitchBtn" type="button">Switch account</button>
            <button class="wallet-menu-disconnect" id="walletDisconnectBtn" type="button">Disconnect</button>
          </div>
        </div>
      </nav>
      <button class="nav-toggle" id="navToggle" type="button" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>
  <div class="net-banner">
    <span>Studio Next · chain ${NETWORK.chainId}</span>
    <span>${address ? `Contract ${shortAddr(address)}` : "Contract address not set"}</span>
    ${address ? `<a href="${explorerAddress(address)}" target="_blank" rel="noopener">View on explorer</a>` : `<a href="/pages/setup.html">Set contract address</a>`}
    <span class="net-clock" id="netClock">--:--:-- UTC</span>
  </div>`;
}

export function pageFooter() {
  return `
  <footer>
    <div class="footer-inner">
      <a href="/" class="footer-brand">${BRAND_MARK}<span>FLINTMILL</span></a>
      <div class="footer-bottom footer-credit">Developed by <a href="https://x.com/Xu22uX" target="_blank" rel="noopener">@Xu22uX</a> · Powered by GenLayer</div>
    </div>
  </footer>`;
}

export function toast(message, kind = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.dataset.kind = kind;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 4200);
}

export function requireContract() {
  if (getContractAddress()) return true;
  openModal({
    kicker: "SETUP NEEDED",
    title: "Point Flintmill at a contract first",
    body: "This page reads a Flintmill contract on Studio Next, but no contract address is saved in this browser yet.",
    confirmLabel: "Go to Setup",
    cancelLabel: "Not now",
    onConfirm() {
      location.href = "/pages/setup.html";
    },
  });
  return false;
}

export async function requireWallet(reason = "You need a connected wallet to do this.") {
  const existing = await getAccount();
  if (existing) return existing;
  return new Promise((resolve, reject) => {
    openModal({
      kicker: "WALLET NEEDED",
      title: "Connect your wallet first",
      body: reason,
      confirmLabel: "Connect wallet",
      cancelLabel: "Not now",
      async onConfirm() {
        try {
          const address = await connectWallet();
          resolve(address);
        } catch (error) {
          reject(error);
        }
      },
    });
    const overlay = document.getElementById("modal-overlay");
    const cancelBtn = document.getElementById("modalActions")?.querySelectorAll("button")[0];
    const onBail = () => reject(new Error("Wallet connection cancelled."));
    cancelBtn?.addEventListener("click", onBail, { once: true });
    overlay?.querySelector("[data-modal-close]")?.addEventListener("click", onBail, { once: true });
  });
}

export async function wireChrome() {
  injectBackdrop();
  startClock(document.getElementById("netClock"));

  if (!document.querySelector('link[rel="icon"]')) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = "/assets/images/logo.png";
    document.head.appendChild(link);
  }

  const btn = document.getElementById("walletBtn");
  const label = document.getElementById("walletLabel");
  const dot = document.getElementById("walletDot");
  const menu = document.getElementById("walletMenu");
  const menuAddr = document.getElementById("walletMenuAddr");
  const switchBtn = document.getElementById("walletSwitchBtn");
  const disconnectBtn = document.getElementById("walletDisconnectBtn");
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  let connected = false;

  if (btn && !btn.querySelector("svg")) {
    btn.insertAdjacentHTML("afterbegin", WALLET_ICON);
  }

  async function refresh() {
    const account = await getAccount();
    connected = Boolean(account);
    const walletName = getActiveWalletName();
    if (label) label.textContent = account ? `${shortAddr(account)}${walletName ? ` · ${walletName}` : ""}` : "Connect wallet";
    if (dot) dot.classList.toggle("connected", connected);
    if (menuAddr) menuAddr.textContent = account || "";
    if (menu) menu.classList.remove("open");
  }

  if (btn) {
    btn.addEventListener("click", async (event) => {
      if (connected) {
        event.stopPropagation();
        menu?.classList.toggle("open");
        return;
      }
      try {
        const account = await connectWallet();
        if (label) label.textContent = shortAddr(account);
        toast("Wallet connected on Studio Next", "ok");
        await refresh();
      } catch (error) {
        toast(error.message || String(error), "err");
      }
    });
  }
  if (switchBtn) {
    switchBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      try {
        const { switchAccount } = await import("./wallet.js");
        await switchAccount();
        toast("Account switched", "ok");
        await refresh();
      } catch (error) {
        toast(error.message || String(error), "err");
      }
    });
  }
  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      disconnectWallet();
      toast("Wallet disconnected", "info");
      await refresh();
    });
  }
  document.addEventListener("click", () => menu?.classList.remove("open"));
  window.addEventListener("flintmill:walletDisconnected", () => refresh());
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }
  onAccountsChanged(() => refresh());
  await refresh();
}

export function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("settle") || value === "ignited" || value === "approved" || value === "reproduced") return "pill ok";
  if (value.includes("reject") || value === "dead" || value === "ash") return "pill bad";
  if (value.includes("partial") || value.includes("smoulder") || value.includes("review") || value.includes("claim") || value.includes("dispute")) return "pill warn";
  return "pill";
}

const LOCAL_IDS = "flintmill.flintIds";

export function rememberFlintId(id) {
  const ids = loadLocalFlintIds();
  if (!ids.includes(id)) ids.unshift(id);
  localStorage.setItem(LOCAL_IDS, JSON.stringify(ids.slice(0, 50)));
}

export const rememberBountyId = rememberFlintId;

export function loadLocalFlintIds() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_IDS) || "[]");
  } catch {
    return [];
  }
}

export const loadLocalBountyIds = loadLocalFlintIds;

export function formValue(form, name) {
  return String(new FormData(form).get(name) || "").trim();
}

export async function withSpinner(button, task) {
  const original = button.innerHTML;
  const label = button.textContent;
  button.disabled = true;
  button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${label}</span>`;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

// --- full-screen "waiting on the wallet" overlay ---------------------
// The button spinner above only shows once a click handler is already
// running. During writeContract, the MetaMask popup itself can take a
// moment to appear (or land behind the window), and with nothing else on
// screen changing it looks like the click did nothing. This overlay gives
// a persistent, unmissable status message for that whole window.
let busyCount = 0;

function ensureBusyOverlay() {
  let overlay = document.getElementById("busyOverlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "busyOverlay";
  overlay.className = "busy-overlay";
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-busy", "true");
  overlay.innerHTML = `
    <div class="busy-card">
      <div class="spinner spinner-lg" role="status" aria-label="Loading"></div>
      <div class="busy-msg" id="busyMsg">Loading…</div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

export function showBusy(message = "Loading…") {
  busyCount += 1;
  const overlay = ensureBusyOverlay();
  const msg = overlay.querySelector("#busyMsg");
  if (msg) msg.textContent = message;
  overlay.classList.add("show");
  document.body.classList.add("is-busy");
}

export function hideBusy() {
  busyCount = Math.max(0, busyCount - 1);
  if (busyCount > 0) return;
  const overlay = document.getElementById("busyOverlay");
  if (overlay) overlay.classList.remove("show");
  document.body.classList.remove("is-busy");
}

// Updates the message on an already-open overlay without touching busyCount.
export function setBusyMessage(message) {
  const overlay = document.getElementById("busyOverlay");
  if (!overlay) return;
  const msg = overlay.querySelector("#busyMsg");
  if (msg) msg.textContent = message;
}

export function pageLoader(container, message = "Turning the mill…") {
  container.innerHTML = `<div class="loading-row"><span class="spinner" aria-hidden="true"></span><span>${message}</span></div>`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
