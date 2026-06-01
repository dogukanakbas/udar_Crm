import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('organizations', '0005_warehouse_operational_fields'),
        ('erp', '0012_alter_product_reorder_point_alter_product_reserved_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.AddField(model_name='product', name='inventory_mode', field=models.CharField(choices=[('legacy', 'Eski toplam stok'), ('warehouse', 'Depo bazlı stok')], default='legacy', max_length=20)),
        migrations.AddField(model_name='product', name='product_type', field=models.CharField(choices=[('finished', 'Mamül'), ('semi_finished', 'Yarı mamül'), ('raw_material', 'Ham madde'), ('consumable', 'Sarf malzeme')], default='finished', max_length=20)),
        migrations.AddField(model_name='inventorylocation', name='description', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='inventorylocation', name='is_active', field=models.BooleanField(default=True)),
        migrations.AddField(model_name='inventorylocation', name='name', field=models.CharField(blank=True, default='', max_length=255)),
        migrations.AlterUniqueTogether(name='inventorylocation', unique_together={('warehouse', 'code')}),
        migrations.AddField(model_name='stockmovement', name='acted_by', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='stock_movements', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='stockmovement', name='location_from_ref', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='outgoing_movements', to='erp.inventorylocation')),
        migrations.AddField(model_name='stockmovement', name='location_to_ref', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='incoming_movements', to='erp.inventorylocation')),
        migrations.AddField(model_name='stockmovement', name='previous_quantity', field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
        migrations.AddField(model_name='stockmovement', name='resulting_quantity', field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
        migrations.AddField(model_name='stockmovement', name='source_id', field=models.CharField(blank=True, default='', max_length=120)),
        migrations.AddField(model_name='stockmovement', name='source_type', field=models.CharField(blank=True, default='manual', max_length=50)),
        migrations.AddField(model_name='stockmovement', name='warehouse_from', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='outgoing_movements', to='organizations.warehouse')),
        migrations.AddField(model_name='stockmovement', name='warehouse_to', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='incoming_movements', to='organizations.warehouse')),
        migrations.AlterField(model_name='stockmovement', name='movement_type', field=models.CharField(choices=[('IN', 'Giriş'), ('OUT', 'Çıkış'), ('ADJUST', 'Sayım düzeltmesi'), ('TRANSFER', 'Transfer'), ('OPENING', 'Açılış aktarımı')], default='IN', max_length=20)),
        migrations.CreateModel(name='WarehouseStock', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('quantity', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
            ('detail_1_override', models.CharField(blank=True, default='', max_length=500)),
            ('detail_2_override', models.CharField(blank=True, default='', max_length=500)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('location', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='stocks', to='erp.inventorylocation')),
            ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='warehouse_stocks', to='organizations.organization')),
            ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='warehouse_stocks', to='erp.product')),
            ('warehouse', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='stocks', to='organizations.warehouse')),
        ], options={'ordering': ['warehouse__code', 'location__code', 'product__sku'], 'unique_together': {('organization', 'location', 'product')}}),
        migrations.CreateModel(name='FulfillmentRequest', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('source_type', models.CharField(max_length=50)),
            ('source_id', models.CharField(max_length=120)),
            ('status', models.CharField(choices=[('waiting', 'Bekliyor'), ('in_progress', 'İşlemde'), ('completed', 'Tamamlandı'), ('cancelled', 'İptal')], default='waiting', max_length=20)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fulfillment_requests', to='organizations.organization')),
        ], options={'unique_together': {('organization', 'source_type', 'source_id')}}),
        migrations.CreateModel(name='FulfillmentLine', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('quantity', models.DecimalField(decimal_places=2, max_digits=14)),
            ('method', models.CharField(choices=[('warehouse', 'Depodan teslim'), ('production', 'Üretilecek')], default='warehouse', max_length=20)),
            ('status', models.CharField(choices=[('waiting', 'Bekliyor'), ('picking', 'Toplanıyor'), ('completed', 'Tamamlandı'), ('shortfall', 'Eksik stok')], default='waiting', max_length=20)),
            ('product', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='fulfillment_lines', to='erp.product')),
            ('request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lines', to='erp.fulfillmentrequest')),
        ]),
    ]
