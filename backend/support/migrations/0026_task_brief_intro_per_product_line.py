# Generated migration — brief_intro görev kökünden product_lines satırlarına taşınır.

from django.db import migrations


def migrate_brief_intro_to_lines(apps, schema_editor):
    Task = apps.get_model('support', 'Task')
    for t in Task.objects.all():
        intro = (getattr(t, 'brief_intro', None) or '').strip()
        if not intro:
            continue
        intro = intro[:600]
        lines = list(t.product_lines or [])
        if lines:
            row = dict(lines[0] or {})
            existing = (row.get('brief_intro') or row.get('briefIntro') or '').strip()
            if not existing:
                row['brief_intro'] = intro
            lines[0] = row
            t.product_lines = lines
        else:
            try:
                q = max(1, int(t.quantity or 1))
            except (TypeError, ValueError):
                q = 1
            try:
                mdur = float(t.model_duration_minutes or 0)
            except (TypeError, ValueError):
                mdur = 0.0
            try:
                tpm = float(t.total_planned_minutes or 0)
            except (TypeError, ValueError):
                tpm = round(mdur * q, 2) if mdur else 0.0
            t.product_lines = [
                {
                    'mode': t.mode if t.mode in ('manual', 'fixed') else 'manual',
                    'model_code': t.model_code or '',
                    'variant': t.variant or '',
                    'quantity': q,
                    'model_duration_minutes': mdur,
                    'total_planned_minutes': tpm,
                    'model_blade_depth': t.model_blade_depth or '',
                    'model_sizes': list(t.model_sizes or []),
                    'product_color': t.product_color or '',
                    'product_color_code': t.product_color_code or '',
                    'brief_intro': intro,
                }
            ]
        t.save(update_fields=['product_lines'])


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0025_task_brief_intro'),
    ]

    operations = [
        migrations.RunPython(migrate_brief_intro_to_lines, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='task',
            name='brief_intro',
        ),
    ]
