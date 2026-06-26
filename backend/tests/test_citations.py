import uuid

from app.services.citations import CitationEvidence, is_supported_ref, verify_citations


def test_verify_citations_supports_only_existing_correctly_typed_refs() -> None:
    skill_id = uuid.uuid4()
    experience_id = uuid.uuid4()
    project_id = uuid.uuid4()
    wrong_type_id = uuid.uuid4()
    evidence = CitationEvidence(
        skill_ids={skill_id},
        experience_ids={experience_id},
        project_ids={project_id, wrong_type_id},
        job_fields={"requirements", "text.fulltext"},
    )

    result = verify_citations(
        [
            {"claim": "Candidate knows Python.", "evidence_ref": f"skill:{skill_id}"},
            {"claim": "Candidate led delivery.", "evidence_ref": f"experience:{uuid.uuid4()}"},
            {"claim": "Wrong source type.", "evidence_ref": f"skill:{wrong_type_id}"},
            {"claim": "Model self-reported unsupported.", "evidence_ref": "UNSUPPORTED"},
            {"claim": "Malformed ref.", "evidence_ref": "skill:not-a-uuid"},
            {"claim": "Job requirement exists.", "evidence_ref": "job:requirements"},
            {"claim": "Unknown job field.", "evidence_ref": "job:salary"},
        ],
        evidence,
    )

    assert [citation.status for citation in result.citations] == [
        "SUPPORTED",
        "UNSUPPORTED",
        "UNSUPPORTED",
        "UNSUPPORTED",
        "UNSUPPORTED",
        "SUPPORTED",
        "UNSUPPORTED",
    ]
    assert result.has_unsupported is True


def test_supported_ref_checks_existence_not_semantic_truth() -> None:
    skill_id = uuid.uuid4()
    evidence = CitationEvidence(skill_ids={skill_id})

    assert is_supported_ref(f"skill:{skill_id}", evidence) is True
