const express = require('express')
const router = express.Router()
const { tournaments, registrations, matchWinners } = require('../store')

let _io = null
function setIo(io) { _io = io }

function broadcastBracket(tournamentId) {
  if (!_io) return
  const tournament = tournaments.find((t) => String(t.id) === String(tournamentId))
  if (!tournament) return
  const bracketData = getBracket(tournamentId, tournament)
  _io.to(`tournament_${tournamentId}`).emit('bracket_updated', { bracket: bracketData.rounds || [] })
}

function getRegisteredCount(id) {
  return (registrations[id] || []).length
}

function tournamentWithRegistration(tournament, userName) {
  const registeredUsers = (registrations[tournament.id] || []).map((r) => r.name)
  const registeredCount = getRegisteredCount(tournament.id)
  const seatsLeft = Math.max(0, tournament.players - registeredCount)
  return {
    ...tournament,
    registeredCount,
    seatsLeft,
    registeredUsers,
    status: registeredCount >= tournament.players ? 'started' : tournament.status,
    userRegistered: userName ? registeredUsers.includes(userName) : false,
  }
}

function buildBracket(registeredUsers, winners = {}) {
  if (registeredUsers.length < 2) return { rounds: [], seeding: null }

  const rounds = []
  let matchCounter = 1
  let prevMatches = []

  // Round 1
  const r1Matches = []
  for (let i = 0; i < registeredUsers.length; i += 2) {
    if (i + 1 < registeredUsers.length) {
      const id = matchCounter++
      r1Matches.push({
        id,
        playerA: registeredUsers[i],
        playerB: registeredUsers[i + 1],
        winner: winners[id] || null,
      })
    }
  }
  rounds.push({ round: 1, matches: r1Matches })
  prevMatches = r1Matches

  // Subsequent rounds — apply known winners
  while (prevMatches.length > 1) {
    const nextMatches = []
    for (let i = 0; i < prevMatches.length; i += 2) {
      const first = prevMatches[i]
      const second = prevMatches[i + 1]
      if (first && second) {
        const id = matchCounter++
        nextMatches.push({
          id,
          playerA: winners[first.id] || `Winner of M${first.id}`,
          playerB: winners[second.id] || `Winner of M${second.id}`,
          winner: winners[id] || null,
        })
      }
    }
    if (nextMatches.length > 0) {
      rounds.push({ round: rounds.length + 1, matches: nextMatches })
    }
    prevMatches = nextMatches
  }

  return {
    rounds,
    seeding: {
      leftSide: registeredUsers.slice(0, Math.ceil(registeredUsers.length / 2)),
      rightSide: registeredUsers.slice(Math.ceil(registeredUsers.length / 2)),
    },
  }
}

function getBracket(tournamentId, tournament) {
  const filled = (registrations[tournamentId] || []).map((r) => r.name)
  const padded = [
    ...filled,
    ...Array(Math.max(0, tournament.players - filled.length)).fill(''),
  ]
  return buildBracket(padded, matchWinners[tournamentId] || {})
}

router.get('/status', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() })
})

router.post('/tournaments', (req, res) => {
  const { name } = req.body
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' })
  }
  req.session.name = name.trim()
  if (!req.session.points) {
    req.session.points = Math.floor(Math.random() * 8000) + 2000
  }
  res.json({ user: req.session.name, tournaments })
})

router.get('/tournaments', (req, res) => {
  const userName = req.session?.name || null
  res.json({
    user: userName,
    tournaments: tournaments.map((t) => tournamentWithRegistration(t, userName)),
  })
})

router.post('/register/:id', (req, res) => {
  const { id } = req.params
  const tournament = tournaments.find((t) => String(t.id) === String(id))
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' })

  const userName = req.session?.name
  const sessionId = req.sessionID
  if (!userName) return res.status(400).json({ error: 'You must provide a name before registering' })

  registrations[id] = registrations[id] || []

  if (registrations[id].some((r) => r.name === userName)) {
    return res.status(400).json({ error: 'You are already registered for this tournament' })
  }
  if (getRegisteredCount(id) >= tournament.players) {
    return res.status(400).json({ error: 'Tournament is full' })
  }
  if ((req.session.points || 0) < tournament.entryFee) {
    return res.status(402).json({
      error: `Insufficient points. This tournament requires ${tournament.entryFee} points but you only have ${req.session.points || 0}.`,
    })
  }

  req.session.points = (req.session.points || 0) - tournament.entryFee
  registrations[id].push({ sessionId, name: userName })

  const registeredCount = getRegisteredCount(id)
  if (registeredCount >= tournament.players) tournament.status = 'started'

  res.json({
    tournament: tournamentWithRegistration(tournament, userName),
    registeredCount,
    seatsLeft: Math.max(0, tournament.players - registeredCount),
    message: registeredCount >= tournament.players
      ? 'Tournament is now full and will start.'
      : 'You have been registered successfully.',
  })
})

router.get('/tournaments/:id', (req, res) => {
  const { id } = req.params
  const tournament = tournaments.find((t) => String(t.id) === String(id)) || {
    id,
    name: `Tournament ${id}`,
    image: `/images/tournament-${id}.png`,
    entryFee: 0,
    currency: 'EGP',
    players: 0,
    status: 'waiting for players',
    description: `Details for tournament ${id}`,
  }

  const userName = req.session?.name
  const sessionId = req.sessionID

  if (!userName) {
    return res.status(400).json({ error: 'You must provide your name before entering the tournament.' })
  }

  registrations[id] = registrations[id] || []
  let autoRegistered = false
  let registrationMessage = 'You are already registered for this tournament.'

  const alreadyRegistered = registrations[id].some((r) => r.name === userName)
  if (!alreadyRegistered) {
    if (getRegisteredCount(id) >= tournament.players) {
      return res.status(409).json({ error: 'This tournament is full. No more players can join.' })
    } else if ((req.session.points || 0) < tournament.entryFee) {
      return res.status(402).json({
        error: `Insufficient points. This tournament requires ${tournament.entryFee} points but you only have ${req.session.points || 0}.`,
      })
    } else {
      req.session.points = (req.session.points || 0) - tournament.entryFee
      registrations[id].push({ sessionId, name: userName })
      autoRegistered = true
      registrationMessage = `You have been registered. ${tournament.entryFee} points deducted.`
      broadcastBracket(id)
    }
  }

  const bracketData = getBracket(id, tournament)
  const tournamentPayload = {
    ...tournamentWithRegistration(tournament, userName),
    bracket: bracketData.rounds || [],
    seeding: bracketData.seeding,
  }

  res.json({ user: userName, autoRegistered, registrationMessage, tournament: tournamentPayload })
})

router.post('/tournaments/:id/reset', (req, res) => {
  const { id } = req.params
  const tournament = tournaments.find((t) => String(t.id) === String(id))
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' })

  registrations[id] = []
  if (matchWinners[id]) delete matchWinners[id]
  tournament.status = 'waiting for players'

  broadcastBracket(id)
  res.json({ ok: true })
})

router.get('/session', (req, res) => {
  res.json({ user: req.session?.name || null, points: req.session?.points || null })
})

module.exports = { router, getBracket, setIo }
