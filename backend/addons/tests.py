from django.contrib.auth import get_user_model
from django.test import TestCase

from accounts.utils import ensure_permissions_seeded, get_effective_permissions, user_has_perm
from addons.models import Addon, AddonCompiledTemplate, AddonNavigation, AddonPhrase, AddonStyleAsset


class AddonCoreSmokeTests(TestCase):
    def test_builtin_quotes_addon_is_installed_from_manifest(self):
        ensure_permissions_seeded()

        addon = Addon.objects.get(addon_id="Udar/Quotes")
        self.assertTrue(addon.is_installed)
        self.assertTrue(addon.is_enabled)
        self.assertTrue(AddonNavigation.objects.filter(addon=addon, key="quotes").exists())
        self.assertTrue(AddonPhrase.objects.filter(addon=addon, title="nav.quotes").exists())
        self.assertTrue(AddonStyleAsset.objects.filter(addon=addon, key="quotes.less").exists())
        self.assertTrue(AddonCompiledTemplate.objects.filter(title="quotes.document_footer_notice").exists())

    def test_admin_role_has_all_effective_permissions(self):
        user = get_user_model().objects.create_user(
            username="addon-admin",
            password="test-pass-123",
            role="Admin",
        )

        ensure_permissions_seeded()

        self.assertEqual(get_effective_permissions(user), ["*"])
        self.assertTrue(user_has_perm(user, "addons.manage"))
