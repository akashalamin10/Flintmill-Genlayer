import { fetchAllFlintRows } from "../genlayer-client.js";
import { pageShell, pageFooter, wireChrome, toast, statusClass, loadLocalFlintIds, rememberFlintId, pageLoader, escapeHtml, requireContract } from "../ui.js";
import { shortAddr } from "../wallet.js";
import { getContractAddress } from "../config.js";
import { cacheGet, cacheSet, sameJSON, formatAge } from "../cache.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "mill" })}
<main class="page">
  <div class="container">
    <div class="section-head">
      <h1>The mill</h1>
      <p>Every flint is a live incident record on Studio Next. Open one to claim it, strike a spark (the reproduction), and let validators decide whether it burns the same way.</p>
    </div>
    <div class="toolbar">
      <a class="btn-primary" href="/pages/strike.html">Strike a flint</a>
      <button class="btn-secondary" id="refreshBtn" type="button">Reload from chain</button>
      <span class="last-updated" id="lastUpdated"></span>
    </div>
    <div id="grid" class="bounty-table-wrap"></div>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

const CACHE_KEY = `mill:${getContractAddress() || "unset"}`;
const POLL_MS = 45000 + Math.floor(Math.random() * 5000);

function renderCards(grid, cards) {
  if (!cards.length) {
    grid.innerHTML = `<p class="muted">No flints yet. Strike one, or set the contract address on Setup.</p>`;
    return;
  }
  grid.innerHTML = `
    <table class="bounty-table">
      <thead>
        <tr>
          <th>Flint</th>
          <th>Heat</th>
          <th>Incident</th>
          <th>Reward</th>
          <th>Verdict</th>
          <th>Hunter</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${cards.map(({ id, flint }) => `
          <tr>
            <td class="mono">${escapeHtml(id)}</td>
            <td><span class="${statusClass(flint.status)}">${escapeHtml(flint.status || "unknown")}</span></td>
            <td class="cell-title">${escapeHtml(flint.incident_description || flint.issue_description || "Untitled incident")}</td>
            <td class="mono">${escapeHtml(flint.reward || 0)}</td>
            <td><span class="${statusClass(flint.verdict)}">${escapeHtml(flint.verdict || "pending")}</span></td>
            <td class="mono">${escapeHtml(shortAddr(flint.hunter || flint.worker) || "—")}</td>
            <td><a class="btn-open" href="/pages/flint.html?id=${encodeURIComponent(id)}">Open flint</a></td>
          </tr>`).join("")}
      </tbody>
    </table>
    <div class="bounty-cards">
      ${cards.map(({ id, flint }) => `
        <a class="case-card" href="/pages/flint.html?id=${encodeURIComponent(id)}">
          <div class="case-card-top">
            <span class="mono">${escapeHtml(id)}</span>
            <span class="${statusClass(flint.status)}">${escapeHtml(flint.status || "unknown")}</span>
          </div>
          <h3>${escapeHtml(flint.incident_description || flint.issue_description || "Untitled incident")}</h3>
          <p class="mono">reward ${escapeHtml(flint.reward || 0)} · ${escapeHtml(flint.verdict || "pending")}</p>
        </a>`).join("")}
    </div>
  `;
}

function setLastUpdated(ts) {
  const el = document.getElementById("lastUpdated");
  if (el) el.textContent = ts ? `Updated ${formatAge(ts)}` : "";
}

let lastRenderedCards = null;
let loadInFlight = null;

async function load({ silent = false } = {}) {
  const grid = document.getElementById("grid");
  const cached = cacheGet(CACHE_KEY);
  if (!silent) {
    if (cached?.value?.length) {
      lastRenderedCards = cached.value;
      renderCards(grid, cached.value);
      setLastUpdated(cached.ts);
    } else if (!lastRenderedCards?.length) {
      pageLoader(grid, "Reading every flint on this contract…");
    }
  }
  if (loadInFlight) return loadInFlight;
  loadInFlight = (async () => {
    try {
      const rows = await fetchAllFlintRows(loadLocalFlintIds());
      const cards = rows.map((row) => ({ id: row.id, flint: row.flint || row.bounty }));
      for (const row of cards) rememberFlintId(row.id);
      if (!cards.length) {
        if (!lastRenderedCards?.length) grid.innerHTML = `<p class="muted">No flints yet. Strike one, or set the contract address on Setup.</p>`;
        return;
      }
      lastRenderedCards = cards;
      renderCards(grid, cards);
      cacheSet(CACHE_KEY, cards);
      setLastUpdated(Date.now());
    } catch (error) {
      if (!lastRenderedCards?.length) grid.innerHTML = `<p class="muted">${escapeHtml(error.message || String(error))}</p>`;
      if (!silent) toast(error.message || String(error), "err");
    } finally {
      loadInFlight = null;
    }
  })();
  return loadInFlight;
}

document.getElementById("refreshBtn").addEventListener("click", () => load({ silent: false }));
await load();
let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => load({ silent: true }), POLL_MS);
}
if (document.visibilityState === "visible") startPolling();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { load({ silent: true }); startPolling(); }
  else { clearInterval(pollTimer); pollTimer = null; }
});
