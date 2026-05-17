const tournaments = [
  {
    id: 1,
    name: 'Head Ball',
    image: '/images/ballHead.png',
    entryFee: 25,
    currency: 'Points',
    players: 4,
    status: 'waiting for players',
    description: 'Head Ball is a fast-paced sports tournament with energy and skill.',
  },
  {
    id: 2,
    name: 'Dutch Auction',
    image: '/images/dutchAuction.png',
    entryFee: 40,
    currency: 'Points',
    players: 4,
    status: 'ongoing',
    description: 'A strategic Dutch Auction tournament where bids drop over time.',
  },
  {
    id: 3,
    name: 'AirHockey',
    image: '/images/airHocky.png',
    entryFee: 60,
    currency: 'Points',
    players: 4,
    status: 'ongoing',
    description: 'AirHockey brings high-speed action and close competition.',
  },
]

// { [tournamentId]: [{ sessionId, name }] }
const registrations = {}

// { [tournamentId]: { [matchId]: winnerName } }
const matchWinners = {}

module.exports = { tournaments, registrations, matchWinners }
