# Flintmill

Incident-reproduction bounties judged by GenLayer validator consensus.

This is not PatchCourt. PatchCourt pays for a code fix. Flintmill pays for a
faithful reproduction of a production incident.

## Title
**Flintmill**

## Flow
1. Poster strikes a flint (`post_flint`)
2. Hunter claims it (`claim_flint`)
3. Hunter submits a spark (`submit_spark`)
4. Anyone triggers judgment (`submit_verdict`) → IGNITED / SMOULDER / DEAD

## Run locally
```bash
python3 scripts/serve.py
# http://127.0.0.1:8080
```

## Deploy
1. Deploy `contracts/flintmill_contract.py` on Studio Next (chain 61997)
2. Open `/pages/setup.html` and paste the address
3. Changing the address clears this browser's Flintmill cache so the mill
   only lists flints from the contract you just pointed at
