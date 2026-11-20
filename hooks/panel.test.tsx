// @ts-nocheck — stand-ins answer with loose fixtures
import { expect, test } from 'claude-code/testing'

const NOW = Date.parse('2026-11-19T20:00:00-03:00')
const H = '/home/u/.agentic-reviewer'
const FILES: Record<string, string> = {
  [`${H}/events.jsonl`]: [
    { time: '2026-11-19T19:00:00-03:00', key: 'acme/app#7', repo: 'acme/app', number: 7, url: 'https://github.com/acme/app/pull/7',
      status: 'reviewing', title: 'feat: dock', channel: 'C1', ts: '1.1', sender: 'Ana', message: 'pode revisar?', slack: 'https://s/1' },
    { time: '2026-11-19T19:30:00-03:00', key: 'acme/app#7', repo: 'acme/app', number: 7, url: 'https://github.com/acme/app/pull/7',
      status: 'changes', title: 'feat: dock', link: 'https://github.com/acme/app/pull/7#r1' },
    { time: '2026-11-19T18:00:00-03:00', key: 'acme/api#3', repo: 'acme/api', number: 3, url: 'https://github.com/acme/api/pull/3',
      status: 'merged', title: 'fix: x', sender: 'Beto', message: 'olha essa' },
    { time: '2026-11-19T19:40:00-03:00', key: 'acme/app#9', repo: 'acme/app', number: 9, url: 'https://github.com/acme/app/pull/9',
      status: 'queued', title: 'feat: later', sender: 'Duda', message: 'depois' },
    { time: '2026-11-19T19:50:00-03:00', key: 'acme/app#8', repo: 'acme/app', number: 8, url: 'https://github.com/acme/app/pull/8',
      status: 'queued', title: 'feat: first', sender: 'Eva', message: 'primeiro' },
  ].map(e => JSON.stringify(e)).join('\n') + '\n',
  [`${H}/reactions.jsonl`]: '{"time":1,"channel":"C1","ts":"1.1","status":"changes","emoji":"arrows_counterclockwise"}\n',
  [`${H}/state.json`]: JSON.stringify({
    tracked: { 'acme/app#7': { status: 'changes', mentions: [{ channel: 'C2', ts: '2.2', sender: 'Caio', message: 'essa também', slack: 'https://s/2' }] } },
    terminals: { 'acme/app#7': 'term_1' },
    queue: [{ owner: 'acme', repo: 'app', number: '8' }, { owner: 'acme', repo: 'app', number: '9' }],
  }),
  [`${H}/listener.lock`]: '123',
  [`${H}/settings.json`]: '{"language": "pt-BR", "max_sessions": 6}',
  [`${H}/loops/acme-app-7.json`]: JSON.stringify({ round: 2, findings: [{ status: 'open' }, { status: 'fixed in abc' }] }),
}

test('the pane shows the sender, the message, the reaction and the agent', async ($, on) => {
  on('command.register', () => ({ value: { command: 'reviewer-panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: '' }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: NOW }))
  on('fs.read', (_, e: any) => (e.path in FILES ? { value: FILES[e.path] } : { deny: 'ENOENT' }))
  on('fs.stat', (_, e: any) =>
    e.path in FILES ? { value: { kind: 'file', size: FILES[e.path].length, mtimeMs: 0, isLink: false } } : { deny: 'ENOENT' })
  on('process.run', (_, e: any) => {
    const argv: string[] = e.argv
    if (argv[0] === 'printenv') return { value: { exitCode: 0, stdout: '/home/u\n', stderr: '' } }
    if (argv[0] === 'slackcli')
      return { value: { exitCode: 0, stderr: '', stdout: JSON.stringify({ matches: [{ channel: { name: 'frontend', is_im: false, is_mpim: false } }] }) } }
    if (argv[0] === 'orca')
      return { value: { exitCode: 0, stderr: '', stdout: JSON.stringify({ result: { terminals: [
        { handle: 'term_1', title: '✳ PR 7 review', lastOutputAt: NOW - 120000 }] } }) } }
    if (argv[0] === 'gh')
      return { value: { exitCode: 0, stderr: '', stdout: JSON.stringify({ updatedAt: new Date(NOW - 30 * 60000).toISOString() }) } }
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'reviewer-panel', args: '' })
  await new Promise(r => setTimeout(r, 50))

  const ui = await $.ui.mount({
    plugin: 'reviewer-panel', component: 'Pane', requestId: 'agentic-reviewer', surface: 'terminal',
    props: { title: 'PR reviews', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  } as any)
  expect((await ui.find({ type: 'Text', text: /^Ana$/ }))?.text).toBe('Ana')
  expect((await ui.find({ type: 'Text', text: /em #frontend/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /Pendentes/ }))?.text).toContain('(1)')
  expect((await ui.find({ type: 'Text', text: /pode revisar/ }))?.text).toBe('“pode revisar?”')
  expect((await ui.find({ type: 'Text', text: /também mandou/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /round 2/ }))?.text).toContain('1/2 findings resolvidos')
  expect((await ui.find({ type: 'Text', text: /aguardando/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /PR atualizada há 30min/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /Beto/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /Fila/ }))?.text).toContain('(2)')
  expect((await ui.find({ type: 'Text', text: /1\/6 sessões/ }))).toBeTruthy()
  const all = await ui.findAll({ type: 'Text' })
  const at = (re: RegExp) => all.findIndex(t => re.test(t.text ?? ''))
  expect(at(/próxima/)).toBeLessThan(at(/#2/))
  expect(at(/feat: first/)).toBeLessThan(at(/feat: later/))
  await ui.unmount()
})
