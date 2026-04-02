"""Paralel iş akışı: bölüm durumu ve sipariş üretim takibi yardımcıları."""


def workflow_team_id_list(task):
    return [int(x) for x in (task.workflow_team_ids or []) if x is not None and str(x).isdigit()]


def workflow_stage_production_met(task, team_id):
    """
    İş akışı adımında sonraki aşamaya geçmeden önce bu bölümde yeterli üretim raporu var mı?
    """
    wf = workflow_team_id_list(task)
    if not wf or not team_id:
        return True
    ensure_workflow_state(task)
    st = (task.workflow_stage_state or {}).get(str(int(team_id)), {})
    tgt = int(st.get('qty_target') or 0)
    done = int(st.get('qty_done') or 0)
    if tgt <= 0:
        tgt = int(task.quantity or 1) or 1
    return done >= tgt


def ensure_workflow_state(task):
    """workflow_team_ids ile workflow_stage_state anahtarlarını senkronize eder."""
    ids = workflow_team_id_list(task)
    targets = list(task.workflow_stage_targets or [])
    state = dict(task.workflow_stage_state or {})
    default_qty = int(task.quantity or 0) or 1
    for i, tid in enumerate(ids):
        key = str(tid)
        raw_t = targets[i] if i < len(targets) else None
        try:
            tgt = int(raw_t) if raw_t is not None and str(raw_t).strip() != '' else default_qty
        except (TypeError, ValueError):
            tgt = default_qty
        if tgt < 0:
            tgt = 0
        if key not in state:
            state[key] = {
                'assignee_id': None,
                'qty_target': tgt,
                'qty_done': 0,
                'pending_approval': False,
                'stage_done': False,
            }
        else:
            state[key]['qty_target'] = tgt
            for f, dv in [('assignee_id', None), ('qty_done', 0), ('pending_approval', False), ('stage_done', False)]:
                if f not in state[key]:
                    state[key][f] = dv
    for k in list(state.keys()):
        try:
            if int(k) not in ids:
                del state[k]
        except (TypeError, ValueError):
            del state[k]
    task.workflow_stage_state = state
    return state


def parallel_queue_visible(task, user, user_team_ids):
    """Paralel akışta bu kullanıcı görevi ekip kuyruğunda görmeli mi?"""
    if not getattr(task, 'workflow_parallel', False) or task.status == 'done':
        return False
    ids = workflow_team_id_list(task)
    if not ids:
        return False
    ensure_workflow_state(task)
    state = task.workflow_stage_state or {}
    uid = user.id
    user_set = set(user_team_ids)
    for tid in ids:
        if tid not in user_set:
            continue
        st = state.get(str(tid), {})
        if st.get('stage_done'):
            continue
        aid = st.get('assignee_id')
        if aid is None or aid == uid:
            return True
    return False
