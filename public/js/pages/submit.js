import { writeContract, getFlint } from "../genlayer-client.js";
import { pageShell, pageFooter, wireChrome, toast, rememberFlintId, formValue, withSpinner, requireWallet, requireContract } from "../ui.js";

const flintId = new URLSearchParams(location.search).get("id") || "";
const HEX64 = /^[0-9a-f]{64}$/;

document.getElementById("app").innerHTML = `
${pageShell({ active: "mill" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>Submit a spark</h1>
      <p>Calls <code>submit_spark</code>. You commit an artifact URL and its SHA-256. Validators fetch the artifact themselves and check the hash before they judge, so the verdict rests on evidence they can verify, not on pasted text.</p>
    </div>
    <form id="sparkForm" class="panel">
      <label>Flint ID
        <input name="flint_id" required value="${flintId}">
      </label>
      <label>Reproduction steps
        <textarea name="repro_steps" rows="6" required maxlength="4000" placeholder="Exact steps that light the same failure"></textarea>
      </label>
      <label>Artifact URL (https, pinned to a commit or revision)
        <input name="artifact_url" type="url" required maxlength="500" placeholder="https://raw.githubusercontent.com/acme/repro/&lt;commit&gt;/trace.log">
      </label>
      <label>Artifact SHA-256
        <input name="artifact_sha256" required minlength="64" maxlength="64" pattern="[0-9a-fA-F]{64}" placeholder="64 hex characters">
      </label>
      <div class="toolbar wrap">
        <button class="btn-secondary" type="button" id="hashBtn">Compute hash from URL</button>
        <span class="step-note" id="hashNote">If the host blocks browser reads, run <code>curl -sL URL | sha256sum</code> and paste the result.</span>
      </div>
      <label>Notes
        <textarea name="notes" rows="3" maxlength="2000" placeholder="Environment, version, caveats"></textarea>
      </label>
      <label class="toolbar wrap">
        <input type="checkbox" name="lock_ack" required>
        <span>I understand a spark is committed once and cannot be edited or replaced afterwards.</span>
      </label>
      <button class="btn-primary" type="submit" id="sparkSubmitBtn">Commit spark on-chain</button>
    </form>
    <p id="txOut" class="muted"></p>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

async function sha256OfUrl(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Artifact fetch failed (${response.status})`);
  const digest = await crypto.subtle.digest("SHA-256", await response.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function checkInputs(url, sha) {
  if (!/^https:\/\/\S+$/.test(url)) throw new Error("Artifact URL must be an https URL with no spaces.");
  if (!HEX64.test(sha)) throw new Error("Artifact SHA-256 must be 64 hex characters.");
}

document.getElementById("hashBtn").addEventListener("click", async (event) => {
  const form = document.getElementById("sparkForm");
  const url = formValue(form, "artifact_url");
  await withSpinner(event.currentTarget, async () => {
    try {
      if (!/^https:\/\/\S+$/.test(url)) throw new Error("Enter an https artifact URL first.");
      form.elements.artifact_sha256.value = await sha256OfUrl(url);
      toast("Hash computed from the live artifact", "ok");
    } catch (error) {
      toast(`${error.message || error}. Compute it with curl -sL URL | sha256sum instead.`, "err");
    }
  });
});

document.getElementById("sparkForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const id = formValue(form, "flint_id");
  const url = formValue(form, "artifact_url");
  const sha = formValue(form, "artifact_sha256").toLowerCase();
  const button = document.getElementById("sparkSubmitBtn");
  await withSpinner(button, async () => {
    try {
      checkInputs(url, sha);
      const account = await requireWallet("You need a connected wallet to submit a spark.");
      const current = await getFlint(id);
      if (!current) throw new Error("No flint with this ID exists on the contract.");
      if (current.status !== "claimed" || current.spark_digest) {
        throw new Error("This flint already has a committed spark or is not in the claimed state.");
      }
      let live = null;
      try {
        live = await sha256OfUrl(url);
      } catch {
        live = null;
      }
      if (live && live !== sha) {
        throw new Error("The artifact at this URL does not match the hash you entered. Fix the hash or pin the URL to an immutable revision.");
      }
      toast("Confirm submit_spark…");
      const { hash } = await writeContract(
        "submit_spark",
        [id, formValue(form, "repro_steps"), url, sha, formValue(form, "notes")],
        account
      );
      rememberFlintId(id);
      document.getElementById("txOut").innerHTML = `Spark committed and locked. <a href="/pages/flint.html?id=${encodeURIComponent(id)}">Judge it</a> · tx <code>${hash || "submitted"}</code>`;
      toast("Spark committed", "ok");
    } catch (error) {
      toast(error.message || String(error), "err");
    }
  });
});
