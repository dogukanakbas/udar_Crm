from rest_framework.renderers import BaseRenderer


class EventStreamRenderer(BaseRenderer):
    media_type = 'text/event-stream'
    format = 'event-stream'
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        # Streaming responses bypass this; keep for negotiation compatibility
        return data

