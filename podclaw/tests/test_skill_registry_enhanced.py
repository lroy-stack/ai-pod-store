"""
PodClaw — Skill Registry Enhanced Tests (Phase 6.5)
=====================================================

Tests for Phase 3 additions: find_skills_for_pipeline_step(),
validate(), rescan().
"""

from __future__ import annotations

from pathlib import Path

import pytest

from podclaw.skill_registry import SkillRegistry


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def skills_dir(tmp_path: Path) -> Path:
    """Create a minimal skills directory structure."""
    # researcher with role + 2 task skills
    researcher_dir = tmp_path / "researcher"
    researcher_dir.mkdir()
    (researcher_dir / "ROLE.md").write_text("# Researcher\nResearch market trends.\n")

    tasks_dir = researcher_dir / "tasks"
    tasks_dir.mkdir()

    # Skill: market-research
    mr_dir = tasks_dir / "market-research"
    mr_dir.mkdir()
    (mr_dir / "SKILL.md").write_text(
        "<!-- triggers: market, trends, research, competitor -->\n"
        "<!-- description: Market research and trend analysis -->\n"
        "# Market Research\nAnalyze market trends.\n"
    )

    # Skill: keyword-analysis
    ka_dir = tasks_dir / "keyword-analysis"
    ka_dir.mkdir()
    (ka_dir / "SKILL.md").write_text(
        "<!-- triggers: keyword, seo, search -->\n"
        "<!-- description: SEO keyword analysis -->\n"
        "# Keyword Analysis\nAnalyze keywords.\n"
    )

    # designer with role + 1 task skill
    designer_dir = tmp_path / "designer"
    designer_dir.mkdir()
    (designer_dir / "ROLE.md").write_text("# Designer\nCreate product designs.\n")

    dtasks = designer_dir / "tasks"
    dtasks.mkdir()

    dtg_dir = dtasks / "dtg-design"
    dtg_dir.mkdir()
    (dtg_dir / "SKILL.md").write_text(
        "<!-- triggers: dtg, t-shirt, camiseta, hoodie -->\n"
        "<!-- description: DTG garment design pipeline -->\n"
        "# DTG Design\nDesign DTG products.\n"
    )
    (dtg_dir / "CANVAS_SPECS.md").write_text("# Canvas Specs\nSpecs reference.\n")

    return tmp_path


@pytest.fixture()
def registry(skills_dir: Path) -> SkillRegistry:
    return SkillRegistry(skills_dir)


# ---------------------------------------------------------------------------
# find_skills_for_pipeline_step
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_find_skills_for_pipeline_step_returns_ranked(registry):
    """Multiple trigger matches produce ranked results."""
    results = registry.find_skills_for_pipeline_step(
        "researcher",
        "Research market trends and competitor pricing",
    )
    assert len(results) >= 1
    # market-research should score highest (matches: market, trends, research, competitor)
    assert results[0][0] == "market-research"
    assert results[0][1] >= 3


@pytest.mark.unit
def test_find_skills_for_pipeline_step_no_match(registry):
    """No matching triggers returns empty list."""
    results = registry.find_skills_for_pipeline_step(
        "researcher",
        "Calculate financial quarterly report",
    )
    assert results == []


@pytest.mark.unit
def test_find_skills_for_pipeline_step_uses_pipeline_context(registry):
    """Pipeline context keywords contribute to scoring."""
    # Without context: "keyword" matches keyword-analysis
    results_no_ctx = registry.find_skills_for_pipeline_step(
        "researcher",
        "Analyze keywords",
    )
    # With context: adding "seo search" should boost keyword-analysis
    results_with_ctx = registry.find_skills_for_pipeline_step(
        "researcher",
        "Analyze keywords",
        pipeline_context="seo search optimization",
    )
    # keyword-analysis should match in both, but score higher with context
    assert len(results_with_ctx) >= 1
    assert results_with_ctx[0][0] == "keyword-analysis"
    if results_no_ctx:
        assert results_with_ctx[0][1] >= results_no_ctx[0][1]


# ---------------------------------------------------------------------------
# validate
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_validate_no_warnings(registry):
    """Clean skill directory produces no warnings."""
    warnings = registry.validate()
    assert warnings == []


@pytest.mark.unit
def test_validate_missing_skill_md(skills_dir):
    """Task dir without SKILL.md produces a warning."""
    empty_task = skills_dir / "researcher" / "tasks" / "empty-skill"
    empty_task.mkdir()

    registry = SkillRegistry(skills_dir)
    warnings = registry.validate()
    assert any("missing SKILL.md" in w for w in warnings)


@pytest.mark.unit
def test_validate_missing_triggers(skills_dir):
    """SKILL.md without triggers frontmatter produces a warning."""
    no_triggers = skills_dir / "researcher" / "tasks" / "no-triggers"
    no_triggers.mkdir()
    (no_triggers / "SKILL.md").write_text("# No Triggers\nJust content.\n")

    registry = SkillRegistry(skills_dir)
    warnings = registry.validate()
    assert any("missing <!-- triggers:" in w for w in warnings)


# ---------------------------------------------------------------------------
# rescan
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_rescan_picks_up_new_skill(skills_dir, registry):
    """Adding a new skill file and rescanning discovers it."""
    # Initially, researcher has 2 task skills
    initial = registry.list_skills("researcher")
    initial_tasks = [s for s in initial if s.skill_type == "task"]

    # Add new skill
    new_dir = skills_dir / "researcher" / "tasks" / "price-analysis"
    new_dir.mkdir()
    (new_dir / "SKILL.md").write_text(
        "<!-- triggers: price, pricing, cost -->\n"
        "# Price Analysis\nAnalyze pricing.\n"
    )

    registry.rescan()

    updated = registry.list_skills("researcher")
    updated_tasks = [s for s in updated if s.skill_type == "task"]
    assert len(updated_tasks) == len(initial_tasks) + 1
    names = [s.skill_name for s in updated_tasks]
    assert "price-analysis" in names


@pytest.mark.unit
def test_rescan_removes_deleted_skill(skills_dir, registry):
    """Deleting a skill file and rescanning removes it."""
    import shutil

    initial = registry.list_skills("researcher")
    initial_tasks = [s for s in initial if s.skill_type == "task"]

    # Delete keyword-analysis
    shutil.rmtree(skills_dir / "researcher" / "tasks" / "keyword-analysis")

    registry.rescan()

    updated = registry.list_skills("researcher")
    updated_tasks = [s for s in updated if s.skill_type == "task"]
    assert len(updated_tasks) == len(initial_tasks) - 1
    names = [s.skill_name for s in updated_tasks]
    assert "keyword-analysis" not in names
