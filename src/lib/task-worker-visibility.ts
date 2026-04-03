import type { Task, Team } from '@/types'

/**
 * Worker "bana atanmış" filtresi: doğrudan assignee veya aktif ekibin üyesi olup atananın
 * o ekibin usta başısı / üyesi olduğu görevler. Usta başısı yalnızca leaderId'de olup members
 * listesinde yoksa da görünür olmalı.
 */
export function taskVisibleToWorkerTeamMember(t: Task, workerUserId: string | null, teams: Team[]): boolean {
  if (!workerUserId) return false
  const myTeams = teams.filter((tm) => {
    const inMembers = tm.memberIds?.some((m) => String(m) === String(workerUserId))
    const isLeader = tm.leaderId && String(tm.leaderId) === String(workerUserId)
    return inMembers || isLeader
  })
  if (myTeams.length === 0) return false
  const ct = String(t.currentTeam || t.teamId || '')
  if (!ct) return false
  const teamRow = myTeams.find((tm) => tm.id === ct)
  if (!teamRow) return false
  if (!t.assignee || String(t.assignee).trim() === '') return true
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
  const hasWf = (t.workflowTeamIds?.length ?? 0) > 0
  const parallel = t.workflowParallel === true && hasWf
  const sequential = hasWf && !t.workflowParallel
  if (parallel) {
    for (const tid of t.workflowTeamIds || []) {
      const row = teams.find((x) => x.id === tid)
      const st = t.workflowStageState?.[tid]
      if (st?.stage_done) continue
      const aid = st?.assignee_id
      if (aid != null && String(aid) !== String(userId)) continue
      if (row?.leaderId && String(row.leaderId) === String(userId)) return true
    }
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
