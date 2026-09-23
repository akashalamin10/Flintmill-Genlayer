import { explorerTx } from "../config.js";
import { getFlint, writeContract } from "../genlayer-client.js";
import { shortAddr } from "../wallet.js";
import { pageShell, pageFooter, wireChrome, toast, statusClass, rememberFlintId, loadLocalFlintIds, withSpinner, pageLoader, escapeHtml, requireWallet, requireContract } from "../ui.js";
import { flashReward, playVerdict, openModal } from "../fx.js";

function readFlintId() {
  const params = new URLSearchParams(location.search);
  const fromQuery = (params.get("id") || params.get("flint") || "").trim();
  if (fromQuery) return fromQuery;
  const hash = (location.hash || "").replace(/^#/, "").trim();
  if (hash) return decodeURIComponent(hash);
  const saved = loadLocalFlintIds();
  return saved[0] || "";
}

const arrivedWithId = Boolean(readFlintId());
let flintId = readFlintId();

document.getElementById("app").innerHTML = `
${pageShell({ active: "mill" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>Flint</h1>
      <p class="mono" id="caseId">${flintId || "missing id"}</p>
    </div>
    <details class="panel steps" ${arrivedWithId ? "" : "open"}>
      <summary>${arrivedWithId ? "Open another flint" : "Enter a flint ID"}</summary>
      <div class="toolbar wrap" style="margin-top:12px">
        <input id="idInput" class="field" value="${escapeHtml(flintId)}" placeholder="Flint ID" style="min-width:220px">
        <button class="btn-secondary" id="loadBtn" type="button">Load flint</button>
      </div>
    </details>
    <div id="docket" class="panel" style="margin-top:1.5rem"></div>
    <div class="stepper" id="stepper"></div>
    <div class="toolbar wrap" id="disputeRow" style="display:none">
      <button class="btn-secondary" id="disputeBtn" type="button">Raise dispute</button>
      <span class="step-note">Only after a verdict has been written. One dispute per flint.</span>
    </div>
    <p id="txOut" class="muted"></p>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

function setId(next) {
  flintId = String(next || "").trim();
  const label = document.getElementById("caseId");
  const input = document.getElementById("idInput");
  if (label) label.textContent = flintId || "missing id";
  if (input) input.value = flintId;
  if (flintId) rememberFlintId(flintId);
}

async function withWallet(fn) {
  const account = await requireWallet("You need a connected wallet to sign this transaction.");
  return fn(account);
}

function stepRow({ num, title, state, note, actionHtml }) {
  return `
    <div class="step-row step-${state}">
      <div class="step-num">${state === "done" ? "✓" : num}</div>
      <div class="step-body">
        <h4>${title}</h4>
        ${note ? `<div class="step-note">${note}</div>` : ""}
      </div>
      <div>${actionHtml || ""}</div>
    </div>`;
}

function renderStepper(flint) {
  const stepper = document.getElementById("stepper");
  const disputeRow = document.getElementById("disputeRow");
  const status = flint.status || "open";
  const hasSpark = Boolean(flint.repro_steps || flint.diff_text);
  const hasVerdict = Boolean(flint.verdict) && status !== "disputed";

  const claimState = status === "open" ? "active" : "done";
  const claimNote = status === "open" ? "Any wallet except the poster can claim this flint." : `Claimed by ${escapeHtml(shortAddr(flint.hunter || flint.worker) || "—")}`;
  const claimAction = status === "open" ? `<button class="btn-primary" id="claimBtn" type="button">Claim flint</button>` : "";

  const sparkState = status === "open" ? "locked" : hasSpark ? "done" : "active";
  const sparkNote = status === "open" ? "Unlocks once the flint is claimed." : hasSpark ? "Committed and locked. Validators verify the artifact hash before judging." : "Only the assigned hunter can submit here. A spark is committed once.";
  const sparkAction = status === "open" || hasSpark ? "" : `<a class="btn-secondary" href="/pages/spark.html?id=${encodeURIComponent(flintId)}">Submit spark</a>`;

  const judgeState = !hasSpark ? "locked" : hasVerdict ? "done" : "active";
  const disputed = status === "disputed";
  const judgeNote = !hasSpark
    ? "Unlocks once a spark is submitted."
    : hasVerdict
      ? `Verdict: ${escapeHtml(flint.verdict)}. Independent validators decided this.${flint.final ? " Final after dispute." : ""}`
      : disputed
        ? "Dispute raised. Validators re-read the artifact together with the dispute notes and replace the verdict and credit split in one step."
        : "Anyone can trigger this. Validators decide the word, not the clicker.";
  const judgeAction = hasSpark && !hasVerdict ? `<button class="btn-primary" id="judgeBtn" type="button">${disputed ? "Re-judge with GenLayer" : "Judge with GenLayer"}</button>` : "";

  stepper.innerHTML =
    stepRow({ num: 1, title: "Claim flint", state: claimState, note: claimNote, actionHtml: claimAction }) +
    stepRow({ num: 2, title: "Submit spark", state: sparkState, note: sparkNote, actionHtml: sparkAction }) +
    stepRow({ num: 3, title: "Judge with GenLayer", state: judgeState, note: judgeNote, actionHtml: judgeAction });

  const judged = status === "settled" || status === "rejected" || status === "ignited" || status === "dead";
  const disputeOpen = judged && !flint.final && Number(flint.dispute_count || 0) < 1;
  disputeRow.style.display = disputeOpen ? "flex" : "none";

  document.getElementById("claimBtn")?.addEventListener("click", async (event) => {
    await withSpinner(event.currentTarget, async () => {
      try {
        await withWallet(async (account) => {
          toast("Confirm claim_flint…");
          const { hash } = await writeContract("claim_flint", [flintId], account);
          document.getElementById("txOut").innerHTML = `Claimed. <a href="${explorerTx(hash)}" target="_blank" rel="noopener">View on explorer</a>`;
        });
        flashReward();
        await render();
        toast("Claimed", "ok");
      } catch (error) {
        toast(error.message || String(error), "err");
      }
    });
  });

  document.getElementById("judgeBtn")?.addEventListener("click", async (event) => {
    await withSpinner(event.currentTarget, async () => {
      try {
        await withWallet(async (account) => {
          toast("Validators are reading the spark. Keep this tab open.");
          const { hash } = await writeContract("submit_verdict", [flintId], account);
          document.getElementById("txOut").innerHTML = `Judged. <a href="${explorerTx(hash)}" target="_blank" rel="noopener">View on explorer</a>`;
        });
        const judged = await getFlint(flintId);
        playVerdict(judged?.verdict || "IGNITED");
        await render();
        toast("Verdict written on-chain", "ok");
      } catch (error) {
        toast(error.message || String(error), "err");
      }
    });
  });
}

function artifactHtml(flint) {
  const url = String(flint.artifact_url || "");
  if (!url) return `<pre>${escapeHtml(flint.evidence || flint.diff_text || "")}</pre>`;
  const link = url.startsWith("https://")
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
    : escapeHtml(url);
  return `<p class="mono">Artifact ${link}<br>SHA-256 ${escapeHtml(flint.artifact_sha256 || "")}<br>Spark digest ${escapeHtml(flint.spark_digest || "")}<br>Incident digest ${escapeHtml(flint.incident_digest || "")}</p>`;
}

function allocationHtml(flint) {
  if (!flint.allocation || !flint.verdict) return "";
  const hunter = Number(flint.allocation.hunter || 0);
  const poster = Number(flint.allocation.poster || 0);
  return `<p class="mono">Ledger: hunter ${escapeHtml(hunter)} wei · poster ${escapeHtml(poster)} wei${flint.artifact_status === "hash_mismatch" ? " · artifact hash mismatch" : ""}</p>`;
}

function roundsHtml(flint) {
  const rounds = Array.isArray(flint.rounds) ? flint.rounds : [];
  if (!rounds.length) return "";
  const rows = rounds
    .map((entry) => `<li class="mono">Round ${escapeHtml(entry.round)}: ${escapeHtml(entry.verdict)} (${escapeHtml(entry.artifact_status)}) · hunter ${escapeHtml(entry.hunter_amount)} / poster ${escapeHtml(entry.poster_amount)}${entry.dispute_notes ? " · after dispute" : ""}</li>`)
    .join("");
  return `<details><summary>Verdict history</summary><ul>${rows}</ul></details>`;
}

async function render() {
  const root = document.getElementById("docket");
  const stepper = document.getElementById("stepper");
  const disputeRow = document.getElementById("disputeRow");
  if (!flintId) {
    root.textContent = "Enter a flint ID above and click Load flint.";
    stepper.innerHTML = "";
    disputeRow.style.display = "none";
    return;
  }
  pageLoader(root, "Reading on-chain flint…");
  const flint = await getFlint(flintId);
  if (!flint) {
    root.textContent = "The contract returned no record for this ID yet.";
    stepper.innerHTML = "";
    disputeRow.style.display = "none";
    return;
  }
  rememberFlintId(flintId);
  root.innerHTML = `
    <div class="case-card-top">
      <span class="${statusClass(flint.status)}">${escapeHtml(flint.status)}</span>
      <span class="${statusClass(flint.verdict)}">${escapeHtml(flint.verdict || "no verdict")}</span>
    </div>
    <p><strong style="color:var(--ink)">Service</strong><br>${escapeHtml(flint.service_name || flint.repo_url)}</p>
    <p><strong style="color:var(--ink)">Incident</strong><br>${escapeHtml(flint.incident_description || flint.issue_description)}</p>
    <p><strong style="color:var(--ink)">Success criteria</strong><br>${escapeHtml(flint.success_criteria || flint.acceptance_criteria)}</p>
    <p><strong style="color:var(--ink)">Reward</strong> ${escapeHtml(flint.reward)} wei</p>
    <p class="mono">Poster ${escapeHtml(shortAddr(flint.poster || flint.buyer) || "—")} · Hunter ${escapeHtml(shortAddr(flint.hunter || flint.worker) || "—")}</p>
    ${flint.dispute_notes ? `<div class="alert">Dispute notes (${escapeHtml(flint.dispute_role || "party")}): ${escapeHtml(flint.dispute_notes)}</div>` : ""}
    ${allocationHtml(flint)}
    ${
      flint.repro_steps || flint.diff_text
        ? `<details><summary>Spark, artifact, notes</summary>
           <pre>${escapeHtml(flint.repro_steps || flint.explanation || "")}</pre>
           ${artifactHtml(flint)}
           <pre>${escapeHtml(flint.notes || flint.test_log || "")}</pre></details>`
        : ""
    }
    ${roundsHtml(flint)}
  `;
  renderStepper(flint);
}

document.getElementById("loadBtn").addEventListener("click", async () => {
  setId(document.getElementById("idInput").value);
  try { await render(); } catch (error) { toast(error.message || String(error), "err"); }
});

document.getElementById("disputeBtn").addEventListener("click", () => {
  const button = document.getElementById("disputeBtn");
  openModal({
    kicker: "DISPUTE",
    title: "Raise a dispute",
    body: "Explain why this verdict should be reviewed. Written on-chain.",
    extraHtml: `<label>Notes<textarea id="disputeNotes" rows="4" placeholder="Why dispute this verdict?"></textarea></label>`,
    confirmLabel: "Submit dispute",
    onConfirm: async () => {
      const notes = (document.getElementById("disputeNotes")?.value || "").trim() || "Disagree with verdict";
      await withSpinner(button, async () => {
        try {
          await withWallet(async (account) => {
            const { hash } = await writeContract("raise_dispute", [flintId, notes], account);
            document.getElementById("txOut").innerHTML = `Disputed. <a href="${explorerTx(hash)}" target="_blank" rel="noopener">View on explorer</a>`;
          });
          await render();
        } catch (error) {
          toast(error.message || String(error), "err");
        }
      });
    },
  });
});

try { await render(); } catch (error) {
  document.getElementById("docket").textContent = error.message || String(error);
  toast(error.message || String(error), "err");
}
