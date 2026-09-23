import { pageShell, pageFooter, wireChrome } from "./ui.js";
import { getContractAddress } from "./config.js";
import { mountHeroDocket } from "./components/case-docket.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "" })}
<main>
  <section class="hero">
    <div class="hero-grid">
      <div class="hero-copy">
        <div class="section-eyebrow">GenLayer · Studio Next</div>
        <h1>Reproduce the incident. Get paid when the mill agrees it burns the same way.</h1>
        <p>Flintmill is not a patch bounty. You post a production failure. A hunter submits a spark — the smallest faithful reproduction. Independent GenLayer validators decide IGNITED, SMOULDER, or DEAD.</p>
        <p id="contractHint">${getContractAddress() ? "Contract configured, reading live flints." : "No contract set yet. Showing an example flint — add one on Setup."}</p>
        <div class="hero-actions">
          <a class="btn-primary" href="/pages/mill.html">Open the mill</a>
          <a class="btn-secondary" href="/pages/strike.html">Strike a flint</a>
        </div>
      </div>
      <div class="docket panel" id="heroDocket"></div>
    </div>
  </section>
  <section>
    <div class="container">
      <div class="section-eyebrow">How a flint moves</div>
      <h2>Four strikes, all on-chain</h2>
      <div class="flow-grid" style="margin-top:2rem">
        <div class="flow-step"><h4>Strike</h4><p>The poster describes the incident and what a real reproduction must prove. Reward is recorded with the flint.</p></div>
        <div class="flow-step"><h4>Claim</h4><p>One hunter owns the flint. No race of competing sparks on the same record.</p></div>
        <div class="flow-step"><h4>Spark</h4><p>The hunter commits steps, an artifact URL and its SHA-256. The commitment is locked. Validators fetch the artifact and verify the hash.</p></div>
        <div class="flow-step"><h4>Mill</h4><p>Validators reach consensus: IGNITED if the failure is faithfully reproduced, SMOULDER if partial, DEAD if it is not.</p></div>
      </div>
    </div>
  </section>
  <section>
    <div class="container">
      <div class="section-eyebrow">Why reproduction, not a patch</div>
      <h2>A green test is not a found bug</h2>
      <p class="lede">Most bounty boards pay for a diff. Flintmill pays for a reproduction that independent readers can light themselves. That is the missing step before anyone should trust a fix.</p>
      <div class="why-grid">
        <div class="why-card"><h4>Faithful, not theatrical</h4><p>Validators compare the spark to the incident and the success criteria, not to a screenshot of a dashboard.</p></div>
        <div class="why-card"><h4>No single reviewer</h4><p>The poster cannot bury a real reproduction to avoid paying. The hunter cannot rubber-stamp their own spark.</p></div>
        <div class="why-card"><h4>Public packet</h4><p>Steps, artifact hash, digests, and every verdict round sit in contract state. Anyone can re-hash what was judged.</p></div>
      </div>
    </div>
  </section>
  <section id="cta">
    <div class="container narrow">
      <h2>Ready to strike?</h2>
      <p class="lede">Deploy the contract, paste the address on Setup, then post a flint from your wallet.</p>
      <div class="hero-actions">
        <a class="btn-primary" href="/pages/mill.html">Open the mill</a>
        <a class="btn-secondary" href="/pages/verify.html">How to verify</a>
      </div>
    </div>
  </section>
</main>
${pageFooter()}
`;

await wireChrome();
await mountHeroDocket(document.getElementById("heroDocket"));
