// src/scenes/RoomScene.js
const LOBBY_BASE_URL = "http://localhost:5000";
const FALLBACK_COUNTDOWN = 20;

const CHARACTER_OPTIONS = [
  { key: "blacky", label: "Blacky" },
  { key: "pinky", label: "Pinky" },
  { key: "alterEgo", label: "Alter Ego" },
  { key: "greenThumb", label: "Green Thumb" },
];

export default class RoomScene extends Phaser.Scene {
  constructor() {
    super("RoomScene");
  }

  create() {
    const { width, height } = this.scale;

    this.sessionId = this.registry.get("sessionId");
    this.username = this.registry.get("username");
    this.roomId = this.registry.get("roomId");
    this.roomName = this.registry.get("roomName");

    this.wsUrl = null;
    this.localCountdown = null;
    this.localCountdownStarted = false;

    if (!this.sessionId || !this.roomId) {
      this.scene.start("RoomListScene");
      return;
    }

    this.cameras.main.setBackgroundColor("#202020");

    // UI Headers
    this.add
      .text(width / 2, height * 0.12, `Room: ${this.roomName}`, {
        fontSize: "30px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.20, `User: ${this.username}`, {
        fontSize: "18px",
        fontFamily: "system-ui, sans-serif",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    this.infoText = this.add
      .text(width / 2, height * 0.28, "Waiting for players...", {
        fontSize: "18px",
        fontFamily: "system-ui, sans-serif",
        color: "#dddddd",
      })
      .setOrigin(0.5);

    this.countdownText = this.add
      .text(width / 2, height * 0.34, "", {
        fontSize: "20px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffffaa",
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(width / 2, height * 0.9, "", {
        fontSize: "16px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffaaaa",
      })
      .setOrigin(0.5);

    // Character Buttons
    this.buttonsByKey = {};
    const spacingX = 200;
    const startX = width / 2 - spacingX * 1.5;
    const y = height * 0.55;

    CHARACTER_OPTIONS.forEach((opt, idx) => {
      const x = startX + idx * spacingX;
      this.buttonsByKey[opt.key] = this.createButton(
        x,
        y,
        150,
        60,
        opt.label,
        () => this.chooseCharacter(opt.key)
      );
    });

    this.createButton(width * 0.15, height * 0.9, 140, 44, "Leave Room", () => {
      this.scene.start("RoomListScene");
    });

    // Poll room state from backend
    this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => this.refreshRoomInfo(),
    });

    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => this.sendHeartbeat(),
    });

    this.refreshRoomInfo();
  }

  createButton(x, y, w, h, label, onClick) {
    const btn = this.add
      .rectangle(x, y, w, h, 0x444444)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const txt = this.add
      .text(x, y, label, {
        fontSize: "18px",
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

  setCharacterButtonState(key, taken, selected) {
    const { btn, txt } = this.buttonsByKey[key];

    if (selected) {
      btn.setFillStyle(0x00aa88);
      txt.setColor("#ffffff");
      btn.setInteractive({ useHandCursor: true });
    } else if (taken) {
      btn.setFillStyle(0x552222);
      txt.setColor("#ffaaaa");
      btn.disableInteractive();
    } else {
      btn.setFillStyle(0x444444);
      txt.setColor("#ffffff");
      btn.setInteractive({ useHandCursor: true });
    }
  }

  async chooseCharacter(characterKey) {
    this.statusText.setText("Selecting character...");

    try {
      const res = await fetch(`${LOBBY_BASE_URL}/choose_character`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: this.sessionId,
          room_id: this.roomId,
          character: characterKey,
        }),
      });

      if (!res.ok) {
        this.statusText.setText("Character already taken.");
        return;
      }

      this.registry.set("selectedCharacter", characterKey);
      this.statusText.setText(`Selected: ${characterKey}`);

    } catch (err) {
      console.error(err);
      this.statusText.setText("Error selecting character.");
    }
  }

  async refreshRoomInfo() {
    try {
      const res = await fetch(`${LOBBY_BASE_URL}/rooms`);
      const data = await res.json();

      const room = (data.rooms || []).find((r) => r.room_id === this.roomId);

      if (!room) {
        this.infoText.setText("Room closed.");
        return;
      }

      // Update UI
      this.infoText.setText(
        `Players: ${room.player_count} • State: ${room.state}`
      );

      // Update character lock states
      const takenList = room.characters_taken || [];
      const myChar = this.registry.get("selectedCharacter") || null;

      CHARACTER_OPTIONS.forEach((opt) => {
        this.setCharacterButtonState(
          opt.key,
          takenList.includes(opt.key),
          myChar === opt.key
        );
      });

      // Handle countdown
      if (room.state === "countdown") {
        const serverCount = room.countdown || FALLBACK_COUNTDOWN;

        if (!this.localCountdownStarted) {
          this.localCountdownStarted = true;
          this.localCountdown = serverCount;

          this.countdownText.setText(
            `Game starts in: ${this.localCountdown}`
          );

          this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
              if (this.localCountdown > 0) {
                this.localCountdown--;
                this.countdownText.setText(
                  `Game starts in: ${this.localCountdown}`
                );
              }
            },
          });
        }
      }

      // When room is running, we must have ws_url
      if (room.state === "running" && room.ws_url) {
        console.log("Room running, wsUrl =", room.ws_url);
        this.registry.set("wsUrl", room.ws_url);

        // Default character if none selected
        if (!this.registry.get("selectedCharacter")) {
          this.registry.set("selectedCharacter", "blacky");
        }

        this.scene.start("GameScene");
      }
    } catch (err) {
      console.error(err);
      this.statusText.setText("Error contacting lobby.");
    }
  }

  async sendHeartbeat() {
    try {
      await fetch(`${LOBBY_BASE_URL}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: this.sessionId,
          room_id: this.roomId,
        }),
      });
    } catch (err) {
      console.warn("Heartbeat failed:", err);
    }
  }
}
