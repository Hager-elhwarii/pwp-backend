const express = require('express')
const router = express.Router()

const tournaments = [
  {
    id: 1,
    name: 'Head Ball',
    image: '/images/ballHead.png',
    entryFee: 25,
    currency: 'Points',
    players: 8,
    status: 'waiting for players',
    description: 'Head Ball is a fast-paced sports tournament with energy and skill.',
  },
  {
    id: 2,
    name: 'Dutch Auction',
    image: '/images/dutchAuction.png',
    entryFee: 40,
    currency: 'Points',
    players: 8,
    status: 'ongoing',
    description: 'A strategic Dutch Auction tournament where bids drop over time.',
  },
  {
    id: 3,
    name: 'AirHockey',
    image: '/images/airHocky.png',
    entryFee: 60,
    currency: 'Points',
    players: 16,
    status: 'ongoing',
    description: 'AirHockey brings high-speed action and close competition.',
  },
]

const registrations = {}

router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  })
})

router.post('/tournaments', (req, res) => {
  const { name } = req.body
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' })
  }
  req.session.name = name.trim()

  res.json({
    user: req.session.name,
    tournaments,
  })
})

function getRegisteredCount(id) {
  return (registrations[id] || []).length
}

function tournamentWithRegistration(tournament, userName) {
  const registeredUsers = (registrations[tournament.id] || []).map((registration) => registration.name)
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

function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function buildBracket(registeredUsers) {
  if (registeredUsers.length < 2) return { rounds: [], seeding: null }

  const rounds = []
  let matches = []
  let currentPlayers = [...registeredUsers]

  for (let i = 0; i < currentPlayers.length; i += 2) {
    if (i + 1 < currentPlayers.length) {
      matches.push({
        id: matches.length + 1,
        playerA: currentPlayers[i],
        playerB: currentPlayers[i + 1],
      })
    }
  }
  rounds.push({ round: 1, matches })

  while (matches.length > 1) {
    const nextMatches = []
    for (let i = 0; i < matches.length; i += 2) {
      const first = matches[i]
      const second = matches[i + 1]
      if (first && second) {
        nextMatches.push({
          id: nextMatches.length + 1,
          playerA: `Winner of M${first.id}`,
          playerB: `Winner of M${second.id}`,
        })
      }
    }
    if (nextMatches.length > 0) {
      rounds.push({ round: rounds.length + 1, matches: nextMatches })
    }
    matches = nextMatches
  }

  return {
    rounds,
    seeding: {
      leftSide: registeredUsers.slice(0, Math.ceil(registeredUsers.length / 2)),
      rightSide: registeredUsers.slice(Math.ceil(registeredUsers.length / 2)),
    },
  }
}

router.get('/tournaments', (req, res) => {
  res.json({
    user: req.session?.name || null,
    tournaments: tournaments.map((tournament) => tournamentWithRegistration(tournament, req.session?.name || null)),
  })
})

router.post('/register/:id', (req, res) => {
  const { id } = req.params
  const tournament = tournaments.find((item) => String(item.id) === String(id))

  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' })
  }

  const userName = req.session?.name
  const sessionId = req.sessionID
  if (!userName) {
    return res.status(400).json({ error: 'You must provide a name before registering' })
  }

  registrations[id] = registrations[id] || []

  if (registrations[id].some((registration) => registration.name === userName)) {
    return res.status(400).json({ error: 'You are already registered for this tournament' })
  }

  if (getRegisteredCount(id) >= tournament.players) {
    return res.status(400).json({ error: 'Tournament is full' })
  }

  registrations[id].push({ sessionId, name: userName })

  const registeredCount = getRegisteredCount(id)
  if (registeredCount >= tournament.players) {
    tournament.status = 'started'
  }

  res.json({
    tournament: tournamentWithRegistration(tournament, userName),
    registeredCount,
    seatsLeft: Math.max(0, tournament.players - registeredCount),
    message: registeredCount >= tournament.players ? 'Tournament is now full and will start.' : 'You have been registered successfully.',
  })
})

router.get('/tournaments/:id', (req, res) => {
  const { id } = req.params
  const tournament = tournaments.find((item) => String(item.id) === String(id)) || {
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

  const alreadyRegistered = registrations[id].some((registration) => registration.name === userName)
  if (!alreadyRegistered) {
    if (getRegisteredCount(id) >= tournament.players) {
      registrationMessage = 'Tournament is full; you cannot be auto-registered.'
    } else {
      registrations[id].push({ sessionId, name: userName })
      autoRegistered = true
      registrationMessage = 'You have been automatically registered for this tournament.'
    }
  }

  const tournamentPayload = {
    ...tournamentWithRegistration(tournament, userName),
  }

  const filledUsers = tournamentWithRegistration(tournament, userName).registeredUsers
  const paddedUsers = [
    ...filledUsers,
    ...Array(Math.max(0, tournament.players - filledUsers.length)).fill(''),
  ]
  const bracketData = buildBracket(paddedUsers)
  tournamentPayload.bracket = bracketData.rounds || []
  tournamentPayload.seeding = bracketData.seeding

  res.json({
    user: userName,
    autoRegistered,
    registrationMessage,
    tournament: tournamentPayload,
  })
})

router.get('/session', (req, res) => {
  res.json({
    user: req.session?.name || null,
  })
})

module.exports = router
