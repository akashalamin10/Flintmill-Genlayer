# Flintmill

Incident-reproduction bounties judged by GenLayer validator consensus.

Flintmill pays for a faithful reproduction of a production incident, not for a
code fix.

## Title
**Flintmill**

## Flow
1. Poster strikes a flint (`post_flint`). The incident, criteria and reward are
   bound to the poster's address by an incident digest.
2. Hunter claims it (`claim_flint`)
3. Hunter commits a spark (`submit_spark`): reproduction steps, an https
   artifact URL and the artifact's SHA-256. The commitment is locked and gets a
   spark digest. It cannot be edited or replaced.
4. Anyone triggers judgment (`submit_verdict`). Each validator fetches the
   artifact itself, checks the SHA-256, and only then reads the content and
   answers IGNITED / SMOULDER / DEAD. A hash mismatch is DEAD without any model call.
5. Either party may dispute once (`raise_dispute`). Re-judgment feeds the
   dispute notes to validators as an argument, then replaces the verdict and the
   credit split in a single state write. That verdict is final.

## Trust model
- Evidence is verifiable: the verdict rests on the fetched artifact, not on text the hunter pasted.
- Evidence is immutable: one spark per flint, locked at commit. Judgment re-checks the stored incident and spark digests.
- Party text (steps, notes, dispute notes) reaches validators as escaped JSON string literals marked untrusted.
- The ledger is conserving: hunter and poster amounts always sum to the reward, and a re-judgment reverses the previous allocation before applying the new one.
- Each judged round is recorded with the digests it judged (`get_verdict_history`).

## Hunter checklist
Pin the artifact to an immutable revision (a commit-pinned raw URL or a gist
revision), then hash the exact bytes:

```bash
curl -sL "<artifact url>" | sha256sum
```

The Spark page can also compute the hash in the browser when the host allows it.

## Contract API
| Function | Purpose |
| --- | --- |
| `post_flint(flint_id, service_name, incident_description, reward, success_criteria)` | Strike a flint |
| `claim_flint(flint_id)` | Hunter claims |
| `submit_spark(flint_id, repro_steps, artifact_url, artifact_sha256, notes)` | Commit the spark once |
| `submit_verdict(flint_id)` | Judge, or re-judge after a dispute |
| `raise_dispute(flint_id, notes)` | One dispute per flint, parties only |
| `get_flint`, `list_flints`, `list_flint_ids`, `get_verdict_history`, `get_credit`, `get_owner` | Views |

## Run locally
```bash
python3 scripts/serve.py
# http://127.0.0.1:8080
```

## Test the contract logic
```bash
pip install -r contracts/requirements.txt
python3 -m pytest contracts/tests -q
```
The Flintmill tests load the real contract file against a small in-memory
stand-in for the GenLayer runtime.

## Deploy
1. Deploy `contracts/flintmill_contract.py` on Studio Next (chain 61997). This
   version changes the `submit_spark` signature, so redeploy rather than upgrade.
2. Open `/pages/setup.html` and paste the address
3. Changing the address clears this browser's Flintmill cache so the mill
   only lists flints from the contract you just pointed at
