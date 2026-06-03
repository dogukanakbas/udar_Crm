from django.contrib import admin

from .models import (
    ProductionDataField,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionDocument,
    ProductionEvent,
    ProductionRuleBlock,
    ProductionRuleSet,
    ProductionRouteStep,
    ProductionRouteTemplate,
    ProductionSettings,
    ProductionStation,
    ProductionStationUser,
    ProductionStepProgress,
    ProductionTemplatePreset,
    ProductionWorkOrder,
    ProductionWorkOrderLine,
)


admin.site.register(ProductionSettings)
admin.site.register(ProductionDepartment)
admin.site.register(ProductionStation)
admin.site.register(ProductionStationUser)
admin.site.register(ProductionDevice)
admin.site.register(ProductionDataField)
admin.site.register(ProductionDevicePayloadMap)
admin.site.register(ProductionRouteTemplate)
admin.site.register(ProductionRouteStep)
admin.site.register(ProductionRuleSet)
admin.site.register(ProductionRuleBlock)
admin.site.register(ProductionTemplatePreset)
admin.site.register(ProductionWorkOrder)
admin.site.register(ProductionWorkOrderLine)
admin.site.register(ProductionStepProgress)
admin.site.register(ProductionEvent)
admin.site.register(ProductionDocument)
