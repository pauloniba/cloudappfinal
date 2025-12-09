// src/MultiplayerClient.js

const PLAYER_WIDTH = 44;
const PLAYER_HEIGHT = 44;

function getCharacterLabel(key) {
  switch (key) {
    case "pinky":
      return "Pinky";
    case "alterEgo":
      return "Alter Ego";
    case "greenThumb":
      return "Green Thumb";
    case "blacky":
    default:
      return "Blacky";
  }
}

export default class MultiplayerClient {
  constructor(scene, wsUrl) {
    this.scene = scene;
    this.wsUrl = wsUrl; // dynamic URL coming from RoomScene / lobby
    this.socket = null;

    // id -> { x, y, character, characterLabel, label }
    this.remotePlayers = new Map();
    this.lastSent = 0;
  }

  connect(characterKey, playerBody) {
    if (!window.io) {
      console.error("Socket.IO client library missing!");
      return;
    }
  
    console.log("Connecting to game server:", this.wsUrl);
  
    this.socket = window.io(this.wsUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
    });
  
    // ===============================
    // MATCH EVENTS FROM SERVER
    // ===============================
    this.socket.on("match_over", (data) => {
      console.log("Match over:", data);
      this.scene.handleMatchOver(data);
    });
  
    this.socket.on("match_reset", () => {
      console.log("Match reset by server.");
      this.scene.scene.start("RoomScene");
    });
  
    this.socket.on("countdown", (value) => {
      if (this.scene.handleCountdown) {
        this.scene.handleCountdown(value);
      }
    });
  
    this.socket.on("match_start", () => {
      if (this.scene.handleMatchStart) {
        this.scene.handleMatchStart();
      }
    });
  
    this.socket.on("match_time", (value) => {
      if (this.scene.handleMatchTime) {
        this.scene.handleMatchTime(value);
      }
    });
  
    // ===============================
    // CONNECTION EVENT
    // ===============================
    this.socket.on("connect", () => {
      console.log("Connected to game server:", this.socket.id);
    
      const username = this.scene.registry.get("username") || "Player";
    
      this.socket.emit("player_join", {
        id: this.socket.id,
        username: username,
        character: characterKey,
        x: playerBody.x,
        y: playerBody.y,
      });
    });
    
  
    // ===============================
    // PLAYER STATE UPDATES
    // ===============================
    this.socket.on("players_state", (state) => {

      // Remove any players no longer in state
      for (const [id, entry] of this.remotePlayers.entries()) {
        if (!state[id]) {
          entry.label?.destroy();
          this.remotePlayers.delete(id);
        }
      }
    
      // Add/update players
      Object.entries(state).forEach(([id, data]) => {
        if (id === this.socket.id) return;
    
        const characterKey = data.character || "blacky";
        const labelText = getCharacterLabel(characterKey);
    
        let entry = this.remotePlayers.get(id);
    
        if (!entry) {
          // CREATE NEW REMOTE PLAYER ENTRY
          const label = this.scene.add.text(
            data.x + PLAYER_WIDTH / 2,
            data.y - 30,
            labelText,
            {
              fontSize: "14px",
              fontFamily: "system-ui, sans-serif",
              color: "#ffffff",
              backgroundColor: "rgba(0,0,0,0.5)",
              padding: { x: 6, y: 2 },
            }
          ).setOrigin(0.5).setDepth(5);
    
          entry = {
            x: data.x,
            y: data.y,
            character: characterKey,  
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            label,
          };
    
          this.remotePlayers.set(id, entry);
        }
    
        // UPDATE ENTRY
        entry.x = data.x;
        entry.y = data.y;
        entry.character = characterKey;
    
        if (entry.label) {
          entry.label.setPosition(
            data.x + PLAYER_WIDTH / 2,
            data.y - 30
          );
        }
      });
    });
    
    // ===============================
    // HANDLE DISCONNECT
    // ===============================
    this.socket.on("disconnect", () => {
      console.warn("Disconnected from server");
      this.remotePlayers.forEach((p) => p.label?.destroy());
      this.remotePlayers.clear();
    });
  }
  

  // Called every frame from GameScene.update()
  sendPlayerUpdate(playerBody, time, score) {
    if (!this.socket || this.socket.disconnected) return;

    // Throttle to ~20 updates/sec
    if (time - this.lastSent < 50) return;
    this.lastSent = time;

    this.socket.emit("player_move", {
      x: playerBody.x,
      y: playerBody.y,
      score: score,
    });
  }
}
