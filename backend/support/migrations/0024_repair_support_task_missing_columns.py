"""
Repair drift where django_migrations lists Task migrations as applied but
support_task is missing columns (e.g. partial DB restore or manual changes).

Idempotent: only adds columns/constraints/indexes that are absent (PostgreSQL).
"""

from django.db import connection, migrations


def _pg_columns(table: str) -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            """,
            [table],
        )
        return {row[0] for row in cursor.fetchall()}


def _index_exists(name: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = %s",
            [name],
        )
        return cursor.fetchone() is not None


def repair_support_task(apps, schema_editor):
    if connection.vendor != 'postgresql':
        return

    cols = _pg_columns('support_task')

    stmts = []

    if 'assignee_id' not in cols:
        stmts.append(
            """
            ALTER TABLE support_task
            ADD COLUMN assignee_id bigint NULL
            CONSTRAINT support_task_assignee_id_repair_fk
            REFERENCES accounts_user(id) DEFERRABLE INITIALLY DEFERRED
            """
        )
    if 'mode' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN mode varchar(20) NOT NULL DEFAULT 'manual'"
        )
    if 'model_code' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN model_code varchar(50) NOT NULL DEFAULT ''"
        )
    if 'variant' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN variant varchar(50) NOT NULL DEFAULT ''"
        )
    if 'quantity' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN quantity integer NOT NULL DEFAULT 1"
        )
        stmts.append(
            "ALTER TABLE support_task ADD CONSTRAINT support_task_quantity_repair_nonneg "
            "CHECK (quantity >= 0)"
        )
    if 'model_duration_minutes' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN model_duration_minutes numeric(8, 2) NOT NULL DEFAULT 0"
        )
    if 'total_planned_minutes' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN total_planned_minutes numeric(10, 2) NOT NULL DEFAULT 0"
        )
    if 'model_blade_depth' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN model_blade_depth varchar(50) NOT NULL DEFAULT ''"
        )
    if 'model_sizes' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN model_sizes jsonb NOT NULL DEFAULT '[]'::jsonb"
        )
    if 'product_color' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN product_color varchar(100) NOT NULL DEFAULT ''"
        )
    if 'product_color_code' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN product_color_code varchar(80) NOT NULL DEFAULT ''"
        )
    if 'planned_hours' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN planned_hours numeric(8, 2) NOT NULL DEFAULT 0"
        )
    if 'planned_cost' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN planned_cost numeric(12, 2) NOT NULL DEFAULT 0"
        )
    if 'current_team_id' not in cols:
        stmts.append(
            """
            ALTER TABLE support_task
            ADD COLUMN current_team_id bigint NULL
            CONSTRAINT support_task_current_team_id_repair_fk
            REFERENCES accounts_team(id) DEFERRABLE INITIALLY DEFERRED
            """
        )
    if 'workflow_team_ids' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN workflow_team_ids jsonb NOT NULL DEFAULT '[]'::jsonb"
        )
    if 'workflow_parallel' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN workflow_parallel boolean NOT NULL DEFAULT false"
        )
    if 'workflow_stage_targets' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN workflow_stage_targets jsonb NOT NULL DEFAULT '[]'::jsonb"
        )
    if 'workflow_stage_state' not in cols:
        stmts.append(
            "ALTER TABLE support_task ADD COLUMN workflow_stage_state jsonb NOT NULL DEFAULT '{}'::jsonb"
        )

    with connection.cursor() as cursor:
        for sql in stmts:
            cursor.execute(sql)

    cols_after = _pg_columns('support_task')
    with connection.cursor() as cursor:
        if 'assignee_id' in cols_after and not _index_exists('support_task_assignee_id_repair_idx'):
            cursor.execute(
                "CREATE INDEX support_task_assignee_id_repair_idx ON support_task (assignee_id)"
            )
        if 'current_team_id' in cols_after and not _index_exists(
            'support_task_current_team_id_repair_idx'
        ):
            cursor.execute(
                "CREATE INDEX support_task_current_team_id_repair_idx ON support_task (current_team_id)"
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0023_task_product_lines'),
    ]

    operations = [
        migrations.RunPython(repair_support_task, noop_reverse),
    ]
