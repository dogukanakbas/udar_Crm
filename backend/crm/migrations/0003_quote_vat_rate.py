from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0002_contact"),
    ]

    operations = [
        migrations.AddField(
            model_name="quote",
            name="vat_rate",
            field=models.DecimalField(decimal_places=2, default=Decimal("20"), max_digits=5),
        ),
    ]
