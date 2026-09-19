# v0.1.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import genlayer as gl
from genlayer.types import *
import json


VERDICT_WORDS = ("IGNITED", "SMOULDER", "DEAD")


class Flintmill(gl.contract.Contract):
    flints_json: str
    credits_json: str
    owner: str

    def __init__(self):
        self.flints_json = "{}"
        self.credits_json = "{}"
        self.owner = str(gl.message.sender_address).strip().lower()

    def _norm_addr(self, address: str) -> str:
        return str(address or "").strip().lower()

    def _sender(self) -> str:
        return self._norm_addr(str(gl.message.sender_address))

    def _all(self) -> dict:
        raw = self.flints_json
        if raw is None or raw == "":
            return {}
        return json.loads(raw)

    def _put(self, flint_id: str, record: dict) -> None:
        data = self._all()
        data[flint_id] = record
        self.flints_json = json.dumps(data)

    def _all_credits(self) -> dict:
        raw = self.credits_json
        if raw is None or raw == "":
            return {}
        return json.loads(raw)

    def _credit(self, address: str, amount: int) -> None:
        key = self._norm_addr(address)
        if amount <= 0 or key == "":
            return
        credits = self._all_credits()
        current = int(credits.get(key, 0))
        credits[key] = current + int(amount)
        self.credits_json = json.dumps(credits)

    def _empty_record(self) -> dict:
        return {
            "poster": "",
            "hunter": "",
            "service_name": "",
            "incident_description": "",
            "success_criteria": "",
            "reward": 0,
            "status": "open",
            "repro_steps": "",
            "evidence": "",
            "notes": "",
            "verdict": "",
            "verdict_reason": "",
            "hunter_share_bps": 0,
            "poster_refund_bps": 10000,
            "credited": False,
            "dispute_notes": "",
        }

    @gl.public.write
    def post_flint(self, flint_id: str, service_name: str, incident_description: str, reward: int, success_criteria: str) -> None:
        data = self._all()
        assert len(flint_id) > 0, "flint_id required"
        assert flint_id not in data, "flint already exists"
        assert reward >= 0, "reward must be >= 0"
        record = self._empty_record()
        record["poster"] = self._sender()
        record["service_name"] = service_name
        record["incident_description"] = incident_description
        record["success_criteria"] = success_criteria
        record["reward"] = reward
        record["status"] = "open"
        self._put(flint_id, record)

    @gl.public.write
    def claim_flint(self, flint_id: str) -> None:
        data = self._all()
        assert flint_id in data, "flint not found"
        record = data[flint_id]
        sender = self._sender()
        assert record["status"] == "open", "flint is not open"
        assert self._norm_addr(sender) != self._norm_addr(record["poster"]), "poster cannot claim their own flint"
        record["hunter"] = sender
        record["status"] = "claimed"
        self._put(flint_id, record)

    @gl.public.write
    def submit_spark(self, flint_id: str, repro_steps: str, evidence: str, notes: str) -> None:
        data = self._all()
        assert flint_id in data, "flint not found"
        record = data[flint_id]
        sender = self._sender()
        assert self._norm_addr(sender) == self._norm_addr(record["hunter"]), "only the assigned hunter can submit a spark"
        record["repro_steps"] = repro_steps
        record["evidence"] = evidence
        record["notes"] = notes
        record["status"] = "under_review"
        record["verdict"] = ""
        record["verdict_reason"] = ""
        self._put(flint_id, record)

    def _verdict_prompt(self, record: dict) -> str:
        return (
            "You are a GenLayer validator judging an incident reproduction. "
            "Incident: " + record.get("incident_description", "") + " "
            "Success criteria: " + record.get("success_criteria", "") + " "
            "Hunter notes: " + record.get("notes", "") + " "
            "Reproduction steps: " + record.get("repro_steps", "") + " "
            "Evidence: " + record.get("evidence", "") + " "
            "IGNITED if the spark faithfully reproduces the incident. "
            "DEAD if it does not match the incident or the criteria. "
            "SMOULDER if the reproduction is incomplete. "
            "Respond with exactly one word: IGNITED, SMOULDER, or DEAD."
        )

    @gl.public.write
    def submit_verdict(self, flint_id: str) -> None:
        data = self._all()
        assert flint_id in data, "flint not found"
        record = data[flint_id]
        assert record["status"] in ("under_review", "disputed", "claimed"), "nothing to judge"
        assert len(record.get("repro_steps", "")) > 0, "no spark submitted"
        prompt = self._verdict_prompt(record)

        def get_verdict() -> str:
            raw = gl.nondet.exec_prompt(prompt)
            text = str(raw).strip().upper()
            for word in VERDICT_WORDS:
                if word in text:
                    return word
            return "DEAD"

        verdict = gl.eq_principle.prompt_comparative(
            get_verdict,
            "the one-word verdict (IGNITED, SMOULDER, or DEAD) must be exactly the same.",
        )
        record["verdict"] = verdict
        record["verdict_reason"] = "validator_consensus"
        if verdict == "IGNITED":
            record["status"] = "settled"
            record["hunter_share_bps"] = 10000
            record["poster_refund_bps"] = 0
        elif verdict == "SMOULDER":
            record["status"] = "settled"
            record["hunter_share_bps"] = 7000
            record["poster_refund_bps"] = 3000
        else:
            record["status"] = "rejected"
            record["hunter_share_bps"] = 0
            record["poster_refund_bps"] = 10000

        if not record.get("credited", False):
            reward = int(record.get("reward", 0))
            hunter_amount = reward * record["hunter_share_bps"] // 10000
            poster_amount = reward * record["poster_refund_bps"] // 10000
            if record.get("hunter", "") != "":
                self._credit(record["hunter"], hunter_amount)
            self._credit(record["poster"], poster_amount)
            record["credited"] = True

        self._put(flint_id, record)

    @gl.public.write
    def raise_dispute(self, flint_id: str, notes: str) -> None:
        data = self._all()
        assert flint_id in data, "flint not found"
        record = data[flint_id]
        sender = self._sender()
        assert self._norm_addr(sender) in (self._norm_addr(record["poster"]), self._norm_addr(record["hunter"])), "only parties"
        assert record["status"] in ("settled", "rejected"), "no verdict to dispute"
        record["status"] = "disputed"
        record["dispute_notes"] = notes
        self._put(flint_id, record)

    @gl.public.view
    def get_flint(self, flint_id: str) -> str:
        data = self._all()
        if flint_id not in data:
            return "{}"
        return json.dumps(data[flint_id])

    @gl.public.view
    def list_flint_ids(self) -> str:
        return json.dumps(list(self._all().keys()))

    @gl.public.view
    def list_flints(self) -> str:
        return self.flints_json

    @gl.public.view
    def get_credit(self, address: str) -> int:
        credits = self._all_credits()
        key = self._norm_addr(address)
        if key in credits:
            return int(credits[key])
        return 0

    @gl.public.view
    def get_owner(self) -> str:
        return self.owner
