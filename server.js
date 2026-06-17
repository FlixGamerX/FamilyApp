const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let events = [
  { id: 1, date: '2026-06-18', text: 'Familienabend' },
  { id: 2, date: '2026-06-20', text: 'Einkaufen' }
];

let todos = [
  { id: 1, text: 'Bücher zurückbringen', done: false },
  { id: 2, text: 'Wocheneinkauf planen', done: true }
];

const gameRooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoomState(roomId) {
  return {
    roomId,
    board: Array(9).fill(''),
    currentPlayer: 'X',
    winner: '',
    draw: false,
    players: {},
    createdAt: Date.now()
  };
}

function sortEvents() {
  events.sort((a, b) => a.date.localeCompare(b.date));
}

function sendState() {
  io.emit('state', { events, todos });
}

function getRoomState(roomId) {
  return gameRooms.get(roomId) || null;
}

function emitGameState(roomId) {
  const room = getRoomState(roomId);
  if (!room) return;
  io.to(roomId).emit('game:state', {
    roomId,
    board: room.board,
    currentPlayer: room.currentPlayer,
    winner: room.winner,
    draw: room.draw,
    players: room.players
  });
}

function checkWinner(board) {
  const combos = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (const combo of combos) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return '';
}

function resetRoom(roomId) {
  const room = getRoomState(roomId);
  if (!room) return;
  room.board = Array(9).fill('');
  room.currentPlayer = 'X';
  room.winner = '';
  room.draw = false;
  emitGameState(roomId);
}

app.get('/api/state', (req, res) => {
  res.json({ events, todos });
});

io.on('connection', (socket) => {
  socket.emit('state', { events, todos });

  socket.on('event:add', (payload) => {
    const text = payload?.text?.trim();
    const date = payload?.date?.trim();

    if (!text || !date) return;

    events.push({
      id: Date.now() + Math.random(),
      date,
      text
    });

    sortEvents();
    sendState();
  });

  socket.on('event:remove', (eventId) => {
    events = events.filter((event) => event.id !== eventId);
    sendState();
  });

  socket.on('todo:add', (payload) => {
    const text = payload?.text?.trim();
    if (!text) return;

    todos.push({
      id: Date.now() + Math.random(),
      text,
      done: false
    });

    sendState();
  });

  socket.on('todo:toggle', (todoId) => {
    todos = todos.map((todo) =>
      todo.id === todoId ? { ...todo, done: !todo.done } : todo
    );
    sendState();
  });

  socket.on('todo:remove', (todoId) => {
    todos = todos.filter((todo) => todo.id !== todoId);
    sendState();
  });

  socket.on('game:create-room', () => {
    const roomId = generateRoomCode();
    const room = createRoomState(roomId);
    gameRooms.set(roomId, room);
    socket.join(roomId);
    room.players[socket.id] = 'X';
    socket.emit('game:room-created', { roomId });
    emitGameState(roomId);
  });

  socket.on('game:join-room', ({ roomId }) => {
    const code = String(roomId || '').toUpperCase();
    const room = getRoomState(code);
    if (!room) {
      socket.emit('game:room-error', 'Raum wurde nicht gefunden.');
      return;
    }

    if (Object.keys(room.players).length >= 2) {
      socket.emit('game:room-error', 'Dieser Raum ist bereits voll.');
      return;
    }

    socket.join(code);
    room.players[socket.id] = Object.keys(room.players).length === 0 ? 'X' : 'O';
    emitGameState(code);
  });

  socket.on('game:leave-room', ({ roomId }) => {
    const code = String(roomId || '').toUpperCase();
    const room = getRoomState(code);
    if (!room) return;
    socket.leave(code);
    delete room.players[socket.id];
    if (Object.keys(room.players).length === 0) {
      gameRooms.delete(code);
    } else {
      emitGameState(code);
    }
  });

  socket.on('game:move', ({ roomId, index }) => {
    const code = String(roomId || '').toUpperCase();
    const room = getRoomState(code);
    if (!room) return;
    const symbol = room.players[socket.id];
    if (!Number.isInteger(index) || index < 0 || index > 8) return;
    if (room.winner || room.draw) return;
    if (symbol !== room.currentPlayer) return;
    if (room.board[index]) return;

    room.board[index] = symbol;
    const winner = checkWinner(room.board);

    if (winner) {
      room.winner = winner;
    } else if (room.board.every(Boolean)) {
      room.draw = true;
    } else {
      room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
    }

    emitGameState(code);
  });

  socket.on('game:reset', ({ roomId }) => {
    const code = String(roomId || '').toUpperCase();
    resetRoom(code);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
