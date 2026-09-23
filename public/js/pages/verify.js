import { NETWORK } from "../config.js";
import { pageShell, pageFooter, wireChrome } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "verify" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>How to verify a result</h1>
      <p>Confirm a flint was judged by GenLayer validators, not painted by the frontend.</p>
    </div>
    <div class="stepper">
      <div class="step-row step-done"><div class="step-num">✓</div><div class="step-body"><h4>Open a judged flint</h4><div class="step-note">From the mill, open any flint whose heat reads <code>settled</code>, <code>ignited</code>, or <code>rejected</code>.</div></div><div></div></div>
      <div class="step-row step-done"><div class="step-num">✓</div><div class="step-body"><h4>Hash the artifact yourself</h4><div class="step-note">Expand the spark and download the artifact URL. Run <code>sha256sum</code> on it and compare with the committed SHA-256. Validators fetched the same bytes and refused to judge on anything else.</div></div><div></div></div>
      <div class="step-row step-done"><div class="step-num">✓</div><div class="step-body"><h4>Check the transaction</h4><div class="step-note">Actions link to <a href="${NETWORK.explorer}" target="_blank" rel="noopener">Studio Next explorer</a>. A verdict is a <code>submit_verdict</code> call.</div></div><div></div></div>
      <div class="step-row step-done"><div class="step-num">✓</div><div class="step-body"><h4>Follow the verdict history</h4><div class="step-note">Each round lists the spark and incident digests it judged. A disputed flint is re-judged once, and the credit split is replaced in the same step, so the ledger always matches the final verdict.</div></div><div></div></div>
    </div>
  </div>
</main>
${pageFooter()}
`;
await wireChrome();
