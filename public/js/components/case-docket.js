import { fetchAllFlintRows } from "../genlayer-client.js";
import { getContractAddress } from "../config.js";
import { statusClass, escapeHtml } from "../ui.js";

const EXAMPLE = {
  id: "checkout-timeout-0417",
  service_name: "acme/checkout-service",
  incident_description: "Partial refunds hang for 28s when the card network returns a delayed 200.",
  verdict: "IGNITED",
  status: "settled",
};

function renderDocket(root, { id, service_name, repo_url, incident_description, issue_description, verdict, status, live }) {
  root.innerHTML = `
    <div class="docket-header">
      <span>${live ? "Live from chain" : "Example flint"}</span>
      <span class="docket-case-id mono">${escapeHtml(id)}</span>
    </div>
    <div class="docket-repo mono">${escapeHtml(service_name || repo_url || "")}</div>
    <div class="docket-issue">${escapeHtml(incident_description || issue_description || "")}</div>
    <div class="docket-status"><span class="${statusClass(status)}">${escapeHtml(status)}</span></div>
    <div class="docket-log" id="docketLog"></div>
    <div class="stamp" id="docketStamp">${escapeHtml(verdict)}</div>
  `;
  const log = root.querySelector("#docketLog");
  const stamp = root.querySelector("#docketStamp");
  const lines = ["Flint struck, reward recorded", "Claimed by a hunter", "Spark stored on-chain", "Validators reached consensus"];
  let i = 0;
  const timer = setInterval(() => {
    if (i >= lines.length) {
      clearInterval(timer);
      stamp.classList.add("show");
      return;
    }
    const span = document.createElement("span");
    span.textContent = lines[i];
    log.appendChild(span);
    i += 1;
  }, 650);
}

export async function mountHeroDocket(root) {
  const address = getContractAddress();
  if (address) {
    try {
      const rows = await fetchAllFlintRows();
      for (const row of rows) {
        const flint = row.flint || row.bounty;
        if (flint?.verdict) {
          renderDocket(root, { id: row.id, ...flint, live: true });
          return;
        }
      }
    } catch {
      /* example */
    }
  }
  renderDocket(root, { ...EXAMPLE, live: false });
}
