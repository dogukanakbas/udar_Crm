from django.db import migrations, models


def normalize_quote_statuses(apps, schema_editor):
    Quote = apps.get_model('crm', 'Quote')
    Quote.objects.filter(status__in=['Draft', 'Sent', 'Under Review', 'Converted']).update(status='Pending')
    Quote.objects.exclude(status__in=['Pending', 'Approved', 'Rejected']).update(status='Pending')


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0008_alter_quote_options_businesspartner_owner'),
    ]

    operations = [
        migrations.RunPython(normalize_quote_statuses, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='quote',
            name='status',
            field=models.CharField(
                choices=[
                    ('Pending', 'Pending'),
                    ('Approved', 'Approved'),
                    ('Rejected', 'Rejected'),
                ],
                default='Pending',
                max_length=20,
            ),
        ),
    ]
