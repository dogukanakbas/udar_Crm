from rest_framework import serializers
from .models import (
    Ticket,
    TicketMessage,
    Task,
    TaskAttachment,
    TaskComment,
    TaskChecklist,
    TaskTimeEntry,
    TaskModel,
    TaskProductionEntry,
    TaskMdfConsumption,
)
from .workflow_utils import apply_product_line_to_task, ensure_product_line_workflows, ensure_workflow_state, workflow_team_id_list
from .models_automation import AutomationRule


class TicketMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketMessage
        fields = ['id', 'author', 'message', 'internal', 'created_at']
        read_only_fields = ['author', 'created_at']


class TicketSerializer(serializers.ModelSerializer):
    messages = TicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = ['id', 'subject', 'company_name', 'status', 'priority', 'assignee', 'sla', 'updated_at', 'created_at', 'messages']


class TaskAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskAttachment
        fields = ['id', 'task', 'file', 'file_name', 'uploaded_by', 'uploaded_at', 'description', 'original_name', 'content_type', 'size', 'version', 'parent', 'tags']
        read_only_fields = ['uploaded_by', 'uploaded_at', 'original_name', 'content_type', 'size', 'version', 'parent']

    file_name = serializers.SerializerMethodField()

    def get_file_name(self, obj):
        return obj.original_name or (obj.file.name.split('/')[-1] if obj.file else '')

    def validate_file(self, value):
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError('Dosya 10MB üstü olamaz')
        allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
        if value.content_type not in allowed:
            raise serializers.ValidationError('Yalnızca PNG/JPG/WEBP/PDF kabul edilir')
        return value


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'text', 'type', 'created_at', 'author', 'author_name']
        read_only_fields = ['author', 'created_at', 'author_name']

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None


class TaskProductionEntrySerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    team_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskProductionEntry
        fields = [
            'id',
            'task',
            'user',
            'user_name',
            'team',
            'team_name',
            'product_line_index',
            'entry_date',
            'quantity',
            'note',
            'created_at',
        ]
        read_only_fields = ['user_name', 'team_name', 'created_at']

    def get_user_name(self, obj):
        return obj.user.username if obj.user else None

    def get_team_name(self, obj):
        return obj.team.name if obj.team else None


class TaskMdfConsumptionSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    team_name = serializers.SerializerMethodField()
    mdf_label = serializers.SerializerMethodField()

    class Meta:
        model = TaskMdfConsumption
        fields = [
            'id',
            'task',
            'user',
            'user_name',
            'team',
            'team_name',
            'mdf_sku',
            'mdf_label',
            'quantity',
            'consumed_at',
            'note',
            'created_at',
        ]
        read_only_fields = ['user_name', 'team_name', 'mdf_label', 'created_at']

    def get_user_name(self, obj):
        return obj.user.username if obj.user else None

    def get_team_name(self, obj):
        return obj.team.name if obj.team else None

    def get_mdf_label(self, obj):
        sku = getattr(obj, 'mdf_sku', None)
        if not sku:
            return None
        return f"{sku.thickness_mm} mm · {sku.width_cm} × {sku.height_cm} cm"


class TaskSerializer(serializers.ModelSerializer):
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
    checklist = serializers.SerializerMethodField()
    time_entries = serializers.SerializerMethodField()
    production_entries = serializers.SerializerMethodField()
    mdf_consumptions = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = tuple(f.name for f in Task._meta.fields) + (
            'attachments',
            'comments',
            'checklist',
            'time_entries',
            'production_entries',
            'mdf_consumptions',
        )
        extra_kwargs = {
            'owner': {'required': False, 'allow_null': True},
            'assignee': {'required': False, 'allow_null': True},
            'organization': {'required': False},
            'team': {'required': False, 'allow_null': True},
            'current_team': {'required': False, 'allow_null': True},
            'sales_order': {'required': False, 'allow_null': True},
            'handover_reason': {'required': False, 'allow_null': True},
            'handover_at': {'required': False, 'allow_null': True},
            'planned_hours': {'required': False, 'allow_null': True},
            'planned_cost': {'required': False, 'allow_null': True},
        }

    def get_checklist(self, obj):
        items = obj.checklist.all().order_by('order', 'id')
        return TaskChecklistSerializer(items, many=True).data

    def get_time_entries(self, obj):
        entries = obj.time_entries.all().order_by('-created_at')[:20]
        return TaskTimeEntrySerializer(entries, many=True).data

    def get_production_entries(self, obj):
        items = obj.production_entries.all().order_by('-entry_date', '-created_at')[:200]
        return TaskProductionEntrySerializer(items, many=True).data

    def get_mdf_consumptions(self, obj):
        items = obj.mdf_consumptions.select_related('user', 'team', 'mdf_sku').all()[:200]
        return TaskMdfConsumptionSerializer(items, many=True).data

    def validate(self, attrs):
        # Boş sipariş: üretim düşümü isteğe bağlı
        if 'sales_order' in attrs and attrs['sales_order'] in ('', None):
            attrs['sales_order'] = None
        # Boş veya null gelen planlanan değerleri 0'a çevirerek 400 hatasını önler
        for field in ['planned_hours', 'planned_cost']:
            val = attrs.get(field)
            if val in (None, '', 'null'):
                attrs[field] = 0
        # workflow_team_ids varsa ilk ekip = team/current_team; görev ekip havuzunda başlar (assignee boş)
        workflow_ids = attrs.get('workflow_team_ids')
        if workflow_ids is None and self.instance:
            workflow_ids = getattr(self.instance, 'workflow_team_ids', None)
        if workflow_ids and isinstance(workflow_ids, list) and len(workflow_ids) > 0:
            from accounts.models import Team
            first_id = workflow_ids[0]
            if first_id is not None:
                req = self.context.get('request')
                org_id = getattr(getattr(req, 'user', None), 'organization_id', None)
                q = Team.objects.filter(id=int(first_id))
                if org_id is not None:
                    q = q.filter(organization_id=org_id)
                first_team = q.first()
                if not first_team:
                    raise serializers.ValidationError(
                        {'workflow_team_ids': 'İlk iş akışı ekibi bu organizasyonda bulunamadı.'}
                    )
                if first_team and not attrs.get('team'):
                    attrs['team'] = first_team
                if first_team and not attrs.get('current_team') and getattr(self.instance, 'current_team', None) is None:
                    attrs['current_team'] = first_team
                if not self.instance:
                    # Workflow görevlerde ilk atama kişiye değil ekibe yapılır.
                    attrs['assignee'] = None
        # current_team yoksa team'e eşitle
        if not attrs.get('current_team') and getattr(self.instance, 'current_team', None) is None:
            attrs['current_team'] = attrs.get('team') or getattr(self.instance, 'team', None)
        # Fixed görevler için süre/adet hesapla
        mode = attrs.get('mode') or getattr(self.instance, 'mode', 'manual')
        if mode == 'fixed':
            qty = attrs.get('quantity') or getattr(self.instance, 'quantity', 1) or 1
            duration = attrs.get('model_duration_minutes') or getattr(self.instance, 'model_duration_minutes', 0) or 0
            total = attrs.get('total_planned_minutes') or 0
            if not total or float(total) == 0:
                total = float(duration) * int(qty)
                attrs['total_planned_minutes'] = total
            if attrs.get('planned_hours') in (None, 0, '', 'null') and total:
                attrs['planned_hours'] = round(float(total) / 60, 2)
        # Tarih aralığı doğrulaması
        start = attrs.get('start')
        end = attrs.get('end')
        due = attrs.get('due')
        if start and end and end < start:
            raise serializers.ValidationError({'end': 'Bitiş tarihi başlangıçtan önce olamaz'})
        if start and due and due < start:
            raise serializers.ValidationError({'due': 'Vade tarihi başlangıçtan önce olamaz'})
        wf = attrs.get('workflow_team_ids')
        if wf is None and self.instance:
            wf = getattr(self.instance, 'workflow_team_ids', None)
        if wf and isinstance(wf, list):
            ids = [int(x) for x in wf if x is not None and str(x).isdigit()]
            if len(ids) != len(set(ids)):
                raise serializers.ValidationError(
                    {'workflow_team_ids': 'İş akışında aynı ekip iki kez olamaz.'}
                )
        return super().validate(attrs)

    def _sync_product_lines_and_workflow(self, instance):
        """Aktif kalemi kök alanlara yazar; birden fazla kalem varsa planned_hours tüm kalemlerin toplamına göre ayarlanır."""
        update_fields = []
        if list(instance.product_lines or []):
            apply_product_line_to_task(instance, int(instance.active_product_index or 0))
            ensure_product_line_workflows(instance)
            lines = list(instance.product_lines or [])
            if len(lines) > 1:
                sum_min = 0.0
                for ln in lines:
                    try:
                        tpm = (ln or {}).get('total_planned_minutes')
                        if tpm is not None and str(tpm).strip() != '':
                            sum_min += float(tpm)
                        else:
                            q = int((ln or {}).get('quantity') or 1)
                            d = float((ln or {}).get('model_duration_minutes') or 0)
                            sum_min += d * max(1, q)
                    except (TypeError, ValueError):
                        pass
                if sum_min > 0:
                    instance.planned_hours = round(sum_min / 60, 2)
            update_fields.extend(
                [
                    'mode',
                    'model_code',
                    'variant',
                    'quantity',
                    'model_duration_minutes',
                    'total_planned_minutes',
                    'model_blade_depth',
                    'model_sizes',
                    'product_color',
                    'product_color_code',
                    'planned_hours',
                ]
            )
        if workflow_team_id_list(instance):
            ensure_workflow_state(instance)
            update_fields.append('workflow_stage_state')
        if update_fields:
            instance.save(
                update_fields=list(
                    dict.fromkeys(update_fields + ['workflow_team_ids', 'workflow_parallel', 'current_team', 'team', 'updated_at'])
                )
            )

    def _apply_done_status_defaults(self, instance):
        """Durumu done olan görevlerde kalem üretimini hedefe eşitle."""
        if getattr(instance, 'status', None) != 'done':
            return

        update_fields = []
        lines = list(instance.product_lines or [])
        if lines:
            changed = False
            for ln in lines:
                row = dict(ln or {})
                try:
                    qty = max(0, int(row.get('quantity') or 0))
                except (TypeError, ValueError):
                    qty = 0
                if int(row.get('qty_produced') or 0) != qty:
                    row['qty_produced'] = qty
                    changed = True
                ln.clear()
                ln.update(row)
            if changed:
                instance.product_lines = lines
                update_fields.append('product_lines')

        wf_ids = workflow_team_id_list(instance)
        if wf_ids:
            state = ensure_workflow_state(instance) or {}
            changed_state = False
            qmap_full = {}
            for i, ln in enumerate(lines):
                try:
                    qmap_full[str(i)] = max(0, int((ln or {}).get('quantity') or 0))
                except (TypeError, ValueError):
                    qmap_full[str(i)] = 0
            total_done = 0
            for v in qmap_full.values():
                total_done += int(v or 0)

            for tid in wf_ids:
                key = str(tid)
                st = dict(state.get(key, {}) or {})
                if st.get('stage_done') is not True:
                    st['stage_done'] = True
                    changed_state = True
                if st.get('pending_approval') is not False:
                    st['pending_approval'] = False
                    changed_state = True
                if int(st.get('qty_done') or 0) != total_done:
                    st['qty_done'] = total_done
                    changed_state = True
                if dict(st.get('qty_done_by_line') or {}) != qmap_full:
                    st['qty_done_by_line'] = qmap_full
                    changed_state = True
                if st.get('assignee_id') is not None:
                    st['assignee_id'] = None
                    changed_state = True
                state[key] = st
            if changed_state:
                instance.workflow_stage_state = state
                update_fields.append('workflow_stage_state')

        if instance.assignee_id is not None:
            instance.assignee = None
            update_fields.append('assignee')

        if update_fields:
            instance.save(update_fields=list(dict.fromkeys(update_fields + ['updated_at'])))

    def create(self, validated_data):
        instance = super().create(validated_data)
        self._sync_product_lines_and_workflow(instance)
        self._apply_done_status_defaults(instance)
        return instance

    def update(self, instance, validated_data):
        if 'product_lines' in validated_data and instance:
            old_lines = list(getattr(instance, 'product_lines', None) or [])
            new_lines = list(validated_data.get('product_lines') or [])
            merged = []
            for i, nl in enumerate(new_lines):
                d = dict(nl or {})
                if i < len(old_lines):
                    old = dict(old_lines[i] or {})
                    if 'qty_produced' not in d and old.get('qty_produced') is not None:
                        d['qty_produced'] = old.get('qty_produced')
                merged.append(d)
            validated_data['product_lines'] = merged
        instance = super().update(instance, validated_data)
        self._sync_product_lines_and_workflow(instance)
        self._apply_done_status_defaults(instance)
        return instance


class TaskModelSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    def validate(self, attrs):
        w = attrs.get('width_mm')
        h = attrs.get('height_mm')
        if w is not None and h is not None:
            sizes = list(attrs.get('sizes') or getattr(self.instance, 'sizes', None) or [])
            label = f'{w}x{h}'
            if label not in sizes:
                attrs['sizes'] = [label] + sizes
            elif 'sizes' not in attrs:
                attrs['sizes'] = sizes
        return super().validate(attrs)

    class Meta:
        model = TaskModel
        fields = [
            'id',
            'code',
            'name',
            'image',
            'image_url',
            'duration_minutes',
            'blade_min',
            'blade_max',
            'width_mm',
            'height_mm',
            'thickness_mm',
            'sizes',
            'order',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class TaskChecklistSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskChecklist
        fields = ['id', 'task', 'title', 'done', 'order', 'created_at', 'workflow_team']
        read_only_fields = ['created_at', 'workflow_team']

    def create(self, validated_data):
        # organization paramı Model'de olmadığı için sessizce kaldır
        validated_data.pop('organization', None)
        return super().create(validated_data)


class TaskTimeEntrySerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskTimeEntry
        fields = ['id', 'task', 'user', 'user_name', 'team', 'section', 'started_at', 'ended_at', 'note', 'created_at']
        read_only_fields = ['user_name', 'created_at']

    def get_user_name(self, obj):
        return obj.user.username if obj.user else None


class AutomationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationRule
        fields = '__all__'
        read_only_fields = ['organization', 'created_at']

    def validate(self, attrs):
        action = attrs.get('action')
        payload = attrs.get('action_payload') or {}
        if action == 'notify':
            if not (payload.get('message') or payload.get('email') or payload.get('webhook')):
                raise serializers.ValidationError("Notify aksiyonu için en az mesaj veya email/webhook gerekli")
        if action == 'multi_notify':
            emails = payload.get('emails') or []
            hooks = payload.get('webhooks') or []
            message = payload.get('message')
            if not message or (not emails and not hooks):
                raise serializers.ValidationError("multi_notify için message ve en az bir email/webhook gerekli")
        if action == 'set_field':
            field = payload.get('field')
            if field not in ['priority', 'status']:
                raise serializers.ValidationError("set_field yalnızca priority/status için kullanılabilir")
        if action == 'add_tag':
            if not payload.get('tag'):
                raise serializers.ValidationError("add_tag için tag zorunlu")
        if action == 'set_assignee':
            if not payload.get('assignee'):
                raise serializers.ValidationError("set_assignee için assignee zorunlu")
        return super().validate(attrs)

