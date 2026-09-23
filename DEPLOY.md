# Deploy Flintmill

1. Deploy contracts/flintmill_contract.py to Studio Next. The submit_spark signature changed (artifact_url and artifact_sha256 replace the free-text evidence field), so this needs a fresh deployment.
2. Paste the new address on /pages/setup.html.
3. Walk one flint end to end: post_flint, claim_flint, submit_spark with a commit-pinned https artifact and its sha256, submit_verdict, then raise_dispute and submit_verdict again.
4. Confirm on the explorer that the second submit_verdict changed both the verdict and the credits of the flint.
