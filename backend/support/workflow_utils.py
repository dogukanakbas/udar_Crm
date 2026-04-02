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


def apply_product_line_to_task(task, index=None):
    """
    product_lines içindeki sıradaki kalem alanlarını görev kök alanlarına yazar
    (üretimde görünen 'aktif' ürün). index verilmezse active_product_index kullanılır.
    """
    lines = list(task.product_lines or [])
    if not lines:
        return
    idx = int(index if index is not None else getattr(task, 'active_product_index', 0) or 0)
    if idx < 0 or idx >= len(lines):
        return
    line = lines[idx] or {}
    mode = line.get('mode') or 'manual'
    task.mode = mode if mode in ('manual', 'fixed') else 'manual'
    task.model_code = str(line.get('model_code') or '')
    task.variant = str(line.get('variant') or '')
    try:
        task.quantity = max(1, int(line.get('quantity') or 1))
    except (TypeError, ValueError):
        task.quantity = 1
    md = line.get('model_duration_minutes')
    try:
        task.model_duration_minutes = md if md is not None else 0
    except (TypeError, ValueError):
        task.model_duration_minutes = 0
    tpm = line.get('total_planned_minutes')
    try:
        task.total_planned_minutes = tpm if tpm is not None else 0
    except (TypeError, ValueError):
        task.total_planned_minutes = 0
    task.model_blade_depth = str(line.get('model_blade_depth') or '')
    task.model_sizes = list(line.get('model_sizes') or [])
    task.product_color = str(line.get('product_color') or '')
    task.product_color_code = str(line.get('product_color_code') or '')
    try:
        task.planned_hours = round(float(task.total_planned_minutes or 0) / 60, 2)
    except (TypeError, ValueError):
        pass


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
