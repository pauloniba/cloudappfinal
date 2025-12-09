// src/scenes/RoomListScene.js
const LOBBY_BASE_URL = "https://cloudappfinal-production.up.railway.app";


export default class RoomListScene extends Phaser.Scene {
  constructor() {
    super("RoomListScene");
  }

  create() {
    const { width, height } = this.scale;

    this.sessionId = this.registry.get("sessionId");
    this.username = this.registry.get("username");

    if (!this.sessionId || !this.username) {
      this.scene.start("LobbyLoginScene");
      return;
    }

    this.cameras.main.setBackgroundColor("#161616");

    this.add
      .text(width / 2, height * 0.1, "Lobby Rooms", {
        fontSize: "36px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(30, 20, `Logged in as: ${this.username}`, {
        fontSize: "18px",
        fontFamily: "system-ui, sans-serif",
        color: "#dddddd",
      });

    this.statusText = this.add
      .text(width / 2, height * 0.18, "", {
        fontSize: "16px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffaaaa",
      })
      .setOrigin(0.5);

    // room text entries
    this.roomTexts = [];
    this.roomsStartY = height * 0.25;

    // Buttons
    this.createButton(width * 0.25, height * 0.85, 180, 48, "Create Room", () =>
      this.createRoom()
    );
    this.createButton(width * 0.5, height * 0.85, 180, 48, "Refresh", () =>
      this.fetchRooms()
    );
    this.createButton(width * 0.75, height * 0.85, 180, 48, "Back", () =>
      this.scene.start("MainMenuScene")
    );

    // Heartbeat
    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => this.sendHeartbeat(),
    });

    // Auto room refresh
    this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => this.fetchRooms(),
    });

    this.fetchRooms();
  }

  createButton(x, y, w, h, label, onClick) {
    const btn = this.add
      .rectangle(x, y, w, h, 0x444444)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const txt = this.add
      .text(x, y, label, {
        fontSize: "20px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    btn.on("pointerover", () => btn.setFillStyle(0x666666));
    btn.on("pointerout", () => btn.setFillStyle(0x444444));
    btn.on("pointerdown", () => {
      btn.setFillStyle(0x888888);
      onClick();
    });
    btn.on("pointerup", () => btn.setFillStyle(0x666666));

    return { btn, txt };
  }

  clearRooms() {
    this.roomTexts.forEach((entry) => {
      entry.textObj.destroy();
      entry.joinHint.destroy();
    });
    this.roomTexts = [];
  }

  async fetchRooms() {
    try {
      const res = await fetch(`${LOBBY_BASE_URL}/rooms`);
      if (!res.ok) {
        this.statusText.setText("Failed to load rooms.");
        return;
      }

      const data = await res.json();
      const rooms = data.rooms || [];

      this.clearRooms();

      if (rooms.length === 0) {
        this.statusText.setText("No rooms yet. Create one!");
        return;
      } else {
        this.statusText.setText("");
      }

      const { width } = this.scale;
      let y = this.roomsStartY;

      rooms.forEach((room) => {
        const isRunning = room.state === "running";
        const stateLabel = isRunning ? "(in game)" : "Click to join";

        const label = `${room.room_name} | Players: ${room.player_count} | State: ${room.state}`;
        const textObj = this.add
          .text(width / 2, y, label, {
            fontSize: "20px",
            fontFamily: "system-ui, sans-serif",
            color: isRunning ? "#aaaaaa" : "#ffffff",
          })
          .setOrigin(0.5);

        const joinHint = this.add
          .text(width / 2, y + 22, stateLabel, {
            fontSize: "14px",
            fontFamily: "system-ui, sans-serif",
            color: isRunning ? "#666666" : "#bbbbbb",
          })
          .setOrigin(0.5);

        if (!isRunning) {
          textObj.setInteractive({ useHandCursor: true });
          textObj.on("pointerover", () => textObj.setColor("#ffffaa"));
          textObj.on("pointerout", () => textObj.setColor("#ffffff"));
          textObj.on("pointerdown", () => this.joinRoom(room.room_id));
        }

        this.roomTexts.push({ textObj, joinHint, roomId: room.room_id });
        y += 70;
      });
    } catch (err) {
      console.error(err);
      this.statusText.setText("Error contacting lobby.");
    }
  }

  async createRoom() {
    this.statusText.setText("Creating room...");
    try {
      const res = await fetch(`${LOBBY_BASE_URL}/create_room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: this.sessionId,
          room_name: null,
        }),
      });

      if (!res.ok) {
        this.statusText.setText("Failed to create room.");
        return;
      }

      const data = await res.json();

      this.registry.set("roomId", data.room_id);
      this.registry.set("roomName", data.room_name);
      // don't set wsUrl yet—the game isn't created

      this.scene.start("RoomScene");
    } catch (err) {
      console.error(err);
      this.statusText.setText("Error creating room.");
    }
  }

  async joinRoom(roomId) {
    this.statusText.setText("Joining room...");
    try {
      const res = await fetch(`${LOBBY_BASE_URL}/join_room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: this.sessionId,
          room_id: roomId,
        }),
      });

      if (!res.ok) {
        this.statusText.setText("Failed to join room.");
        return;
      }

      const data = await res.json();

      this.registry.set("roomId", data.room_id);
      this.registry.set("roomName", data.room_name);

      this.scene.start("RoomScene");
    } catch (err) {
      console.error(err);
      this.statusText.setText("Error joining room.");
    }
  }

  async sendHeartbeat() {
    try {
      await fetch(`${LOBBY_BASE_URL}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: this.sessionId,
          room_id: null,
        }),
      });
    } catch (err) {
      console.warn("Heartbeat failed:", err);
    }
  }
}
