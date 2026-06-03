from django.contrib import admin

from .models import (
    ProductionDataField,
    ProductionCountingParticipant,
    ProductionCountingWindow,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionDocument,
    ProductionEvent,
    ProductionOperatorProfile,
    ProductionRuleBlock,
    ProductionRuleSet,
    ProductionRouteStep,
    ProductionRouteTemplate,
    ProductionSettings,
    ProductionSessionBreak,
    ProductionStation,
    ProductionStationTarget,
    ProductionStationAlert,
    ProductionStationAlertAck,
    ProductionStationTablet,
    ProductionStationUser,
    ProductionStepProgress,
    ProductionStepTabletAssignment,
    ProductionTemplatePreset,
    ProductionWorkOrder,
    ProductionWorkOrderLine,
)


admin.site.register(ProductionSettings)
admin.site.register(ProductionDepartment)
admin.site.register(ProductionStation)
admin.site.register(ProductionStationUser)
admin.site.register(ProductionDevice)
admin.site.register(ProductionOperatorProfile)
admin.site.register(ProductionStationTablet)
admin.site.register(ProductionStationTarget)
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
admin.site.register(ProductionStepTabletAssignment)
admin.site.register(ProductionSessionBreak)
admin.site.register(ProductionCountingWindow)
admin.site.register(ProductionCountingParticipant)
admin.site.register(ProductionEvent)
admin.site.register(ProductionStationAlert)
admin.site.register(ProductionStationAlertAck)
admin.site.register(ProductionDocument)
