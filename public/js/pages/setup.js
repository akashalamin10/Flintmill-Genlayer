import { NETWORK, getContractAddress, setContractAddress, explorerAddress } from "../config.js";
import { pageShell, pageFooter, wireChrome, toast } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "setup" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>Setup</h1>
      <p>Flintmill is a frontend only. Deploy <code>contracts/flintmill_contract.py</code> on Studio Next, then paste the address. Changing it wipes this browser's Flintmill cache so the mill never shows another contract's flints.</p>
    </div>
    <div class="panel" style="margin-bottom:1.5rem">
      <h3 style="font-size:var(--step-0)">Network</h3>
      <table class="mono" style="width:100%;font-size:0.82rem;border-collapse:collapse">
        <tbody>
          <tr><td style="padding:0.3rem 0;color:var(--ink-faint)">Network</td><td>${NETWORK.name}</td></tr>
          <tr><td style="padding:0.3rem 0;color:var(--ink-faint)">Chain ID</td><td>${NETWORK.chainId}</td></tr>
          <tr><td style="padding:0.3rem 0;color:var(--ink-faint)">RPC</td><td>${NETWORK.rpc}</td></tr>
          <tr><td style="padding:0.3rem 0;color:var(--ink-faint)">Explorer</td><td>${NETWORK.explorer}</td></tr>
        </tbody>
      </table>
    </div>
    <form id="addrForm" class="panel">
      <label>Deployed contract address
        <input name="address" id="addrInput" placeholder="0x…" value="${getContractAddress()}">
      </label>
      <button class="btn-primary" type="submit">Save address</button>
      <p class="muted" style="margin:0;font-size:0.8rem">Local to this browser. Saving a new address clears Flintmill's local cache.</p>
    </form>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();

document.getElementById("addrForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const address = document.getElementById("addrInput").value.trim();
  setContractAddress(address);
  toast(address ? "Contract saved. Cache cleared." : "Contract cleared", "ok");
  setTimeout(() => location.reload(), 500);
});
