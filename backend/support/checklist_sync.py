"""İş akışı ekiplerine göre görev checklist maddelerini senkronize eder."""

from accounts.models import Team

from .models import TaskChecklist
from .workflow_utils import ensure_workflow_state, workflow_team_id_list


def sync_workflow_checklist(task):
    """
    workflow_team_ids sırasına göre her ekip için bir checklist satırı oluşturur/günceller.
    title: "{Ekip adı} — bölüm tamamlandı"
    done: workflow_stage_state[team_id].stage_done
    Manuel (workflow dışı) maddeler workflow_team=NULL olarak korunur.
    """
    wf = workflow_team_id_list(task)
    if not wf:
        TaskChecklist.objects.filter(task=task, workflow_team__isnull=False).delete()
        return

    ensure_workflow_state(task)
    org_id = task.organization_id
    state = task.workflow_stage_state or {}
    seen_team_ids = set()

    for idx, tid in enumerate(wf):
        team = Team.objects.filter(id=tid, organization_id=org_id).first()
        if not team:
            continue
        seen_team_ids.add(team.id)
        title = f'{team.name} — bölüm tamamlandı'
        st = state.get(str(tid)) or {}
        done = bool(st.get('stage_done'))

        TaskChecklist.objects.update_or_create(
            task=task,
            workflow_team=team,
            defaults={'title': title, 'order': idx, 'done': done},
        )

    TaskChecklist.objects.filter(task=task, workflow_team__isnull=False).exclude(
        workflow_team_id__in=seen_team_ids
    ).delete()
