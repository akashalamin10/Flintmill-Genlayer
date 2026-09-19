import { fetchAllFlintRows, getCredit } from "../genlayer-client.js";
import { getAccount, sameAddress, onAccountsChanged } from "../wallet.js";
import { pageShell, pageFooter, wireChrome, toast, statusClass, loadLocalFlintIds, pageLoader, escapeHtml, requireContract } from "../ui.js";
import { getContractAddress } from "../config.js";
import { cacheGet, cacheSet, sameJSON, formatAge } from "../cache.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "ledger" })}
<main class="page">
  <div class="container">
    <div class="section-head">
      <h1>Ledger</h1>
      <p>Scoped to the connected wallet. Posted flints, claimed hunts, and settlement credit on this contract.</p>
    </div>
    <div class="card-grid" style="margin-bottom:2rem">
      <div class="stat-card" style="--stat-color:var(--bronze)">
        <div class="stat-label">Withdrawable credit</div>
        <div class="stat-value" id="creditValue">—</div>
        <div class="stat-sub">wei, settled from judged flints</div>
        <div class="tbar"><div class="tbf" id="creditBar"></div></div>
      </div>
      <div class="stat-card" style="--stat-color:var(--ember)">
        <div class="stat-label">Flints struck</div>
        <div class="stat-value" id="postedValue">—</div>
        <div class="tbar"><div class="tbf" id="postedBar"></div></div>
      </div>
      <div class="stat-card" style="--stat-color:var(--moss)">
        <div class="stat-label">Flints claimed</div>
        <div class="stat-value" id="claimedValue">—</div>
        <div class="tbar"><div class="tbf" id="claimedBar"></div></div>
      </div>
    </div>
    <div class="toolbar">
      <button class="btn-primary" id="withdrawBtn" type="button" disabled>Withdraw credit (pending escrow upgrade)</button>
      <button class="btn-secondary" id="refreshBtn" type="button">Refresh</button>
      <span class="last-updated" id="lastUpdated"></span>
    </div>
    <h2 style="font-size:var(--step-1)">Struck by me</h2>
    <div id="postedGrid" class="card-grid" style="margin-bottom:2.5rem"></div>
    <h2 style="font-size:var(--step-1)">Claimed by me</h2>
    <div id="claimedGrid" class="card-grid"></div>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

function caseCard(id, flint) {
  return `
    <a class="case-card" href="/pages/flint.html?id=${encodeURIComponent(id)}">
      <div class="case-card-top">
        <span class="mono">${escapeHtml(id)}</span>
        <span class="${statusClass(flint.status)}">${escapeHtml(flint.status)}</span>
      </div>
      <h3>${escapeHtml(flint.incident_description || flint.issue_description || "Untitled incident")}</h3>
      <p class="mono">reward ${escapeHtml(flint.reward)} · verdict ${escapeHtml(flint.verdict || "pending")}</p>
    </a>`;
}

function renderEmpty() {
  document.getElementById("postedGrid").innerHTML = `<p class="muted">Connect your wallet to see your flints and credit.</p>`;
  document.getElementById("claimedGrid").innerHTML = "";
  document.getElementById("creditValue").textContent = "—";
  document.getElementById("postedValue").textContent = "—";
  document.getElementById("claimedValue").textContent = "—";
}

function renderData({ posted, claimed, credit }) {
  document.getElementById("postedValue").textContent = posted.length;
  document.getElementById("claimedValue").textContent = claimed.length;
  document.getElementById("postedGrid").innerHTML = posted.length
    ? posted.map(({ id, flint }) => caseCard(id, flint)).join("")
    : `<p class="muted">No flints struck from this wallet yet.</p>`;
  document.getElementById("claimedGrid").innerHTML = claimed.length
    ? claimed.map(({ id, flint }) => caseCard(id, flint)).join("")
    : `<p class="muted">No flints claimed from this wallet yet.</p>`;
  document.getElementById("creditValue").textContent = credit;
}

function setLastUpdated(ts) {
  const el = document.getElementById("lastUpdated");
  if (el) el.textContent = ts ? `Updated ${formatAge(ts)}` : "";
}

async function load({ silent = false } = {}) {
  const account = await getAccount();
  if (!account) { renderEmpty(); return; }
  const cacheKey = `ledger:${getContractAddress() || "unset"}:${account.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (!silent && cached?.value) {
    renderData(cached.value);
    setLastUpdated(cached.ts);
  } else if (!silent) {
    pageLoader(document.getElementById("postedGrid"), "Reading your flints…");
  }
  try {
    const [rows, credit] = await Promise.all([
      fetchAllFlintRows(loadLocalFlintIds()),
      getCredit(account).catch(() => 0),
    ]);
    const posted = [];
    const claimed = [];
    for (const row of rows) {
      const flint = row.flint || row.bounty;
      if (sameAddress(flint.poster || flint.buyer, account)) posted.push({ id: row.id, flint });
      if (sameAddress(flint.hunter || flint.worker, account)) claimed.push({ id: row.id, flint });
    }
    const fresh = { posted, claimed, credit };
    renderData(fresh);
    cacheSet(cacheKey, fresh);
    setLastUpdated(Date.now());
  } catch (error) {
    if (!silent) toast(error.message || String(error), "err");
  }
}

document.getElementById("refreshBtn").addEventListener("click", () => load({ silent: false }));
document.getElementById("withdrawBtn").addEventListener("click", () => {
  toast("Withdraw is not live on this deploy yet. Credit is still tracked on-chain.", "info");
});
await load();
onAccountsChanged(() => load());
