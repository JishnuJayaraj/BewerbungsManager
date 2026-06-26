"""Create initial schema.

Revision ID: 20260626_0001
Revises:
Create Date: 2026-06-26
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260626_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)

    op.create_table(
        "profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=True),
        sa.Column("headline", sa.String(), nullable=True),
        sa.Column("seniority", sa.String(), nullable=True),
        sa.Column("years_exp", sa.Integer(), nullable=True),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column("locations", sa.JSON(), nullable=False),
        sa.Column("preferences", sa.JSON(), nullable=False),
        sa.Column("brief_defaults", sa.JSON(), nullable=False),
        sa.Column("raw_cv_text", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_profiles_user_id"),
    )
    op.create_index(op.f("ix_profiles_user_id"), "profiles", ["user_id"], unique=False)

    op.create_table(
        "applications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_uuid", sa.String(), nullable=False),
        sa.Column("job_snapshot", sa.JSON(), nullable=False),
        sa.Column("job_title", sa.String(), nullable=False),
        sa.Column("company", sa.String(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "CLOSED", name="applicationstatus"),
            nullable=False,
        ),
        sa.Column("board_order", sa.Integer(), nullable=False),
        sa.Column("contact", sa.JSON(), nullable=False),
        sa.Column("next_action", sa.String(), nullable=True),
        sa.Column("followup_date", sa.Date(), nullable=True),
        sa.Column("needs_followup", sa.Boolean(), nullable=False),
        sa.Column("applied_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "job_uuid", name="uq_applications_user_job"),
    )
    op.create_index(op.f("ix_applications_job_uuid"), "applications", ["job_uuid"], unique=False)
    op.create_index(op.f("ix_applications_user_id"), "applications", ["user_id"], unique=False)

    op.create_table(
        "search_presets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("query_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_search_presets_user_id"), "search_presets", ["user_id"], unique=False)

    op.create_table(
        "skills",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum("IT_SKILL", "SOFT_SKILL", "LANGUAGE", "CERT", name="skillkind"),
            nullable=False,
        ),
        sa.Column("level", sa.String(), nullable=True),
        sa.Column("source", sa.Enum("CV", "MANUAL", name="profileentrysource"), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_skills_name"), "skills", ["name"], unique=False)
    op.create_index(op.f("ix_skills_profile_id"), "skills", ["profile_id"], unique=False)
    op.create_index(op.f("ix_skills_user_id"), "skills", ["user_id"], unique=False)

    op.create_table(
        "experiences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("company", sa.String(), nullable=True),
        sa.Column("start", sa.Date(), nullable=True),
        sa.Column("end", sa.Date(), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column("bullets", sa.JSON(), nullable=False),
        sa.Column("tech", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_experiences_profile_id"), "experiences", ["profile_id"], unique=False)
    op.create_index(op.f("ix_experiences_user_id"), "experiences", ["user_id"], unique=False)

    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column("tech", sa.JSON(), nullable=False),
        sa.Column("links", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_profile_id"), "projects", ["profile_id"], unique=False)
    op.create_index(op.f("ix_projects_user_id"), "projects", ["user_id"], unique=False)

    op.create_table(
        "application_briefs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("target_angle", sa.String(), nullable=True),
        sa.Column("emphasize", sa.JSON(), nullable=False),
        sa.Column("avoid", sa.String(), nullable=True),
        sa.Column("tone", sa.String(), nullable=True),
        sa.Column("language", sa.Enum("DE", "EN", name="brieflanguage"), nullable=False),
        sa.Column("company_motivation", sa.String(), nullable=True),
        sa.Column("user_notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id", name="uq_application_briefs_application_id"),
    )
    op.create_index(
        op.f("ix_application_briefs_application_id"),
        "application_briefs",
        ["application_id"],
        unique=False,
    )
    op.create_index(op.f("ix_application_briefs_user_id"), "application_briefs", ["user_id"], unique=False)

    op.create_table(
        "generated_artifacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "COVER_LETTER",
                "CV_BULLET_SUGGESTIONS",
                "FIT_ANALYSIS",
                "PORTAL_ANSWER",
                "ANSWER_DRAFT",
                name="artifactkind",
            ),
            nullable=False,
        ),
        sa.Column("content", sa.JSON(), nullable=True),
        sa.Column("citations", sa.JSON(), nullable=False),
        sa.Column("has_unsupported", sa.Boolean(), nullable=False),
        sa.Column("inputs_snapshot", sa.JSON(), nullable=False),
        sa.Column("model_used", sa.String(), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_generated_artifacts_application_id"),
        "generated_artifacts",
        ["application_id"],
        unique=False,
    )
    op.create_index(op.f("ix_generated_artifacts_user_id"), "generated_artifacts", ["user_id"], unique=False)

    op.create_table(
        "requirement_checks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("requirement", sa.String(), nullable=False),
        sa.Column("status", sa.Enum("HAVE", "PARTIAL", "MISSING", name="requirementstatus"), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("user_override", sa.Enum("HAVE", "PARTIAL", "MISSING", name="requirementstatus"), nullable=True),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_requirement_checks_application_id"),
        "requirement_checks",
        ["application_id"],
        unique=False,
    )
    op.create_index(op.f("ix_requirement_checks_user_id"), "requirement_checks", ["user_id"], unique=False)

    op.create_table(
        "package_checklists",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("salary_expectation", sa.String(), nullable=True),
        sa.Column("earliest_start_date", sa.Date(), nullable=True),
        sa.Column("language_level_required", sa.String(), nullable=True),
        sa.Column("language_level_user", sa.String(), nullable=True),
        sa.Column(
            "work_permit_status",
            sa.Enum(
                "NOT_RELEVANT",
                "EU_CITIZEN",
                "HAVE_PERMIT",
                "NEED_SPONSORSHIP",
                "UNKNOWN",
                name="workpermitstatus",
            ),
            nullable=False,
        ),
        sa.Column("certificates_ready", sa.Boolean(), nullable=False),
        sa.Column("cover_letter_required", sa.Boolean(), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id", name="uq_package_checklists_application_id"),
    )
    op.create_index(
        op.f("ix_package_checklists_application_id"),
        "package_checklists",
        ["application_id"],
        unique=False,
    )
    op.create_index(op.f("ix_package_checklists_user_id"), "package_checklists", ["user_id"], unique=False)

    op.create_table(
        "comms_log_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.Enum("EMAIL", "CALL", "NOTE", "EVENT", name="commskind"), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("subject", sa.String(), nullable=True),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("direction", sa.Enum("INBOUND", "OUTBOUND", "NONE", name="commsdirection"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_comms_log_entries_application_id"),
        "comms_log_entries",
        ["application_id"],
        unique=False,
    )
    op.create_index(op.f("ix_comms_log_entries_user_id"), "comms_log_entries", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_comms_log_entries_user_id"), table_name="comms_log_entries")
    op.drop_index(op.f("ix_comms_log_entries_application_id"), table_name="comms_log_entries")
    op.drop_table("comms_log_entries")
    op.drop_index(op.f("ix_package_checklists_user_id"), table_name="package_checklists")
    op.drop_index(op.f("ix_package_checklists_application_id"), table_name="package_checklists")
    op.drop_table("package_checklists")
    op.drop_index(op.f("ix_requirement_checks_user_id"), table_name="requirement_checks")
    op.drop_index(op.f("ix_requirement_checks_application_id"), table_name="requirement_checks")
    op.drop_table("requirement_checks")
    op.drop_index(op.f("ix_generated_artifacts_user_id"), table_name="generated_artifacts")
    op.drop_index(op.f("ix_generated_artifacts_application_id"), table_name="generated_artifacts")
    op.drop_table("generated_artifacts")
    op.drop_index(op.f("ix_application_briefs_user_id"), table_name="application_briefs")
    op.drop_index(op.f("ix_application_briefs_application_id"), table_name="application_briefs")
    op.drop_table("application_briefs")
    op.drop_index(op.f("ix_projects_user_id"), table_name="projects")
    op.drop_index(op.f("ix_projects_profile_id"), table_name="projects")
    op.drop_table("projects")
    op.drop_index(op.f("ix_experiences_user_id"), table_name="experiences")
    op.drop_index(op.f("ix_experiences_profile_id"), table_name="experiences")
    op.drop_table("experiences")
    op.drop_index(op.f("ix_skills_user_id"), table_name="skills")
    op.drop_index(op.f("ix_skills_profile_id"), table_name="skills")
    op.drop_index(op.f("ix_skills_name"), table_name="skills")
    op.drop_table("skills")
    op.drop_index(op.f("ix_search_presets_user_id"), table_name="search_presets")
    op.drop_table("search_presets")
    op.drop_index(op.f("ix_applications_user_id"), table_name="applications")
    op.drop_index(op.f("ix_applications_job_uuid"), table_name="applications")
    op.drop_table("applications")
    op.drop_index(op.f("ix_profiles_user_id"), table_name="profiles")
    op.drop_table("profiles")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
