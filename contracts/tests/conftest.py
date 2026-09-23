import importlib.util
import os
import sys
import types

import pytest

CONTRACT_PATH = os.path.join(os.path.dirname(__file__), "..", "flintmill_contract.py")


class UserError(Exception):
    def __init__(self, data):
        super().__init__(data)
        self.data = data


class Response:
    def __init__(self, status, body):
        self.status = status
        self.body = body


class World:
    def __init__(self):
        self.sender = "0xowner"
        self.web = {}
        self.llm_answers = []
        self.prompts = []
        self.web_requests = []

    def request(self, url, method="GET"):
        self.web_requests.append((url, method))
        if url not in self.web:
            return Response(404, None)
        return Response(200, self.web[url])

    def exec_prompt(self, prompt):
        self.prompts.append(prompt)
        if not self.llm_answers:
            raise AssertionError("unexpected LLM call")
        return self.llm_answers.pop(0)


def build_genlayer_stub(world):
    genlayer = types.ModuleType("genlayer")
    genlayer_types = types.ModuleType("genlayer.types")
    genlayer_types.__all__ = []

    class Contract:
        pass

    def identity(fn):
        return fn

    genlayer.contract = types.SimpleNamespace(Contract=Contract)
    genlayer.public = types.SimpleNamespace(write=identity, view=identity)
    genlayer.vm = types.SimpleNamespace(UserError=UserError)

    class Message:
        @property
        def sender_address(self):
            return world.sender

    genlayer.message = Message()
    genlayer.nondet = types.SimpleNamespace(
        web=types.SimpleNamespace(request=world.request),
        exec_prompt=world.exec_prompt,
    )
    genlayer.eq_principle = types.SimpleNamespace(
        prompt_comparative=lambda fn, principle: fn(),
    )
    genlayer.types = genlayer_types
    return genlayer, genlayer_types


@pytest.fixture
def world():
    return World()


@pytest.fixture
def module(world):
    genlayer, genlayer_types = build_genlayer_stub(world)
    saved = {name: sys.modules.get(name) for name in ("genlayer", "genlayer.types")}
    sys.modules["genlayer"] = genlayer
    sys.modules["genlayer.types"] = genlayer_types
    spec = importlib.util.spec_from_file_location("flintmill_contract_under_test", CONTRACT_PATH)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    yield loaded
    for name, value in saved.items():
        if value is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = value


@pytest.fixture
def contract(module, world):
    world.sender = "0xOwner"
    return module.Flintmill()
