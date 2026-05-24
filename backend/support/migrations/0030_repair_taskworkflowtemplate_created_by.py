from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0029_taskworkflowtemplate'),
    ]

    operations = [
        migrations.RunSQL(
            sql=r'''
DO $$
DECLARE
    column_was_missing boolean := false;
BEGIN
    IF to_regclass('public.support_taskworkflowtemplate') IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'support_taskworkflowtemplate'
          AND column_name = 'created_by_id'
    ) THEN
        ALTER TABLE "support_taskworkflowtemplate"
        ADD COLUMN "created_by_id" bigint NULL;
        column_was_missing := true;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.support_taskworkflowtemplate'::regclass
          AND c.contype = 'f'
          AND a.attname = 'created_by_id'
    ) THEN
        ALTER TABLE "support_taskworkflowtemplate"
        ADD CONSTRAINT "support_taskworkflowtemplate_created_by_id_fk"
        FOREIGN KEY ("created_by_id")
        REFERENCES "accounts_user" ("id")
        DEFERRABLE INITIALLY DEFERRED;
    END IF;

    IF column_was_missing AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'public.support_taskworkflowtemplate'::regclass
          AND a.attname = 'created_by_id'
    ) THEN
        CREATE INDEX "support_taskworkflowtemplate_created_by_id_idx"
        ON "support_taskworkflowtemplate" ("created_by_id");
    END IF;
END $$;
''',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
