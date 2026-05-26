from django.db import migrations, models


DEFAULT_DOCUMENT_TERMS_TEXT = '\n'.join([
    '1- Alıcı özellikleri belirtilen ürünlerin satın alma şartlarını kabul eder.',
    '2- Satıcı onaylanan kalemlerin üretimini ve sevkini kabul eder.',
    '3- Onay sonrası teknik ve finansal değişiklikler yeni mutabakat gerektirir.',
    '4- Ödemesi tamamlanmayan siparişler üretime alınmayabilir.',
    '5- Mücbir sebepler kaynaklı gecikmelerde satıcı sorumlu tutulamaz.',
    '6- Teslimden sonra yazılı bildirim gelmezse ürünler eksiksiz kabul edilir.',
    '7- Alıcı gerekli vergi ve yetki belgelerini eksiksiz sunar.',
    '8- İmalat hataları garanti koşulları ve teknik şartname kapsamındadır.',
    '9- İhtilaflarda Malatya Mahkemeleri ve İcra Daireleri yetkilidir.',
])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0014_organizationsettings_service_expense_tax_rate'),
    ]

    operations = [
        migrations.AddField(
            model_name='organizationsettings',
            name='quote_terms_text',
            field=models.TextField(blank=True, default=DEFAULT_DOCUMENT_TERMS_TEXT),
        ),
        migrations.AddField(
            model_name='organizationsettings',
            name='contract_terms_text',
            field=models.TextField(blank=True, default=DEFAULT_DOCUMENT_TERMS_TEXT),
        ),
    ]
