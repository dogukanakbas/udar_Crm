from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from organizations.models import Organization, Branch, NumberRange
from crm.models import BusinessPartner, Quote, QuoteLine, PricingRule
from erp.models import SalesOrder, Product, Category
from decimal import Decimal
from datetime import date, timedelta


class Command(BaseCommand):
    help = "Seed demo org, users, and sample data"

    def handle(self, *args, **options):
        org, _ = Organization.objects.get_or_create(code="UDAR", defaults={"name": "Udar Demo"})
        branch, _ = Branch.objects.get_or_create(organization=org, code="MAIN", defaults={"name": "Main"})
        NumberRange.objects.get_or_create(organization=org, doc_type='QUOTE', defaults={'prefix': 'Q-'})
        NumberRange.objects.get_or_create(organization=org, doc_type='ORDER', defaults={'prefix': 'SO-'})

        User = get_user_model()
        users = [
            ('admin@demo.com', 'Admin123!', 'Admin'),
            ('sales@demo.com', 'Sales123!', 'Sales'),
            ('finance@demo.com', 'Finance123!', 'Finance'),
        ]
        for email, pwd, role in users:
            user, created = User.objects.get_or_create(username=email, defaults={
                'email': email,
                'role': role,
                'organization': org,
                'branch': branch,
            })
            if created:
                user.set_password(pwd)
                user.save()

        partner, _ = BusinessPartner.objects.get_or_create(organization=org, name="ACME Corp", defaults={"city": "Istanbul"})
        cat, _ = Category.objects.get_or_create(organization=org, name="Software")
        prod, _ = Product.objects.get_or_create(organization=org, sku="SKU-1001", defaults={"name": "Udar Seat", "price": Decimal("1200"), "category": cat})
        PricingRule.objects.get_or_create(organization=org, name="VIP %8", type="customer", target="VIP", value=Decimal("8.0"))

        quote = Quote.objects.create(
            organization=org,
            number="Q-10001",
            customer=partner,
            owner=User.objects.filter(role="Sales", organization=org).first(),
            status="Draft",
            valid_until=date.today() + timedelta(days=15),
            currency="USD",
            payment_terms="Net 30",
            delivery_terms="CIF",
        )
        QuoteLine.objects.create(quote=quote, product=prod, name=prod.name, qty=2, unit_price=prod.price, discount=0, tax=18)
        quote.subtotal = Decimal("2400")
        quote.discount_total = Decimal("0")
        quote.tax_total = Decimal("432")
        quote.total = Decimal("2832")
        quote.save()

        SalesOrder.objects.get_or_create(
            organization=org,
            number="SO-10001",
            customer_name=partner.name,
            status="Draft",
            amount=Decimal("5000"),
            shipping_date=date.today(),
            expected_delivery=date.today() + timedelta(days=5),
        )

        self.stdout.write(self.style.SUCCESS("Demo data seeded."))

