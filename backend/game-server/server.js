import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingInterval: 25000,
  pingTimeout: 50000,
});

// Unique ID for logging
const serverID = Math.floor(Math.random() * 10000);
console.log(`Game server instance starting (ID: ${serverID})`);

// ================================
// GAME CONSTANTS
// ================================
const MATCH_TIME = 120;
const COUNTDOWN_TIME = 20;
const RESET_DELAY = 10;
const FINISH_SCORE = 10000;

// ================================
// MATCH STATE MACHINE
// ================================
let players = {};
let matchState = "waiting"; // waiting | countdown | playing | finished
let countdown = COUNTDOWN_TIME;
let timeLeft = MATCH_TIME;
let countdownInterval = null;
let matchInterval = null;

// ================================
// HELPERS
// ================================

function resetMatch() {
  console.log("RESETTING MATCH…");

  players = {};
  matchState = "waiting";
  countdown = COUNTDOWN_TIME;
  timeLeft = MATCH_TIME;

  clearInterval(countdownInterval);
  clearInterval(matchInterval);

  countdownInterval = null;
  matchInterval = null;

  io.emit("match_reset");
}

function startCountdown() {
  matchState = "countdown";
  console.log("COUNTDOWN STARTED");

  countdownInterval = setInterval(() => {
    io.emit("countdown", countdown);

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      startMatch();
    }

    countdown--;
  }, 1000);
}

function startMatch() {
  matchState = "playing";
  console.log("MATCH STARTED");

  io.emit("match_start");

  matchInterval = setInterval(() => {
    io.emit("match_time", timeLeft);

    if (timeLeft <= 0) {
      clearInterval(matchInterval);
      finishMatch();
    }

    timeLeft--;
  }, 1000);
}

function finishMatch(forceWinner = null) {
  console.log("MATCH FINISHED");
  matchState = "finished";

  clearInterval(matchInterval);

  let finalWinner = null;
  let finalScore = -1;

  // If a specific winner ID is provided (player finished first)
  if (forceWinner && players[forceWinner]) {
    finalWinner = players[forceWinner];
    finalScore = finalWinner.score;
  } else {
    // Normal scoring: highest score wins
    Object.values(players).forEach((p) => {
      if (p.score > finalScore) {
        finalScore = p.score;
        finalWinner = p;
      }
    });
  }

  const payload = {
    winnerName: finalWinner?.username || "Unknown",
    winnerCharacter: finalWinner?.character || "blacky",
    winnerScore: finalScore,
  };

  console.log("Match over payload:", payload);

  io.emit("match_over", payload);

  setTimeout(() => {
    resetMatch();
  }, RESET_DELAY * 1000);
}

// ================================
// SOCKET.IO HANDLERS
// ================================
io.on("connection", (socket) => {
  console.log(`Player ${socket.id} connected → server ${serverID}`);

  socket.emit("connected", { serverID });

  socket.on("player_join", (data) => {
    if (matchState === "finished") return;
  
    players[socket.id] = {
      id: socket.id,
      username: data.username || "Unknown",
      character: data.character || "blacky",
      x: data.x || 0,
      y: data.y || 0,
      score: 0,
      dead: false,
    };
  
    io.emit("players_state", players);
  
    if (matchState === "waiting" && Object.keys(players).length >= 1) {
      startCountdown();
    }
  });
  

  socket.on("player_move", (data) => {
    if (!players[socket.id]) return;

    players[socket.id].x = data.x;
    players[socket.id].y = data.y;
    players[socket.id].score = data.score;

    if (players[socket.id].score >= FINISH_SCORE) {
      finishMatch(players[socket.id].character);
    }
  });

  socket.on("player_game_over", () => {
    if (!players[socket.id]) return;

    players[socket.id].dead = true;
    console.log(`Player ${socket.id} reached GAME OVER`);

    const allDead = Object.values(players).every(p => p.dead);

    if (allDead) {
      finishMatch();
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player ${socket.id} disconnected`);

    delete players[socket.id];
    io.emit("players_state", players);

    if (Object.keys(players).length === 0) {
      resetMatch();
    }
  });
});

// Broadcast updated positions at ~20 FPS
setInterval(() => {
  if (matchState === "playing" || matchState === "countdown") {
    io.emit("players_state", players);
  }
}, 50);

// EXPRESS PORT
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Game server ID ${serverID} listening on port ${PORT}`);
});
