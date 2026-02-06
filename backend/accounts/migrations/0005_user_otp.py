from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_notification_prefs'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='otp_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='otp_secret',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
    ]

