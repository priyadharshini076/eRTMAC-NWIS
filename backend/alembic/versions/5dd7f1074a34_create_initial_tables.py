"""create initial tables

Revision ID: 5dd7f1074a34
Revises:
Create Date: 2026-09-25 17:23:24.188639
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2

# Revision identifiers
revision: str = "5dd7f1074a34"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create project tables."""

    # ==========================
    # wells_master
    # ==========================
    op.create_table(
        "wells_master",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("well_id", sa.String(), nullable=False, unique=True),
        sa.Column("well_name", sa.String()),
        sa.Column("api_number", sa.String()),
        sa.Column("field", sa.String()),
        sa.Column("district", sa.String()),
        sa.Column("formation", sa.String()),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column(
            "geom",
            geoalchemy2.Geometry(
                geometry_type="POINT",
                srid=4326
            )
        ),
        sa.Column("target_depth_m", sa.Float()),
        sa.Column("measured_depth_m", sa.Float()),
        sa.Column("true_vertical_depth_m", sa.Float()),
        sa.Column("rig_name", sa.String()),
        sa.Column("spud_date", sa.Date()),
        sa.Column("completion_date", sa.Date()),
        sa.Column("risk_zone", sa.String()),
        sa.Column("surface_casing", sa.String()),
    )


    # ==========================
    # daily_drilling_logs
    # ==========================
    op.create_table(
        "daily_drilling_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "well_id",
            sa.String(),
            sa.ForeignKey("wells_master.well_id")
        ),
        sa.Column("timestamp", sa.DateTime()),
        sa.Column("depth_m", sa.Float()),
        sa.Column("pressure_psi", sa.Float()),
        sa.Column("torque_kNm", sa.Float()),
        sa.Column("rpm", sa.Float()),
        sa.Column("mud_weight_ppg", sa.Float()),
        sa.Column("weight_on_bit_ton", sa.Float()),
        sa.Column("flow_rate_lpm", sa.Float()),
        sa.Column("event_label", sa.String()),
        sa.Column("alert_level", sa.String()),
    )

    # ==========================
    # documents
    # ==========================
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "well_id",
            sa.String(),
            sa.ForeignKey("wells_master.well_id")
        ),
        sa.Column("document_type", sa.String()),
        sa.Column("file_name", sa.String()),
        sa.Column("file_path", sa.String()),
        sa.Column("status", sa.String()),
    )

    # ==========================
    # drilling_events
    # ==========================
    op.create_table(
        "drilling_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "well_id",
            sa.String(),
            sa.ForeignKey("wells_master.well_id")
        ),
        sa.Column("event_date", sa.Date()),
        sa.Column("depth_m", sa.Float()),
        sa.Column("event_type", sa.String()),
        sa.Column("severity", sa.String()),
        sa.Column("formation", sa.String()),
        sa.Column("mitigation_action", sa.String()),
    )


def downgrade() -> None:
    """Remove project tables."""

    op.drop_table("drilling_events")
    op.drop_table("documents")
    op.drop_table("daily_drilling_logs")
    op.drop_table("wells_master")