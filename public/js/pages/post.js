import { writeContract } from "../genlayer-client.js";
import { pageShell, pageFooter, wireChrome, toast, rememberFlintId, formValue, withSpinner, requireWallet, requireContract } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "strike" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>Strike a flint</h1>
      <p>Calls <code>post_flint</code>. You describe a production incident. Hunters later submit a spark — the reproduction — and validators decide if it is faithful.</p>
    </div>
    <form id="postForm" class="panel">
      <label>Flint ID
        <input name="flint_id" required placeholder="checkout-timeout-0417">
      </label>
      <label>Service or repo
        <input name="service_name" required placeholder="acme/checkout-service">
      </label>
      <label>Incident
        <textarea name="incident_description" rows="3" required placeholder="What broke in production?"></textarea>
      </label>
      <label>What counts as a real reproduction
        <textarea name="success_criteria" rows="3" required placeholder="Expected vs actual, environment, minimum proof"></textarea>
      </label>
      <label>Reward, in wei (recorded on-chain)
        <input name="reward" type="number" min="0" required placeholder="Reward in wei">
      </label>
      <button class="btn-primary" type="submit" id="postSubmitBtn">Strike on GenLayer</button>
    </form>
    <p id="txOut" class="muted"></p>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

document.getElementById("postForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const flintId = formValue(form, "flint_id");
  const reward = Number(formValue(form, "reward") || 0);
  const button = document.getElementById("postSubmitBtn");
  await withSpinner(button, async () => {
    try {
      const account = await requireWallet("You need a connected wallet to strike a flint.");
      toast("Confirm post_flint in your wallet…");
      const { hash } = await writeContract(
        "post_flint",
        [flintId, formValue(form, "service_name"), formValue(form, "incident_description"), reward, formValue(form, "success_criteria")],
        account
      );
      rememberFlintId(flintId);
      document.getElementById("txOut").innerHTML = `Struck. Tx <code>${hash || "submitted"}</code> · <a href="/pages/flint.html?id=${encodeURIComponent(flintId)}">Open flint</a>`;
      toast("Flint posted", "ok");
      form.reset();
    } catch (error) {
      toast(error.message || String(error), "err");
    }
  });
});
