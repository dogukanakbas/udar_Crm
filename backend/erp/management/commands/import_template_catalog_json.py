import json
import sys

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from organizations.models import Organization

from erp.template_catalog_import import upsert_template_catalog


class Command(BaseCommand):
    help = 'Imports template catalog payload from JSON stdin or a file into ERP stock products.'

    def add_arguments(self, parser):
        parser.add_argument('--input', dest='input_path', help='Optional JSON file path inside the backend container')
        parser.add_argument('--organization-id', dest='organization_id', type=int, help='Target organization id')
        parser.add_argument('--user-id', dest='user_id', type=int, help='Optional user id for audit log entries')

    def handle(self, *args, **options):
        input_path = options.get('input_path')
        if input_path:
            with open(input_path, 'r', encoding='utf-8') as handle:
                payload = json.load(handle)
        else:
            raw = sys.stdin.read().strip()
            if not raw:
                raise CommandError('JSON payload missing on stdin')
            payload = json.loads(raw)

        if not isinstance(payload, dict):
            raise CommandError('Payload must be a JSON object')

        organization_id = options.get('organization_id')
        user_id = options.get('user_id')

        organization = (
            Organization.objects.filter(id=organization_id).first()
            if organization_id
            else Organization.objects.first()
        )
        if not organization:
            organization = Organization.objects.create(name='Default Org')

        user = User.objects.filter(id=user_id).first() if user_id else User.objects.filter(role='Admin').first()
        if not user:
            user = User.objects.filter(organization=organization).first()

        categories_data = payload.get('categories') or []
        products_data = payload.get('products') or []
        if not isinstance(categories_data, list) or not isinstance(products_data, list):
            raise CommandError('categories and products must be lists')

        with transaction.atomic():
            result = upsert_template_catalog(organization, categories_data, products_data, user=user)

        self.stdout.write(self.style.SUCCESS(json.dumps(result, ensure_ascii=False)))
