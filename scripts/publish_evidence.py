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
    presentation_path = ROOT / "evidence/site-presentation-report.json"
    presentation = read("evidence/site-presentation-report.json") if presentation_path.exists() else None
    if manifest.get("site_assets_sha256"):
        checks["presentation_passed"] = (
            presentation is not None
            and presentation.get("completed") is True
            and not presentation.get("errors")
            and bool(presentation.get("checks"))
            and all(value is True for value in presentation["checks"].values())
        )
        checks["presentation_assets_match"] = presentation is not None and all(
            presentation.get("source_sha256", {}).get(name) == value
            for name, value in manifest["site_assets_sha256"].items()
        )
    guided_path = ROOT / "evidence/guided-report.json"
    guided = read("evidence/guided-report.json") if guided_path.exists() else None
    if "guiado.html" in manifest["frontend_sha256"]:
        checks["guided_view_passed"] = (
            guided is not None and guided.get("completed") is True
            and not guided.get("errors") and bool(guided.get("checks"))
            and all(value is True for value in guided["checks"].values())
        )
        checks["guided_view_build_matches"] = guided is not None and all(
            guided.get("build", {}).get(key) == manifest.get(key)
            for key in ("core_sha256", "bridge_sha256", "base_zip_sha256", "frontend_sha256", "files")
        )
    smoke_path = ROOT / "evidence/public-smoke.json"
    smoke = read("evidence/public-smoke.json") if smoke_path.exists() else None
    smoke_matches = smoke is not None and all(
        smoke["build"].get(key) == manifest.get(key)
        for key in ("core_sha256", "bridge_sha256", "base_zip_sha256", "frontend_sha256", "site_assets_sha256")
    )
    if smoke_matches:
        checks["public_smoke_passed"] = (
            smoke.get("completed") is True
            and smoke.get("execution_target") == "PUBLIC_SITE"
            and not smoke.get("errors")
            and bool(smoke.get("checks"))
            and all(value is True for value in smoke["checks"].values())
        )
        checks["public_smoke_build_matches"] = True
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
        "public_smoke_status": "VERIFIED_CURRENT_BUILD" if smoke_matches else "PENDING_FOR_CURRENT_BUILD",
    }
    target = ROOT / "web/evidence"
    target.mkdir(exist_ok=True)
    reports = ["technical-report.json", "reasoner-report.json", "regression-report.json", "browser-report.json", "browser-baseline-report.json", "parity-report.json", "public-projection.json", "public-content-audit.json", "distribution-audit.json", "build-manifest.json"]
    baseline = browser.get("change_verification", {}).get("baseline_report")
    if baseline and Path(baseline).name == baseline and baseline not in reports:
        reports.append(baseline)
    if presentation is not None:
        reports.append("site-presentation-report.json")
        summary["results"]["presentation_checks"] = presentation["checks"]
    if guided is not None:
        reports.append("guided-report.json")
        summary["results"]["guided_view_checks"] = guided["checks"]
    guided_public_path = ROOT / "evidence/guided-public-report.json"
    if guided_public_path.exists():
        guided_public = read("evidence/guided-public-report.json")
        reports.append("guided-public-report.json")
        guided_public_current = all(
            guided_public.get("build", {}).get(key) == manifest.get(key)
            for key in ("core_sha256", "bridge_sha256", "base_zip_sha256", "frontend_sha256", "site_assets_sha256")
        )
        summary["guided_public_status"] = (
            "VERIFIED_CURRENT_BUILD" if guided_public_current
            and guided_public.get("completed") is True
            and not guided_public.get("errors")
            and bool(guided_public.get("checks"))
            and all(value is True for value in guided_public["checks"].values())
            else "NOT_VERIFIED_CURRENT_BUILD"
        )
    if smoke is not None:
        reports.append("public-smoke.json")
        if smoke_matches:
            summary["results"]["public_smoke_checks"] = smoke["checks"]
        else:
            summary["historical_public_smoke"] = {
                "report": "public-smoke.json",
                "reason": "The recorded smoke tested an earlier build; not evidence for the current presentation.",
            }
    for name in reports:
        path = ROOT / "evidence" / name
        summary["reports"][name] = {"sha256": digest(path), "url": name}
        (target / name).write_bytes(path.read_bytes())
    (target / "report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"version": summary["version"], "checks_passed": len(checks), "public_report": "web/evidence/report.json"}))


if __name__ == "__main__":
    main()
