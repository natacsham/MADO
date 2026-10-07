"""Collect version-matched technical evidence; never synthesize human results."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    technical = read("evidence/technical-report.json")
    reasoner = read("evidence/reasoner-report.json")
    regression = read("evidence/regression-report.json")
    browser = read("evidence/browser-report.json")
    parity = read("evidence/parity-report.json")
    distribution = read("evidence/distribution-audit.json")
    manifest = read("web/amado/manifest.json")
    checks = {
        "technical_passed": technical.get("passed") is True,
        "technical_engine_matches": technical["source_sha256"]["engine.py"] == digest(ROOT / "engine.py"),
        "web_engine_matches_native": manifest["core_sha256"] == digest(ROOT / "engine.py"),
        "reasoner_passed": reasoner.get("passed") is True,
        "reasoner_graph_matches": reasoner["input_sha256"] == digest(ROOT / "ontology/mado-combined.ttl"),
        "regression_passed": all(regression["checks"].values()),
        "regression_base_matches": regression["base_sha256"]["knowledge-base.json"] == digest(ROOT / "data/knowledge-base.json"),
        "browser_completed": browser.get("completed") is True and not browser.get("errors"),
        "browser_engine_matches": browser["build"]["core_sha256"] == manifest["core_sha256"],
        "browser_bridge_matches": browser["build"]["bridge_sha256"] == manifest["bridge_sha256"],
        "browser_frontend_matches": browser["build"]["frontend_sha256"] == manifest["frontend_sha256"],
        "browser_base_matches": browser["build"]["base_zip_sha256"] == manifest["base_zip_sha256"],
        "parity_passed": parity.get("passed") is True,
        "distribution_passed": distribution.get("passed") is True,
    }
    if not all(checks.values()):
        raise SystemExit(json.dumps(checks, ensure_ascii=False))
    summary = {
        "version": "1.3.0-rc1",
        "instrument": "AMADO",
        "status": "TECHNICALLY_CHECKED_RELEASE_CANDIDATE",
        "compiled_at_utc": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "results": {
            "unit_tests": technical["checks"]["unittest"]["tests_run"],
            "ontology_triples": technical["graph_counts"]["triples"],
            "shacl": {key: technical["checks"]["public_base_shacl"][key] for key in ("violations", "warnings", "passed")},
            "runtime_shacl": {key: technical["checks"]["runtime_main_decision_shacl_and_queries"][key] for key in ("violations", "warnings", "passed")},
            "owl_2_dl": reasoner["profile_passed"],
            "hermit_consistency": reasoner["consistency_passed"],
            "runtime_query_rows": technical["checks"]["runtime_main_decision_shacl_and_queries"]["query_rows"],
            "regression_checks": regression["checks"],
            "browser_checks": browser["checks"],
            "parity": parity,
        },
        "limits": [
            "Esta revisão posterior não substitui a versão da tese nem sua avaliação humana.",
            "Os casos de regressão são sintéticos; não são logs ou pareceres da especialista.",
            "Sem prova de eficácia educacional, generalização ou interpretação irrestrita de narrativas.",
            "65 avisos documentais da base permanecem visíveis; não foram preenchidos artificialmente.",
            "NVDA e VoiceOver não avaliados; os testes não constituem conformidade WCAG integral.",
            "Textos protegidos não redistribuídos: a auditoria documental completa requer as fontes originais.",
        ],
        "reports": {},
    }
    target = ROOT / "web/evidence"
    target.mkdir(exist_ok=True)
    for name in ("technical-report.json", "reasoner-report.json", "regression-report.json", "browser-report.json", "browser-baseline-report.json", "parity-report.json", "public-projection.json", "public-content-audit.json", "distribution-audit.json", "build-manifest.json"):
        path = ROOT / "evidence" / name
        summary["reports"][name] = {"sha256": digest(path), "url": name}
        (target / name).write_bytes(path.read_bytes())
    (target / "report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"version": summary["version"], "checks_passed": len(checks), "public_report": "web/evidence/report.json"}))


if __name__ == "__main__":
    main()
