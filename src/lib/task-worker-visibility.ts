import type { Task, Team } from '@/types'

function myTeamIds(workerUserId: string, teams: Team[]): string[] {
  return teams
    .filter((tm) => {
      const inMembers = tm.memberIds?.some((m) => String(m) === String(workerUserId))
      const isLeader = tm.leaderId && String(tm.leaderId) === String(workerUserId)
      return inMembers || isLeader
    })
    .map((t) => String(t.id))
}

function taskHasOpenLineForTeam(t: Task, teamId: string): boolean {
  const lines = t.productLines || []
  for (const ln of lines) {
    const ids = (ln.workflowTeamIds || []).map(String)
    if (!ids.includes(String(teamId))) continue
    const st = ln.workflowStageState?.[String(teamId)]
    if (!st?.stage_done) return true
  }
  return false
}

/**
 * Worker "bana atanmış" filtresi: doğrudan assignee veya aktif ekibin üyesi olup atananın
 * o ekibin usta başısı / üyesi olduğu görevler. Usta başısı yalnızca leaderId'de olup members
 * listesinde yoksa da görünür olmalı.
 */
export function taskVisibleToWorkerTeamMember(t: Task, workerUserId: string | null, teams: Team[]): boolean {
  if (!workerUserId) return false
  const teamIds = myTeamIds(workerUserId, teams)
  if (teamIds.length === 0) return false
  // Kalem-bazlı akış: kullanıcı ekibinde açık kalem adımı varsa görünür.
  for (const tid of teamIds) {
    if (taskHasOpenLineForTeam(t, tid)) return true
  }
  const myTeams = teams.filter((tm) => teamIds.includes(String(tm.id)))
  const ct = String(t.currentTeam || t.teamId || '')
  if (!ct) return false
  const teamRow = myTeams.find((tm) => tm.id === ct)
  if (!teamRow) return false
  // Havuzdaki (assignee boş) görevler "Bana atanan" listesinde gösterilmez; sıralı akışta kuyruk yalnızca usta başı içindir.
  if (!t.assignee || String(t.assignee).trim() === '') return false
  const aid = String(t.assignee)
  if (teamRow.memberIds?.some((m) => String(m) === aid)) return true
  if (teamRow.leaderId && String(teamRow.leaderId) === aid) return true
  return false
}

/** Görev üstlen (claim): yalnızca ilgili ekip usta başısı veya Admin/Manager. */
export function workerMayClaimTask(
  t: Task,
  userId: string | null,
  teams: Team[],
  role: string
): boolean {
  if (!userId) return false
  if (role === 'Admin' || role === 'Manager') return true
  if (t.assignee && String(t.assignee).trim() !== '') return false
  const teamIds = myTeamIds(userId, teams)
  // Kalem-bazlı akış: ekipte açık kalem adımı varsa "Üstlen" görünsün.
  for (const tid of teamIds) {
    if (taskHasOpenLineForTeam(t, tid)) return true
  }
  const hasWf = (t.workflowTeamIds?.length ?? 0) > 0
  const parallel = t.workflowParallel === true && hasWf
  const sequential = hasWf && !t.workflowParallel
  if (parallel) {
    // Otomatik paralel modda explicit "Üstlen" adımı yok.
    return false
  }
  if (sequential) {
    const row = t.currentTeam ? teams.find((x) => x.id === t.currentTeam) : undefined
    return !!(row?.leaderId && String(row.leaderId) === String(userId))
  }
  const row = t.currentTeam
    ? teams.find((x) => x.id === t.currentTeam)
    : t.teamId
      ? teams.find((x) => x.id === t.teamId)
      : undefined
  return !!(row?.leaderId && String(row.leaderId) === String(userId))
}
