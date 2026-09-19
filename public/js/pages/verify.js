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
      <div class="step-row step-done"><div class="step-num">✓</div><div class="step-body"><h4>Read the spark against the verdict</h4><div class="step-note">Expand the spark. Those steps are the exact evidence validators judged.</div></div><div></div></div>
      <div class="step-row step-done"><div class="step-num">✓</div><div class="step-body"><h4>Check the transaction</h4><div class="step-note">Actions link to <a href="${NETWORK.explorer}" target="_blank" rel="noopener">Studio Next explorer</a>. A verdict is a <code>submit_verdict</code> call.</div></div><div></div></div>
    </div>
  </div>
</main>
${pageFooter()}
`;
await wireChrome();
