import pytest

from app.core.config import settings
from app.services.github import _aggregate


@pytest.fixture(autouse=True)
def _required_checks(monkeypatch):
    monkeypatch.setattr(settings, "REQUIRED_CI_CHECKS", "Lint,Typecheck,Test Backend")


ALL_REQUIRED_GREEN = {
    "Lint": "success",
    "Typecheck": "success",
    "Test Backend": "success",
}


def test_pr45_scenario_is_not_mergeable():
    """The real state of PR #45: two green Vercel deployments, one Vercel check
    run, and no CI at all — because the CI workflow was disabled_manually. The
    old gate read this as 'success' and merged a 6 MB zero-padded image."""
    checks = {
        "Vercel – cba-website": "success",
        "Vercel – cba-ops-frontend": "success",
        "Vercel Preview Comments": "success",
    }

    assert _aggregate(checks) == "missing_checks"


def test_all_required_green_is_success():
    assert _aggregate(ALL_REQUIRED_GREEN) == "success"


def test_required_green_plus_green_deployments_is_success():
    assert _aggregate({**ALL_REQUIRED_GREEN, "Vercel – cba-website": "success"}) == "success"


def test_one_required_missing_blocks():
    checks = dict(ALL_REQUIRED_GREEN)
    del checks["Typecheck"]

    assert _aggregate(checks) == "missing_checks"


def test_failing_required_check_is_failure():
    assert _aggregate({**ALL_REQUIRED_GREEN, "Lint": "failure"}) == "failure"


def test_pending_required_check_is_pending():
    assert _aggregate({**ALL_REQUIRED_GREEN, "Test Backend": "pending"}) == "pending"


def test_failure_outranks_pending():
    checks = {**ALL_REQUIRED_GREEN, "Lint": "pending", "Typecheck": "failure"}

    assert _aggregate(checks) == "failure"


def test_failing_deployment_blocks_even_when_ci_is_green():
    """A broken preview deploy is worth stopping on — the reviewer is about to
    approve something they judged from that preview."""
    checks = {**ALL_REQUIRED_GREEN, "Vercel – cba-website": "failure"}

    assert _aggregate(checks) == "failure"


def test_missing_outranks_failure():
    """Absence is reported ahead of failure so the reviewer is told CI never
    ran, rather than chasing a failing check that is not the real problem."""
    checks = {"Lint": "failure"}

    assert _aggregate(checks) == "missing_checks"


def test_no_checks_at_all_blocks_when_checks_are_required():
    """A PR with nothing reported is unverified, not merely early."""
    assert _aggregate({}) == "missing_checks"


def test_empty_required_list_falls_back_to_observed_checks(monkeypatch):
    monkeypatch.setattr(settings, "REQUIRED_CI_CHECKS", "")

    assert _aggregate({"Vercel – cba-website": "success"}) == "success"
    assert _aggregate({}) is None


def test_required_list_is_parsed_and_trimmed(monkeypatch):
    monkeypatch.setattr(settings, "REQUIRED_CI_CHECKS", " Lint , Test Backend ,")

    assert settings.required_ci_checks == ["Lint", "Test Backend"]
