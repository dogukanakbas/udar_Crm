# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_user_otp'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_superadmin',
            field=models.BooleanField(default=False, help_text='Platform owner/superadmin access'),
        ),
    ]
