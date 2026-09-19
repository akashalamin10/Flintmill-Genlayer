import { writeContract } from "../genlayer-client.js";
import { pageShell, pageFooter, wireChrome, toast, rememberFlintId, formValue, withSpinner, requireWallet, requireContract } from "../ui.js";

const flintId = new URLSearchParams(location.search).get("id") || "";

document.getElementById("app").innerHTML = `
${pageShell({ active: "mill" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>Submit a spark</h1>
      <p>Calls <code>submit_spark</code>. The reproduction steps land on-chain so validators judge the actual evidence.</p>
    </div>
    <form id="sparkForm" class="panel">
      <label>Flint ID
        <input name="flint_id" required value="${flintId}">
      </label>
      <label>Reproduction steps
        <textarea name="repro_steps" rows="6" required placeholder="Exact steps that light the same failure"></textarea>
      </label>
      <label>Evidence (logs, traces, fixture)
        <textarea name="evidence" rows="8" required placeholder="Paste logs or a minimal fixture"></textarea>
      </label>
      <label>Notes
        <textarea name="notes" rows="3" placeholder="Environment, version, caveats"></textarea>
      </label>
      <button class="btn-primary" type="submit" id="sparkSubmitBtn">Store spark on-chain</button>
    </form>
    <p id="txOut" class="muted"></p>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

document.getElementById("sparkForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const id = formValue(form, "flint_id");
  const button = document.getElementById("sparkSubmitBtn");
  await withSpinner(button, async () => {
    try {
      const account = await requireWallet("You need a connected wallet to submit a spark.");
      toast("Confirm submit_spark…");
      const { hash } = await writeContract(
        "submit_spark",
        [id, formValue(form, "repro_steps"), formValue(form, "evidence"), formValue(form, "notes")],
        account
      );
      rememberFlintId(id);
      document.getElementById("txOut").innerHTML = `Spark stored. <a href="/pages/flint.html?id=${encodeURIComponent(id)}">Judge it</a> · tx <code>${hash || "submitted"}</code>`;
      toast("Spark submitted", "ok");
    } catch (error) {
      toast(error.message || String(error), "err");
    }
  });
});
