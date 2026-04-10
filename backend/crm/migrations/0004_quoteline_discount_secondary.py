from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0003_contract_fields'),
        ('crm', '0003_quote_vat_rate'),
    ]

    operations = [
        migrations.AddField(
            model_name='quoteline',
            name='discount_secondary',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
    ]
