import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Mention, PrRow, Snapshot } from '../types'

// Live pane of what the agentic-reviewer listener follows. Everything comes from files the listener and the review
// sessions already write under ~/.agentic-reviewer, plus `orca terminal list` for whether each review agent is busy.

const PANE = 'agentic-reviewer'
const TITLE = 'PR reviews'
const EMPTY: Snapshot = { active: [], done: [], queued: 0, queue: [], sessions: 0, maxSessions: 4, held: [], hold: { approvedAfter: 30, changesAfter: 60, checkEvery: 30 }, listener: false, updatedAt: 0, error: '', language: 'en' }
const snapshot = atom({ plugin: 'agentic-reviewer', key: 'snapshot' } as const, EMPTY, { shape: 'snapshot-2' })

const ACTIVE = ['queued', 'reviewing', 'changes', 'approved']
const FINISHED = ['merged', 'closed', 'ignored', 'skipped', 'failed']
// The pane's own words, in the language set in reviewer.yaml (`language`), which the listener copies to
// ~/.agentic-reviewer/settings.json. PR titles and Slack messages stay as written.
const TEXT = {
  en: {
    status: {
      queued: '⏸ queued', reviewing: '⏳ reviewing', changes: '🔄 waiting for the author', approved: '✅ approved',
      merged: '🟣 merged', closed: '⚫ closed', ignored: '⏭ not a review request', skipped: '⏭ skipped',
      failed: '❌ could not open', held: '💤 on hold',
    } as Record<string, string>,
    group: 'group chat',
    findings: (done: number, all: number) => `${done}/${all} findings resolved`,
    approvedAt: (sha: string) => `approved at ${sha}`,
    waitingCi: 'waiting for CI',
    working: 'working',
    idle: 'waiting',
    updated: (t: string) => `PR updated ${t} ago`,
    gone: 'terminal not found in Orca',
    opened: 'Review panel opened.',
    someone: 'someone',
    alsoSent: ' also sent it',
    in: (place: string) => ` in ${place}`,
    githubRequest: 'review request on GitHub',
    slackMessage: 'message on Slack',
    review: '[ View review ]',
    pr: '[ View PR ]',
    slack: '[ View on Slack ]',
    prShort: '[ PR ]',
    running: '● listener running',
    stopped: '○ listener stopped',
    queued: (n: number) => ` · ${n} queued`,
    reviewingNow: '🔍 Reviewing now',
    noneReviewing: 'No review running.',
    pending: '⏳ Pending (approved or changes requested)',
    nonePending: 'Nothing pending.',
    queueTitle: '⏸ Queue (next to start)',
    queueHint: 'Each starts when a session closes: its PR merged or closed, or a quiet one put on hold.',
    holdTitle: '💤 On hold (quiet, session closed)',
    holdHint: (a: number, c: number, e: number) =>
      `Closed to make room for the queue: approved and quiet for ${a}min+, or waiting for the author for ${c}min+. Checked every ${e}min with plain GitHub calls (no tokens); any news sends it back to the front of the queue.`,
    heldFor: (t: string) => `on hold for ${t}`,
    nextCheck: (t: string) => `next check in ${t}`,
    sessions: (n: number, max: number) => ` · ${n}/${max} sessions`,
    position: (n: number) => (n === 1 ? 'next' : `#${n}`),
    done: '✔ Done in the last 24h',
    noneDone: 'Nothing done in the last 24h.',
  },
  'pt-BR': {
    status: {
      queued: '⏸ na fila', reviewing: '⏳ revisando', changes: '🔄 aguardando o autor', approved: '✅ aprovada',
      merged: '🟣 mergeada', closed: '⚫ fechada', ignored: '⏭ não era pedido de review', skipped: '⏭ pulada',
      failed: '❌ não abriu', held: '💤 em espera',
    } as Record<string, string>,
    group: 'grupo',
    findings: (done: number, all: number) => `${done}/${all} findings resolvidos`,
    approvedAt: (sha: string) => `aprovada em ${sha}`,
    waitingCi: 'esperando o CI',
    working: 'trabalhando',
    idle: 'aguardando',
    updated: (t: string) => `PR atualizada há ${t}`,
    gone: 'terminal não encontrado no Orca',
    opened: 'Painel de reviews aberto.',
    someone: 'alguém',
    alsoSent: ' também mandou',
    in: (place: string) => ` em ${place}`,
    githubRequest: 'pedido de review no GitHub',
    slackMessage: 'mensagem no Slack',
    review: '[ Ver review ]',
    pr: '[ Ver PR ]',
    slack: '[ Ver no Slack ]',
    prShort: '[ PR ]',
    running: '● listener rodando',
    stopped: '○ listener parado',
    queued: (n: number) => ` · ${n} na fila`,
    reviewingNow: '🔍 Revisando agora',
    noneReviewing: 'Nenhum review rodando.',
    pending: '⏳ Pendentes (aprovadas ou com revisão solicitada)',
    nonePending: 'Nada pendente.',
    queueTitle: '⏸ Fila (próximas a entrar)',
    queueHint: 'Cada uma entra quando uma sessão fecha: PR mergeada ou fechada, ou uma parada posta em espera.',
    holdTitle: '💤 Em espera (paradas, sessão fechada)',
    holdHint: (a: number, c: number, e: number) =>
      `Fechadas para abrir vaga para a fila: aprovadas e paradas há ${a}min+, ou aguardando o autor há ${c}min+. Checadas a cada ${e}min só com chamadas ao GitHub (sem tokens); qualquer novidade devolve a PR para o começo da fila.`,
    heldFor: (t: string) => `em espera há ${t}`,
    nextCheck: (t: string) => `próxima checagem em ${t}`,
    sessions: (n: number, max: number) => ` · ${n}/${max} sessões`,
    position: (n: number) => (n === 1 ? 'próxima' : `#${n}`),
    done: '✔ Concluídas nas últimas 24h',
    noneDone: 'Nada concluído nas últimas 24h.',
  },
}
let language: 'en' | 'pt-BR' = 'en'
const REACTION: Record<string, string> = { reviewing: '⏳', changes: '🔄', approved: '✅' }
const DAY_MS = 24 * 3600 * 1000
const TAIL_BYTES = 512 * 1024

type Json = Record<string, any>

function lines(text: string): Json[] {
  const out: Json[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      // a line cut by the tail read, or being written
    }
  }
  return out
}

// Where a Slack message was sent: "DM", "grupo" or "#channel". Resolved once per channel with a Slack search
// (slackcli has no channel lookup); kept for the module's life.
const places: Record<string, string> = {}

function channelOf(slack: string): string {
  return /\/archives\/([A-Z0-9]+)\//.exec(slack)?.[1] ?? ''
}

async function placeOf($: any, channel: string): Promise<string> {
  if (!channel) return ''
  if (channel.startsWith('D')) return 'DM'
  if (channel in places) return places[channel] ?? ''
  places[channel] = ''
  try {
    const { exitCode, stdout } = await $.process.run(
      ['slackcli', 'search', 'messages', `in:<#${channel}>`, '--limit', '1', '--json'],
      { timeoutMs: 20000, env: { SLACKCLI_NO_UPDATE_NOTIFIER: '1' } },
    )
    const ch = exitCode === 0 ? JSON.parse(stdout)?.matches?.[0]?.channel : undefined
    if (ch) places[channel] = ch.is_im ? 'DM' : ch.is_mpim ? TEXT[language].group : `#${ch.name}`
  } catch {
    // Slack unreachable: no channel shown, tried again after a reload
  }
  return places[channel] ?? ''
}

// Who sent a Slack message and what it said, for events recorded without them (an older listener). Fetched
// once per link; kept for the module's life.
const senders: Record<string, { sender: string; message: string }> = {}

function plainText(text: string, users: Json[]): string {
  const names: Record<string, string> = Object.fromEntries(users.map(u => [u.id, u.real_name || u.name]))
  return text
    .replace(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g, (_, id) => `@${names[id] ?? id}`)
    .replace(/<#C[A-Z0-9]+\|([^>]*)>/g, '#$1')
    .replace(/<([^>|]+)\|([^>]+)>/g, '$2')
    .replace(/<([^>]+)>/g, '$1')
    .split(/\s+/)
    .join(' ')
    .trim()
    .slice(0, 400)
}

async function senderOf($: any, slack: string): Promise<{ sender: string; message: string }> {
  const none = { sender: '', message: '' }
  if (!slack.includes('/archives/')) return none
  if (slack in senders) return senders[slack] ?? none
  senders[slack] = none
  try {
    const { exitCode, stdout } = await $.process.run(
      ['slackcli', 'conversations', 'get', '--permalink', slack, '--json'],
      { timeoutMs: 20000, env: { SLACKCLI_NO_UPDATE_NOTIFIER: '1' } },
    )
    if (exitCode === 0) {
      const d = JSON.parse(stdout.slice(stdout.indexOf('{')))
      const m = d?.message ?? {}
      const users: Json[] = d?.users ?? []
      const u = users.find(x => x.id === m.user)
      senders[slack] = { sender: String(u?.real_name || u?.name || ''), message: plainText(String(m.text ?? ''), users) }
    }
  } catch {
    // Slack unreachable: the card shows no sender, tried again after a reload
  }
  return senders[slack] ?? none
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 90) return `${s}s`
  if (s < 5400) return `${Math.round(s / 60)}min`
  return `${Math.round(s / 3600)}h`
}

function loopSummary(loop: Json | undefined): string {
  if (!loop) return ''
  const findings: Json[] = loop.findings ?? []
  const open = findings.filter(f => String(f.status ?? 'open').startsWith('open')).length
  const L = TEXT[language]
  const parts = [`round ${loop.round ?? 1}`]
  if (findings.length) parts.push(L.findings(findings.length - open, findings.length))
  if (loop.approved_sha) parts.push(L.approvedAt(String(loop.approved_sha).slice(0, 7)))
  else if (loop.ci_comment_id) parts.push(L.waitingCi)
  return parts.join(' · ')
}

let home = ''
let terminals: Record<string, { title: string; lastOutputAt: number }> = {}
let terminalsAt = 0
let ticking = false

async function readJson($: any, path: string): Promise<Json | undefined> {
  try {
    return JSON.parse(await $.fs.read(path))
  } catch {
    return undefined
  }
}

async function tail($: any, path: string): Promise<string> {
  try {
    const { size } = await $.fs.stat(path)
    const offset = Math.max(0, size - TAIL_BYTES)
    return await $.fs.read(path, { offset, length: size - offset })
  } catch {
    return ''
  }
}

// When each open PR last changed on GitHub (push, comment, review), refreshed once a minute.
const prUpdated: Record<string, { at: number; checked: number }> = {}

async function prUpdatedAt($: any, key: string, url: string, now: number): Promise<number> {
  const seen = prUpdated[key]
  if (seen && now - seen.checked < 60000) return seen.at
  prUpdated[key] = { at: seen?.at ?? 0, checked: now }
  try {
    const { exitCode, stdout } = await $.process.run(['gh', 'pr', 'view', url, '--json', 'updatedAt'], { timeoutMs: 20000 })
    const at = exitCode === 0 ? Date.parse(JSON.parse(stdout).updatedAt) : NaN
    if (!Number.isNaN(at)) prUpdated[key] = { at, checked: now }
  } catch {
    // GitHub unreachable: keep the last value
  }
  return prUpdated[key]?.at ?? 0
}

async function refreshTerminals($: any, now: number) {
  if (now - terminalsAt < 20000) return
  terminalsAt = now
  try {
    const { exitCode, stdout } = await $.process.run(['orca', 'terminal', 'list', '--json'], { timeoutMs: 15000 })
    if (exitCode !== 0) return
    const list: Json[] = JSON.parse(stdout)?.result?.terminals ?? []
    terminals = Object.fromEntries(
      list.map(t => [t.handle, { title: String(t.title ?? ''), lastOutputAt: Number(t.lastOutputAt ?? 0) }]),
    )
  } catch {
    // Orca not running: the pane just shows no agent state
  }
}

async function collect($: any): Promise<Snapshot> {
  if (!home) {
    const { stdout } = await $.process.run(['printenv', 'HOME'])
    home = `${stdout.trim()}/.agentic-reviewer`
  }
  const settings = await readJson($, `${home}/settings.json`)
  if (settings?.language) {
    language = String(settings.language).toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
  } else {
    const { stdout } = await $.process.run(['printenv', 'LANG'])
    language = stdout.trim().toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
  }
  const L = TEXT[language]
  const now = await $.clock.now()
  const [eventsText, reactionsText, state] = await Promise.all([
    tail($, `${home}/events.jsonl`),
    tail($, `${home}/reactions.jsonl`),
    readJson($, `${home}/state.json`),
  ])
  await refreshTerminals($, now)

  const reactions: Record<string, string> = {}
  for (const r of lines(reactionsText)) reactions[`${r.channel}:${r.ts}`] = REACTION[r.status] ?? ''

  // Latest status of each PR, carrying over who sent it, as the listener's panel.py merges them.
  const latest: Record<string, Json> = {}
  for (const ev of lines(eventsText)) {
    let merged: Json = { ...(latest[ev.key] ?? {}) }
    if ((ev.status === 'reviewing' || ev.status === 'queued') && FINISHED.includes(merged.status)) merged = {}
    delete merged.link
    latest[ev.key] = { ...merged, ...ev }
  }

  const tracked: Json = state?.tracked ?? {}
  const handles: Json = state?.terminals ?? {}
  let listener = false
  try {
    const pid = (await $.fs.read(`${home}/listener.lock`)).trim()
    listener = pid !== '' && (await $.process.run(['kill', '-0', pid])).exitCode === 0
  } catch {
    listener = false
  }

  const rows: PrRow[] = []
  for (const [key, e] of Object.entries(latest)) {
    const t: Json = tracked[key] ?? {}
    const status = String(ACTIVE.includes(t.status) ? t.status : e.status)
    const handle = handles[key]
    const term = handle ? terminals[handle] : undefined
    const [owner, repoNumber] = key.split('/')
    const [repo, number] = (repoNumber ?? '').split('#')
    const loop = await readJson($, `${home}/loops/${owner}-${repo}-${number}.json`)
    const mentions: Mention[] = []
    for (const m of (t.mentions ?? []) as Json[]) {
      const found = m.sender ? undefined : await senderOf($, String(m.slack ?? ''))
      mentions.push({
        sender: String(m.sender || found?.sender || ''),
        message: String(m.message || found?.message || ''),
        slack: String(m.slack ?? ''),
        reaction: reactions[`${m.channel}:${m.ts}`] ?? '',
        place: await placeOf($, String(m.channel ?? channelOf(String(m.slack ?? '')))),
      })
    }
    const channel = e.channel ?? t.channel ?? loop?.slack?.channel ?? channelOf(String(e.slack ?? t.slack ?? ''))
    const ts = e.ts ?? t.ts ?? loop?.slack?.ts
    let agentState: PrRow['agentState'] = 'none'
    let agent = ''
    if (term) {
      agentState = now - term.lastOutputAt < 15000 ? 'working' : 'waiting'
      agent = `${term.title.replace(/^[^\w#(]+/u, '')} · ${agentState === 'working' ? L.working : L.idle}`
    } else if (handle) {
      agentState = 'gone'
      agent = L.gone
    }
    const loopText = loopSummary(loop)
    const prUrl = String(e.url ?? '')
    const prAt = ACTIVE.includes(status) && prUrl ? await prUpdatedAt($, key, prUrl, now) : 0
    const slack = String(e.slack ?? t.slack ?? '')
    const known = e.sender || t.sender
    const found = known ? undefined : await senderOf($, slack)
    rows.push({
      key,
      repo: String(e.repo ?? `${owner}/${repo}`),
      number: Number(e.number ?? number),
      url: String(e.url ?? ''),
      title: String(e.title ?? t.title ?? ''),
      status,
      time: String(e.time ?? ''),
      note: String(e.note ?? ''),
      link: String(t.link ?? e.link ?? ''),
      sender: String(known || found?.sender || ''),
      message: String(e.message || t.message || found?.message || ''),
      slack,
      origin: String(e.origin ?? t.origin ?? ''),
      reaction: channel && ts ? reactions[`${channel}:${ts}`] ?? '' : '',
      place: await placeOf($, String(channel ?? '')),
      mentions,
      agent: [agent, loopText].filter(Boolean).join(' — '),
      agentState,
      prUpdatedAt: prAt,
    })
  }
  const byTime = (a: PrRow, b: PrRow) => b.time.localeCompare(a.time)
  const active = rows.filter(r => ACTIVE.includes(r.status)).sort(byTime)
  const done = rows
    .filter(r => !ACTIVE.includes(r.status) && now - Date.parse(r.time) < DAY_MS)
    .sort(byTime)
    .slice(0, 15)
  const queue: string[] = ((state?.queue ?? []) as Json[]).map(q => `${q.owner}/${q.repo}#${q.number}`.toLowerCase())
  const maxSessions = Number(settings?.max_sessions ?? 4)
  const h: Json = settings?.hold ?? {}
  const hold = {
    approvedAfter: Number(h.approved_after ?? 30), changesAfter: Number(h.changes_after ?? 60),
    checkEvery: Number(h.check_every ?? 30),
  }
  const held = Object.entries((state?.held ?? {}) as Json).map(([key, v]: [string, Json]) => ({
    key, since: Number(v.since ?? 0) * 1000, checked: Number(v.checked ?? 0) * 1000, reason: String(v.reason ?? ''),
  }))
  return { active, done, queued: queue.length, queue, sessions: Object.keys(handles).length, maxSessions, held, hold, listener, updatedAt: now, error: '', language }
}

async function tick($: any) {
  if (ticking) return
  ticking = true
  try {
    const next = await collect($)
    await update($, snapshot, () => next)
  } catch (err) {
    await update($, snapshot, s => ({ ...(s ?? EMPTY), error: String(err).slice(0, 200) }))
  } finally {
    ticking = false
  }
}

// The pane refreshes only once it has been opened, so sessions that never show it (every review session) poll nothing.
let polling = false

function startPolling($: any) {
  if (polling) return
  polling = true
  $.clock.every(10000, () => tick($))
}

async function show($: any) {
  startPolling($)
  void tick($)
  return $.ui.open({ id: PANE, title: TITLE })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'reviewer-panel', description: 'Show the agentic-reviewer PR pane' })
    return next(e)
  })

  on('command.run', { command: 'reviewer-panel' }, async $ => {
    await show($)
    return { text: TEXT[language].opened }
  })

  // Starting the listener opens the pane in that session; review sessions never open it.
  on('prompt.submit', async ($, e, next) => {
    if (/^\s*\/agentic-reviewer:(start|status)\b/.test(e.text ?? '')) await show($)
    return next(e)
  }).catch(($, e, next) => next(e)) // the pane failing to open never blocks the prompt

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Link } = $.ui.resolve(e)
    startPolling($) // a reload while the pane is open starts the timer again
    const snap = (await read($, snapshot)) ?? EMPTY
    const L = TEXT[snap.language] ?? TEXT.en
    const width = Math.max(30, (e.props as any).bodyColumns ?? 80)
    const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
    const rule = (ch: string, n = width) => ch.repeat(Math.max(10, n))

    const inner = Math.max(26, width - 4)
    const COLOR: Record<string, string> = {
      reviewing: 'cyan', queued: 'gray', changes: 'yellow', approved: 'green', merged: 'white',
      closed: 'gray', skipped: 'gray', ignored: 'gray', failed: 'red',
    }
    // The Slack reaction mirrors the status; show it only when it says something the status line does not.
    const extra = (r: PrRow, reaction: string) =>
      reaction && !(L.status[r.status] ?? '').startsWith(reaction) ? `${reaction} ` : ''

    const who = (sender: string, place: string, reaction: string, also = false) => (
      <Box flexDirection="row">
        <Text>{reaction}</Text>
        <Text bold color="cyan">{sender || L.someone}</Text>
        <Text dimColor>{also ? L.alsoSent : ''}{place ? L.in(place) : ''}</Text>
      </Box>
    )
    const quote = (text: string, n: number) => (
      <Box paddingLeft={2}>
        <Text italic dimColor>“{cut(text, n)}”</Text>
      </Box>
    )

    const card = (r: PrRow, isActive: boolean, position = '', holdLine = '') => (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={COLOR[r.status] ?? 'gray'}
        paddingX={1}
        marginBottom={1}
      >
        <Box flexDirection="row">
          <Text bold color={COLOR[r.status]}>{L.status[r.status] ?? r.status}</Text>
          <Text bold>  {r.repo.split('/')[1]}#{r.number}</Text>
          <Text dimColor>  {(r.time || '').slice(11, 16)}</Text>
          {position ? <Text bold color="yellow">  {position}</Text> : null}
          {isActive && r.prUpdatedAt ? <Text dimColor>  · {L.updated(ago((snap.updatedAt || r.prUpdatedAt) - r.prUpdatedAt))}</Text> : null}
        </Box>
        <Text>{cut(r.title, inner)}</Text>
        <Box flexDirection="column" marginTop={1}>
          {r.sender ? (
            <Box flexDirection="column">
              {who(r.sender, r.place, extra(r, r.reaction))}
              {r.message ? quote(r.message, inner * 3) : null}
            </Box>
          ) : (
            <Text dimColor>
              {r.origin.startsWith('GitHub')
                ? L.githubRequest
                : `${extra(r, r.reaction)}${L.slackMessage}${r.place ? L.in(r.place) : ''}`}
            </Text>
          )}
          {r.mentions.map(m => (
            <Box flexDirection="column" marginTop={1}>
              {who(m.sender, m.place, extra(r, m.reaction), true)}
              {m.message ? quote(m.message, inner * 2) : null}
            </Box>
          ))}
        </Box>
        {holdLine ? (
          <Box marginTop={1}>
            <Text color="blue">💤 {holdLine}</Text>
          </Box>
        ) : null}
        {isActive && r.agent ? (
          <Box marginTop={1}>
            <Text color={r.agentState === 'working' ? 'green' : r.agentState === 'gone' ? 'red' : 'yellow'}>
              {r.agentState === 'working' ? '● ' : '○ '}{cut(r.agent, inner * 2)}
            </Text>
          </Box>
        ) : null}
        {!isActive && r.note ? (
          <Box marginTop={1}>
            <Text dimColor>{cut(r.note, inner)}</Text>
          </Box>
        ) : null}
        {r.link || r.slack || r.url ? (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>{rule('┄', inner)}</Text>
            <Box flexDirection="row">
              {r.link ? <Link href={r.link} label={L.review} /> : <Link href={r.url} label={L.pr} />}
              {r.slack ? <Text>  </Text> : null}
              {r.slack ? <Link href={r.slack} label={L.slack} /> : null}
              {r.link ? <Text>  </Text> : null}
              {r.link ? <Link href={r.url} label={L.prShort} /> : null}
            </Box>
          </Box>
        ) : null}
      </Box>
    )

    const section = (title: string, rows: PrRow[], empty: string, isActive: boolean) => (
      <Box flexDirection="column">
        <Box marginTop={1}>
          <Text bold>{title} ({rows.length}) </Text>
          <Text dimColor>{rule('─', width - title.length - 6)}</Text>
        </Box>
        {rows.length === 0 ? <Text dimColor>{empty}</Text> : null}
        {rows.map(r => card(r, isActive))}
      </Box>
    )

    const reviewing = snap.active.filter(r => r.status === 'reviewing')
    const order = snap.queue ?? []
    const rank = (r: PrRow) => {
      const i = order.indexOf(r.key)
      return i < 0 ? order.length : i
    }
    const queuedRows = snap.active.filter(r => r.status === 'queued').sort((a, b) => rank(a) - rank(b))
    const heldOf = Object.fromEntries((snap.held ?? []).map(x => [x.key, x]))
    const pending = snap.active.filter(r => (r.status === 'changes' || r.status === 'approved') && !heldOf[r.key])
    const holdRows = snap.active
      .filter(r => (r.status === 'changes' || r.status === 'approved') && heldOf[r.key])
      .sort((a, b) => (heldOf[a.key]?.since ?? 0) - (heldOf[b.key]?.since ?? 0))
    const hc = snap.hold ?? EMPTY.hold
    const nextCheck = (key: string) => {
      const x = heldOf[key]
      if (!x) return ''
      const due = x.checked + hc.checkEvery * 60000 - (snap.updatedAt || 0)
      return `${L.heldFor(ago((snap.updatedAt || 0) - x.since))} · ${L.nextCheck(ago(Math.max(due, 0)))}`
    }

    return (
      <Box flexDirection="column">
        <Text color={snap.listener ? 'green' : 'red'}>
          {snap.listener ? L.running : L.stopped}
          {snap.listener ? L.sessions(snap.sessions ?? 0, snap.maxSessions ?? 4) : ''}
          {snap.queued ? L.queued(snap.queued) : ''}
        </Text>
        {snap.error ? <Text color="red">{snap.error}</Text> : null}
        {section(L.reviewingNow, reviewing, L.noneReviewing, true)}
        {section(L.pending, pending, L.nonePending, true)}
        {queuedRows.length ? (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Text bold>{L.queueTitle} ({queuedRows.length}) </Text>
              <Text dimColor>{rule('─', width - L.queueTitle.length - 6)}</Text>
            </Box>
            <Text dimColor>{L.queueHint}</Text>
            {queuedRows.map((r, i) => card(r, true, L.position(i + 1)))}
          </Box>
        ) : null}
        {holdRows.length ? (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Text bold>{L.holdTitle} ({holdRows.length}) </Text>
              <Text dimColor>{rule('─', width - L.holdTitle.length - 6)}</Text>
            </Box>
            <Text dimColor>{L.holdHint(hc.approvedAfter, hc.changesAfter, hc.checkEvery)}</Text>
            {holdRows.map(r => card(r, true, '', nextCheck(r.key)))}
          </Box>
        ) : null}
        {section(L.done, snap.done, L.noneDone, false)}
      </Box>
    )
  })
}
