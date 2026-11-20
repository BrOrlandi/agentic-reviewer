export type Mention = { sender: string; message: string; slack: string; reaction: string; place: string }

export type PrRow = {
  key: string
  repo: string
  number: number
  url: string
  title: string
  status: string
  time: string
  note: string
  link: string
  sender: string
  message: string
  slack: string
  origin: string
  reaction: string
  place: string
  mentions: Mention[]
  agent: string
  agentState: 'working' | 'waiting' | 'gone' | 'none'
  prUpdatedAt: number
}

export type Snapshot = {
  active: PrRow[]
  done: PrRow[]
  queued: number
  queue: string[]
  sessions: number
  maxSessions: number
  held: { key: string; since: number; checked: number; reason: string }[]
  hold: { approvedAfter: number; changesAfter: number; checkEvery: number }
  listener: boolean
  updatedAt: number
  error: string
  language: 'en' | 'pt-BR'
}

declare module 'claude-code' {
  interface PluginState {
    'agentic-reviewer': { snapshot: Shaped<Snapshot> }
  }
}
