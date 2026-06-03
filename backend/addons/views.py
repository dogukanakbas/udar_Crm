from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.utils import user_has_perm
from addons.models import Addon, AddonCompiledTemplate, AddonPhrase, AddonStyleAsset, AddonTemplate, AddonTemplateModification
from addons.services import (
    AddonError,
    delete_addon,
    disable_addon,
    enable_addon,
    filtered_navigation,
    filtered_routes,
    install_addon,
    permission_catalog_payload,
    rebuild_templates,
    phrase_bundle,
    safe_extract_addon_zip,
    style_bundle,
    sync_discovered_addons,
    uninstall_addon,
)


def _addon_payload(addon: Addon):
    return {
        "id": addon.id,
        "addon_id": addon.addon_id,
        "title": addon.title,
        "vendor": addon.vendor,
        "version": addon.version,
        "version_id": addon.version_id,
        "is_installed": addon.is_installed,
        "is_enabled": addon.is_enabled,
        "is_system": addon.is_system,
        "can_delete": not addon.is_system,
        "path": addon.path,
        "manifest": addon.manifest,
        "counts": {
            "permissions": addon.data_imports.filter(data_type="permissions").first().count if addon.pk and addon.data_imports.filter(data_type="permissions").exists() else 0,
            "phrases": addon.phrases.filter(is_active=True).count() if addon.pk else 0,
            "templates": addon.templates.filter(is_active=True).count() if addon.pk else 0,
            "template_modifications": addon.template_modifications.filter(is_active=True).count() if addon.pk else 0,
            "style_assets": addon.style_assets.filter(is_active=True).count() if addon.pk else 0,
        },
        "installed_at": addon.installed_at,
        "updated_at": addon.updated_at,
    }


class AddonViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on listesini görüntüleme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        sync_discovered_addons(actor=request.user)
        return Response([_addon_payload(addon) for addon in Addon.objects.all()])

    def retrieve(self, request, pk=None):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on görüntüleme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon = Addon.objects.get(pk=pk)
        return Response(_addon_payload(addon))

    @action(detail=False, methods=["post"], url_path="rebuild")
    def rebuild(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on rebuild yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addons = sync_discovered_addons(actor=request.user)
        return Response({"count": len(addons)})

    @action(detail=False, methods=["post"], url_path="install")
    def install(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on kurma yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon_id = request.data.get("addon_id")
        if not addon_id:
            return Response({"detail": "addon_id gerekli"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            addon = install_addon(addon_id, actor=request.user)
        except AddonError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_addon_payload(addon))

    @action(detail=False, methods=["post"], url_path="upgrade")
    def upgrade(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on yükseltme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon_id = request.data.get("addon_id")
        if not addon_id:
            return Response({"detail": "addon_id gerekli"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            addon = install_addon(addon_id, actor=request.user)
        except AddonError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_addon_payload(addon))

    @action(detail=False, methods=["post"], url_path="enable")
    def enable(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on etkinleştirme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon = enable_addon(request.data.get("addon_id"), actor=request.user)
        return Response(_addon_payload(addon))

    @action(detail=False, methods=["post"], url_path="disable")
    def disable(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on pasifleştirme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon = disable_addon(request.data.get("addon_id"), actor=request.user)
        return Response(_addon_payload(addon))

    @action(detail=False, methods=["post"], url_path="uninstall")
    def uninstall(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on kaldırma yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon = uninstall_addon(request.data.get("addon_id"), actor=request.user)
        return Response(_addon_payload(addon))

    @action(detail=False, methods=["post"], url_path="delete")
    def delete(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on silme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        try:
            delete_addon(request.data.get("addon_id"), actor=request.user)
        except AddonError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Add-on silindi"})

    @action(detail=False, methods=["post"], url_path="rebuild-templates")
    def rebuild_templates(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Şablon rebuild yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        count = rebuild_templates(request.data.get("addon_id") or None)
        return Response({"compiled": count})


class AddonUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Add-on yükleme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"detail": "file zorunludur"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payload = safe_extract_addon_zip(uploaded_file)
        except (AddonError, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        sync_discovered_addons(actor=request.user)
        return Response(payload, status=status.HTTP_201_CREATED)


class AddonNavigationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"navigation": filtered_navigation(request.user)})


class AddonRoutesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"routes": filtered_routes(request.user)})


class AddonTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Şablon görüntüleme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon_id = request.query_params.get("addon_id")
        qs = AddonTemplate.objects.select_related("addon").order_by("template_type", "title")
        if addon_id:
            qs = qs.filter(addon__addon_id=addon_id)
        data = [
            {
                "id": item.id,
                "addon_id": item.addon.addon_id,
                "type": item.template_type,
                "title": item.title,
                "content": item.content,
                "is_active": item.is_active,
            }
            for item in qs
        ]
        return Response({"templates": data})


class AddonTemplateModificationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Şablon modifikasyonu görüntüleme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon_id = request.query_params.get("addon_id")
        qs = AddonTemplateModification.objects.select_related("addon").order_by("template_type", "template", "execution_order")
        if addon_id:
            qs = qs.filter(addon__addon_id=addon_id)
        data = [
            {
                "id": item.id,
                "addon_id": item.addon.addon_id,
                "type": item.template_type,
                "template": item.template,
                "key": item.modification_key,
                "description": item.description,
                "action": item.action,
                "execution_order": item.execution_order,
                "enabled": item.enabled,
                "last_error": item.last_error,
            }
            for item in qs
        ]
        return Response({"modifications": data})


class AddonCompiledTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Derlenmiş şablon görüntüleme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        template_type = request.query_params.get("type")
        title = request.query_params.get("title")
        qs = AddonCompiledTemplate.objects.all().order_by("template_type", "title")
        if template_type:
            qs = qs.filter(template_type=template_type)
        if title:
            qs = qs.filter(title=title)
        data = [
            {
                "type": item.template_type,
                "title": item.title,
                "content": item.content,
                "applied_modifications": item.applied_modifications,
                "checksum": item.checksum,
            }
            for item in qs[:100]
        ]
        return Response({"compiled_templates": data})


class AddonPhraseView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Phrase görüntüleme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon_id = request.query_params.get("addon_id")
        language_id = request.query_params.get("language_id")
        qs = AddonPhrase.objects.select_related("addon").filter(is_active=True).order_by("language_id", "title")
        if addon_id:
            qs = qs.filter(addon__addon_id=addon_id)
        if language_id:
            qs = qs.filter(language_id=language_id)
        return Response({
            "phrases": [
                {
                    "addon_id": item.addon.addon_id,
                    "language_id": item.language_id,
                    "title": item.title,
                    "text": item.text,
                }
                for item in qs[:500]
            ]
        })


class AddonStyleAssetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_has_perm(request.user, "addons.manage"):
            return Response({"detail": "Style asset görüntüleme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        addon_id = request.query_params.get("addon_id")
        qs = AddonStyleAsset.objects.select_related("addon").filter(is_active=True).order_by("addon__addon_id", "display_order", "key")
        if addon_id:
            qs = qs.filter(addon__addon_id=addon_id)
        return Response({
            "style_assets": [
                {
                    "addon_id": item.addon.addon_id,
                    "key": item.key,
                    "type": item.asset_type,
                    "content": item.content,
                }
                for item in qs[:200]
            ]
        })


class PermissionCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_has_perm(request.user, "roles.view"):
            return Response({"detail": "Yetki kataloğunu görüntüleme yetkiniz yok"}, status=status.HTTP_403_FORBIDDEN)
        return Response(permission_catalog_payload())


class PhraseBundleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        language_id = request.query_params.get("language_id") or request.query_params.get("locale") or "tr-TR"
        return Response({"language_id": language_id, "phrases": phrase_bundle(language_id)})


class AddonStyleBundleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return HttpResponse(style_bundle(), content_type="text/css; charset=utf-8")
