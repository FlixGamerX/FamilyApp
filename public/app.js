const socket = io();

let state = { events: [], todos: [] };

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
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
    const upcoming = [...state.events].sort((a, b) => a.date.localeCompare(b.date))[0];
    nextEventEl.textContent = upcoming ? `${upcoming.text} · ${formatDate(upcoming.date)}` : 'Kein Termin';
  }
}

function renderEvents() {
  const list = document.getElementById('event-list');
  if (!list) return;

  const search = document.getElementById('event-search');
  const query = search ? search.value.trim().toLowerCase() : '';
  const filtered = state.events.filter((event) => {
    return !query || `${event.text} ${event.date}`.toLowerCase().includes(query);
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
          <small>${formatDate(event.date)}</small>
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
  const inputText = document.getElementById('event-text');
  const list = document.getElementById('event-list');
  const search = document.getElementById('event-search');

  if (!form || !inputDate || !inputText || !list) return;

  const today = new Date().toISOString().split('T')[0];
  inputDate.value = today;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const date = inputDate.value;
    const text = inputText.value.trim();

    if (!date || !text) return;

    socket.emit('event:add', { date, text });
    form.reset();
    inputDate.value = today;
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
  updateDashboard();
});
