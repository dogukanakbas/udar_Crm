"""Paralel iş akışı: bölüm durumu ve sipariş üretim takibi yardımcıları."""

import re

SHORTFALL_REASON_MAX_LEN = 2000


def format_shortfall_reason_for_storage(qty_done: int, reason: str) -> str:
    """Gerekçe metninin başına raporlanan adet eklenir (çift öneklenmez)."""
    reason = (reason or '').strip()
    if not reason:
        return ''
    if re.match(r'^\d+ ad — ', reason):
        return reason[:SHORTFALL_REASON_MAX_LEN]
    try:
        n = int(qty_done)
    except (TypeError, ValueError):
        n = 0
    prefix = f'{max(0, n)} ad — '
    return (prefix + reason)[:SHORTFALL_REASON_MAX_LEN]


def apply_effective_production_quantity_to_task(task, effective: int):
    """Kısa düşme sonrası kök adet ve aktif ürün satırı planını gerçek üretimle hizalar."""
    try:
        eff = int(effective)
    except (TypeError, ValueError):
        return
    if eff < 1:
        return
    task.quantity = eff
    lines = list(getattr(task, 'product_lines', None) or [])
    if not lines:
        return
    ai = int(getattr(task, 'active_product_index', 0) or 0)
    if not (0 <= ai < len(lines)):
        return
    nl = dict(lines[ai] or {})
    nl['quantity'] = eff
    try:
        md = float(nl.get('model_duration_minutes') or 0)
        nl['total_planned_minutes'] = round(md * eff, 2)
    except (TypeError, ValueError):
        pass
    lines[ai] = nl
    task.product_lines = lines
    try:
        tpm = float(nl.get('total_planned_minutes') or 0)
        task.total_planned_minutes = tpm
        task.planned_hours = round(tpm / 60, 2)
    except (TypeError, ValueError):
        pass


def cascade_downstream_targets_after_shortfall(task, completed_stage_index: int, effective: int):
    """
    Sıralı akışta bir bölüm hedefin altında onaylandıysa, sonraki bölümlerin hedef adedini
    gerçek üretilen miktara indirir (workflow_stage_targets + state senkronu).
    """
    wf = workflow_team_id_list(task)
    if not wf or completed_stage_index < 0 or completed_stage_index >= len(wf) - 1:
        return
    try:
        eff = int(effective)
    except (TypeError, ValueError):
        return
    if eff < 1:
        return
    default_qty = default_workflow_qty_target(task)
    raw_targets = list(task.workflow_stage_targets or [])
    targets = []
    for i in range(len(wf)):
        raw_t = raw_targets[i] if i < len(raw_targets) else None
        try:
            tval = int(raw_t) if raw_t is not None and str(raw_t).strip() != '' else default_qty
        except (TypeError, ValueError):
            tval = default_qty
        if tval < 0:
            tval = 0
        targets.append(tval)
    for j in range(completed_stage_index + 1, len(wf)):
        targets[j] = eff
    task.workflow_stage_targets = targets
    apply_effective_production_quantity_to_task(task, eff)
    ensure_workflow_state(task)


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
    # Çoklu kalemde, aşama kapanmadan önce tüm kalemler için en az bir veri girilmiş olmalı.
    lines = list(getattr(task, 'product_lines', None) or [])
    if len(lines) > 1:
        qmap = dict(st.get('qty_done_by_line') or {})
        for idx in range(len(lines)):
            if str(idx) not in qmap:
                return False
    if tgt <= 0:
        tgt = default_workflow_qty_target(task)
    return done >= tgt


def resolve_production_gate(task, team_id, request_data):
    """
    Onaya göndermeden önce: hedef tamamsa veya istekte gerekçe varsa izin.
    Dönüş: (hata_yanıtı, saklanacak_gerekçe)
    - hata_yanıtı: None veya rest_framework.response.Response (400)
    - saklanacak_gerekçe: None (hedef tamam) veya kısaltılmış gerekçe metni
    """
    from rest_framework.response import Response
    from rest_framework import status

    if workflow_stage_production_met(task, team_id):
        return None, None
    reason = (
        (request_data or {}).get('production_shortfall_reason')
        or (request_data or {}).get('shortfall_reason')
        or ''
    ).strip()
    if not reason:
        ensure_workflow_state(task)
        st = (task.workflow_stage_state or {}).get(str(int(team_id)), {})
        return (
            Response(
                {
                    'detail': (
                        f"Hedef {st.get('qty_target', 0)} adet, kayıtlı üretim {st.get('qty_done', 0)}. "
                        "Hedefin altında tamamlamak için «Üretim eksikliği gerekçesi» alanını doldurun "
                        "(production_shortfall_reason)."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            ),
            None,
        )
    return None, reason[:SHORTFALL_REASON_MAX_LEN]


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


def default_workflow_qty_target(task):
    """
    İş akışı adım hedefi adedi.
    Tüm akış tiplerinde (sıralı/paralel) ürün kalemlerinin toplam adedi hedef alınır.
    Böylece 2. kalem için veri girişi, 1. kalem tamamen bitmeden de yapılabilir.
    """
    lines = list(getattr(task, 'product_lines', None) or [])
    if lines:
        total = 0
        for ln in lines:
            try:
                total += max(0, int((ln or {}).get('quantity') or 0))
            except (TypeError, ValueError):
                continue
        if total > 0:
            return total
    try:
        return max(1, int(task.quantity or 0) or 1)
    except (TypeError, ValueError):
        return 1


def ensure_workflow_state(task):
    """workflow_team_ids ile workflow_stage_state anahtarlarını senkronize eder."""
    ids = workflow_team_id_list(task)
    targets = list(task.workflow_stage_targets or [])
    state = dict(task.workflow_stage_state or {})
    default_qty = default_workflow_qty_target(task)
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


def ensure_product_line_workflows(task):
    """
    Her ürün kalemi için bağımsız workflow alanlarını normalize eder.
    Eski görevleri otomatik dönüştürmek için kök workflow'dan kalemlere varsayılan kopya yapılır.
    """
    lines = list(getattr(task, 'product_lines', None) or [])
    if not lines:
        return False
    root_ids = workflow_team_id_list(task)
    root_targets = list(getattr(task, 'workflow_stage_targets', None) or [])
    changed = False
    next_lines = []
    first_open_team_id = None
    union_team_ids = []
    for idx, raw in enumerate(lines):
        ln = dict(raw or {})
        raw_ids = ln.get('workflow_team_ids')
        if isinstance(raw_ids, list):
            ids = [int(x) for x in raw_ids if x is not None and str(x).isdigit()]
        else:
            ids = []
        if not ids and root_ids:
            ids = list(root_ids)
            changed = True
        ln['workflow_team_ids'] = ids
        for tid in ids:
            if int(tid) not in union_team_ids:
                union_team_ids.append(int(tid))
        raw_targets = ln.get('workflow_stage_targets')
        targets = []
        if isinstance(raw_targets, list):
            for i in range(len(ids)):
                v = raw_targets[i] if i < len(raw_targets) else None
                try:
                    targets.append(int(v) if v is not None and str(v).strip() != '' else 0)
                except (TypeError, ValueError):
                    targets.append(0)
        else:
            for i in range(len(ids)):
                v = root_targets[i] if i < len(root_targets) else None
                try:
                    targets.append(int(v) if v is not None and str(v).strip() != '' else 0)
                except (TypeError, ValueError):
                    targets.append(0)
            if ids:
                changed = True
        qty_default = 0
        try:
            qty_default = max(0, int(ln.get('quantity') or 0))
        except (TypeError, ValueError):
            qty_default = 0
        if qty_default <= 0:
            qty_default = 1
        state = dict(ln.get('workflow_stage_state') or {})
        for i, tid in enumerate(ids):
            key = str(int(tid))
            tgt = targets[i] if i < len(targets) and int(targets[i] or 0) > 0 else qty_default
            if key not in state:
                state[key] = {
                    'assignee_id': None,
                    'qty_target': tgt,
                    'qty_done': 0,
                    'pending_approval': False,
                    'stage_done': False,
                }
                changed = True
            else:
                st = dict(state.get(key) or {})
                if int(st.get('qty_target') or 0) != int(tgt):
                    st['qty_target'] = int(tgt)
                    changed = True
                for f, dv in [('assignee_id', None), ('qty_done', 0), ('pending_approval', False), ('stage_done', False)]:
                    if f not in st:
                        st[f] = dv
                        changed = True
                state[key] = st
        for k in list(state.keys()):
            try:
                if int(k) not in ids:
                    del state[k]
                    changed = True
            except (TypeError, ValueError):
                del state[k]
                changed = True
        prev_cur = ln.get('current_team_id')
        if ids:
            if prev_cur not in ids:
                next_open = None
                for tid in ids:
                    if not (state.get(str(tid)) or {}).get('stage_done'):
                        next_open = tid
                        break
                if next_open is None:
                    next_open = ids[-1]
                ln['current_team_id'] = int(next_open)
                if prev_cur != ln['current_team_id']:
                    changed = True
            if first_open_team_id is None:
                try:
                    cur = int(ln.get('current_team_id')) if ln.get('current_team_id') not in (None, '') else None
                except (TypeError, ValueError):
                    cur = None
                if cur:
                    st_cur = dict(state.get(str(cur)) or {})
                    if not st_cur.get('stage_done'):
                        first_open_team_id = cur
            if first_open_team_id is None:
                for tid in ids:
                    st_row = dict(state.get(str(tid)) or {})
                    if not st_row.get('stage_done'):
                        first_open_team_id = int(tid)
                        break
        else:
            if prev_cur not in (None, ''):
                ln['current_team_id'] = None
                changed = True
        ln['workflow_stage_targets'] = targets
        ln['workflow_stage_state'] = state
        next_lines.append(ln)
    if first_open_team_id is not None:
        if getattr(task, 'current_team_id', None) != int(first_open_team_id):
            task.current_team_id = int(first_open_team_id)
            changed = True
        if getattr(task, 'team_id', None) != int(first_open_team_id):
            task.team_id = int(first_open_team_id)
            changed = True
    # Kalem-bazlı akışta görev kökü de paralel akış gibi işaretlenmeli.
    root_ids = [int(x) for x in (getattr(task, 'workflow_team_ids', None) or []) if str(x).isdigit()]
    if union_team_ids and root_ids != union_team_ids:
        task.workflow_team_ids = union_team_ids
        changed = True
    if union_team_ids and getattr(task, 'workflow_parallel', False) is not True:
        task.workflow_parallel = True
        changed = True
    if changed:
        task.product_lines = next_lines
    return changed


def parallel_queue_visible(task, user, user_team_ids):
    """Paralel akışta bu kullanıcı görevi ekip kuyruğunda görmeli mi?

    Workflow paralelse: görev henüz herhangi bir kullanıcı tarafından üstlenilmediyse
    aynı ekibin tüm üyeleri kuyruğu görmelidir.
    """
    from accounts.models import Team

    if task.status == 'done':
        return False
    lines = list(getattr(task, 'product_lines', None) or [])
    user_set = set(user_team_ids)
    for ln in lines:
        ids = [int(x) for x in (ln or {}).get('workflow_team_ids', []) if str(x).isdigit()]
        if not ids:
            continue
        st_map = dict((ln or {}).get('workflow_stage_state') or {})
        for tid in ids:
            if tid not in user_set:
                continue
            st = dict(st_map.get(str(tid)) or {})
            if not st.get('stage_done'):
                return True
    if not getattr(task, 'workflow_parallel', False):
        return False
    ids = workflow_team_id_list(task)
    if not ids:
        return False
    ensure_workflow_state(task)
    state = task.workflow_stage_state or {}
    uid = user.id
    role = getattr(user, 'role', '')
    staff = role in ('Admin', 'Manager')
    org_id = task.organization_id
    # Otomatik paralel modda öncelik aktif akış ekibidir.
    active_first = []
    try:
        ctid = int(getattr(task, 'current_team_id', None) or 0)
    except (TypeError, ValueError):
        ctid = 0
    if ctid and ctid in ids:
        active_first.append(ctid)
    ordered_ids = active_first + [tid for tid in ids if tid not in active_first]

    for tid in ordered_ids:
        if not staff and tid not in user_set:
            continue
        team = Team.objects.filter(id=tid, organization_id=org_id).first()
        if not team:
            continue
        # Non-staff kullanıcılar: zaten `tid in user_set` kontrolüyle ekibin üyesi sayılır.
        st = state.get(str(tid), {})
        if st.get('stage_done'):
            continue
        aid = st.get('assignee_id')
        if aid is None or aid == uid:
            return True
        # current_team'de atama başka üyeye yapılmış olsa bile ekip kuyruğu görünürlüğü korunur.
        if ctid and tid == ctid and not staff:
            return True
    return False
