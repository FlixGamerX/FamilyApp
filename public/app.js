const socket = io();

let state = { events: [], todos: [] };

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatEventDateTime(event) {
  const date = formatDate(event.date);
  const time = event.time ? ` · ${formatTime(event.time)}` : '';
  return `${date}${time}`;
}

function updateDashboard() {
  const todayCountEl = document.getElementById('today-count');
  const todoCountEl = document.getElementById('todo-count');
  const eventCountEl = document.getElementById('event-count');
  const nextEventEl = document.getElementById('next-event');

  if (todayCountEl) {
    const pending = state.todos.filter((todo) => !todo.done).length;
    todayCountEl.textContent = pending;
  }

  if (todoCountEl) {
    todoCountEl.textContent = state.todos.length;
  }

  if (eventCountEl) {
    eventCountEl.textContent = state.events.length;
  }

  if (nextEventEl) {
    const upcoming = [...state.events].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    })[0];
    nextEventEl.textContent = upcoming
      ? `${upcoming.text} · ${formatEventDateTime(upcoming)}`
      : 'Kein Termin';
  }
}

function renderEvents() {
  const list = document.getElementById('event-list');
  if (!list) return;

  const search = document.getElementById('event-search');
  const query = search ? search.value.trim().toLowerCase() : '';
  const filtered = state.events.filter((event) => {
    const searchable = `${event.text} ${event.date} ${event.time || ''} ${formatEventDateTime(event)}`.toLowerCase();
    return !query || searchable.includes(query);
  });

  if (!filtered.length) {
    list.innerHTML = '<li class="empty-state">Keine passenden Termine.</li>';
    return;
  }

  list.innerHTML = '';
  filtered.forEach((event) => {
    const item = document.createElement('li');
    item.className = 'list-item';
    item.innerHTML = `
      <main>
        <div>
          <strong>${event.text}</strong>
          <small>${formatEventDateTime(event)}</small>
        </div>
      </main>
      <button class="icon-btn" data-remove-event="${event.id}" aria-label="Termin entfernen">✕</button>
    `;
    list.appendChild(item);
  });
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  if (!list) return;

  const search = document.getElementById('todo-search');
  const query = search ? search.value.trim().toLowerCase() : '';
  const filtered = state.todos.filter((todo) => {
    return !query || todo.text.toLowerCase().includes(query);
  });

  if (!filtered.length) {
    list.innerHTML = '<li class="empty-state">Keine passenden Aufgaben.</li>';
    return;
  }

  list.innerHTML = '';
  filtered.forEach((todo) => {
    const item = document.createElement('li');
    item.className = `list-item${todo.done ? ' done' : ''}`;
    item.innerHTML = `
      <main>
        <input type="checkbox" data-toggle-todo="${todo.id}" ${todo.done ? 'checked' : ''}>
        <span>${todo.text}</span>
      </main>
      <button class="icon-btn" data-remove-todo="${todo.id}" aria-label="Aufgabe entfernen">✕</button>
    `;
    list.appendChild(item);
  });
}

function initCalendar() {
  const form = document.getElementById('event-form');
  const inputDate = document.getElementById('event-date');
  const inputTime = document.getElementById('event-time');
  const inputText = document.getElementById('event-text');
  const list = document.getElementById('event-list');
  const search = document.getElementById('event-search');

  if (!form || !inputDate || !inputTime || !inputText || !list) return;

  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date();
  const defaultTime = `${String(nowTime.getHours()).padStart(2, '0')}:${String(nowTime.getMinutes()).padStart(2, '0')}`;
  inputDate.value = today;
  inputTime.value = defaultTime;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const date = inputDate.value;
    const time = inputTime.value;
    const text = inputText.value.trim();

    if (!date || !text) return;

    socket.emit('event:add', { date, time, text });
    form.reset();
    inputDate.value = today;
    inputTime.value = defaultTime;
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-event]');
    if (!button) return;
    socket.emit('event:remove', Number(button.dataset.removeEvent));
  });

  if (search) {
    search.addEventListener('input', renderEvents);
  }
}

function initTodo() {
  const form = document.getElementById('todo-form');
  const input = document.getElementById('todo-input');
  const list = document.getElementById('todo-list');
  const search = document.getElementById('todo-search');

  if (!form || !input || !list) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    socket.emit('todo:add', { text });
    form.reset();
  });

  list.addEventListener('change', (event) => {
    const toggle = event.target.closest('[data-toggle-todo]');
    if (!toggle) return;
    socket.emit('todo:toggle', Number(toggle.dataset.toggleTodo));
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-todo]');
    if (!button) return;
    socket.emit('todo:remove', Number(button.dataset.removeTodo));
  });

  if (search) {
    search.addEventListener('input', renderTodos);
  }
}

function getCardLabel(card) {
  return `${card.value} ${card.color}`;
}

function shuffle(array) {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function initUnoGame() {
  const topCard = document.getElementById('uno-top-card');
  const hand = document.getElementById('uno-hand');
  const drawBtn = document.getElementById('uno-draw');
  const resetBtn = document.getElementById('uno-reset');
  const status = document.getElementById('uno-status');

  if (!topCard || !hand || !drawBtn || !resetBtn || !status) return;

  const colors = ['rot', 'blau', 'grün', 'gelb'];
  let deck = [];
  let discard = [];
  let playerHand = [];

  function createDeck() {
    const cards = [];
    colors.forEach((color) => {
      for (let value = 0; value <= 9; value += 1) {
        cards.push({ color, value });
      }
    });
    return shuffle(cards);
  }

  function canPlay(card) {
    const top = discard[discard.length - 1];
    return !top || card.color === top.color || card.value === top.value;
  }

  function replenishDeck() {
    if (discard.length <= 1) return;
    const top = discard.pop();
    deck = shuffle(discard);
    discard = [top];
  }

  function updateUnoUI() {
    topCard.textContent = discard.length ? `${discard[discard.length - 1].value} · ${discard[discard.length - 1].color}` : '—';
    topCard.className = 'uno-card';
    const top = discard[discard.length - 1];
    if (top) {
      topCard.classList.add(`uno-card-${top.color}`);
    } else {
      topCard.className = 'uno-card uno-card-empty';
    }

    hand.innerHTML = '';
    playerHand.forEach((card, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `uno-card uno-card-${card.color}`;
      button.dataset.index = index;
      button.textContent = `${card.value}`;
      button.disabled = !canPlay(card);
      hand.appendChild(button);
    });

    if (!playerHand.length) {
      status.textContent = 'Du hast gewonnen!';
    } else if (deck.length === 0) {
      status.textContent = 'Der Stapel ist leer, ziehe nicht mehr';
    } else {
      status.textContent = `Karten im Stapel: ${deck.length}`;
    }
  }

  function startRound() {
    deck = createDeck();
    discard = [];
    playerHand = [];

    for (let i = 0; i < 5; i += 1) {
      playerHand.push(deck.pop());
    }

    discard.push(deck.pop());

    while (!playerHand.some(canPlay) && deck.length > 0) {
      playerHand.push(deck.pop());
    }

    updateUnoUI();
  }

  function drawCard() {
    if (!deck.length) {
      replenishDeck();
    }
    if (!deck.length) return;
    playerHand.push(deck.pop());
    updateUnoUI();
  }

  resetBtn.addEventListener('click', startRound);
  drawBtn.addEventListener('click', drawCard);

  hand.addEventListener('click', (event) => {
    const cardButton = event.target.closest('[data-index]');
    if (!cardButton) return;
    const index = Number(cardButton.dataset.index);
    const card = playerHand[index];
    if (!card || !canPlay(card)) return;
    playerHand.splice(index, 1);
    discard.push(card);
    updateUnoUI();
  });

  startRound();
}

function initGames() {
  const board = document.getElementById('game-board');
  const status = document.getElementById('game-status');
  const reset = document.getElementById('game-reset');
  const players = document.getElementById('game-players');
  const roomCode = document.getElementById('room-code');
  const roomInput = document.getElementById('room-input');
  const createBtn = document.getElementById('create-room');
  const joinBtn = document.getElementById('join-room');
  const leaveBtn = document.getElementById('leave-room');
  const roomInfo = document.getElementById('room-info');
  const roomError = document.getElementById('room-error');

  if (!board || !status || !reset || !players || !roomCode || !roomInput || !createBtn || !joinBtn || !leaveBtn || !roomInfo || !roomError) return;

  const cells = board.querySelectorAll('[data-index]');
  let currentRoomId = '';

  function setRoomText() {
    roomInfo.textContent = currentRoomId ? `Raum: ${currentRoomId}` : 'Kein Raum verbunden';
  }

  function updateGameUI(payload) {
    currentRoomId = payload.roomId || currentRoomId;
    setRoomText();

    const symbol = payload.players[socket.id] || '';
    const xId = Object.keys(payload.players).find((id) => payload.players[id] === 'X');
    const oId = Object.keys(payload.players).find((id) => payload.players[id] === 'O');

    players.textContent = `X: ${xId ? 'verbunden' : 'wartet'} · O: ${oId ? 'verbunden' : 'wartet'}`;

    if (payload.winner) {
      status.textContent = `Gewinner: ${payload.winner}`;
    } else if (payload.draw) {
      status.textContent = 'Unentschieden';
    } else if (!symbol) {
      status.textContent = 'Du bist nur Zuschauer';
    } else if (symbol === payload.currentPlayer) {
      status.textContent = 'Dein Zug';
    } else {
      status.textContent = `Warte auf ${payload.currentPlayer}`;
    }

    cells.forEach((cell, index) => {
      const value = payload.board[index];
      cell.textContent = value;
      const canMove = !payload.winner && !payload.draw && symbol && symbol === payload.currentPlayer && !value;
      cell.disabled = !canMove;
      cell.classList.toggle('is-active', canMove);
    });
  }

  createBtn.addEventListener('click', () => {
    socket.emit('game:create-room');
    roomError.textContent = '';
  });

  joinBtn.addEventListener('click', () => {
    const value = roomInput.value.trim().toUpperCase();
    if (!value) return;
    socket.emit('game:join-room', { roomId: value });
    roomError.textContent = '';
  });

  leaveBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    socket.emit('game:leave-room', { roomId: currentRoomId });
    roomError.textContent = '';
  });

  board.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-index]');
    if (!cell) return;
    socket.emit('game:move', { roomId: currentRoomId, index: Number(cell.dataset.index) });
  });

  reset.addEventListener('click', () => {
    if (!currentRoomId) return;
    socket.emit('game:reset', { roomId: currentRoomId });
  });

  socket.on('game:room-created', ({ roomId }) => {
    currentRoomId = roomId;
    roomCode.textContent = roomId;
    roomInput.value = roomId;
    setRoomText();
  });

  socket.on('game:room-error', (message) => {
    roomError.textContent = message;
  });

  socket.on('game:state', updateGameUI);
}

socket.on('state', (payload) => {
  state = payload;
  updateDashboard();
  renderEvents();
  renderTodos();
});

window.addEventListener('DOMContentLoaded', () => {
  initCalendar();
  initTodo();
  initGames();
  initUnoGame();
  updateDashboard();
});
