// src/scenes/LobbyLoginScene.js
const LOBBY_BASE_URL = "http://localhost:5000"; // FastAPI lobby

export default class LobbyLoginScene extends Phaser.Scene {
  constructor() {
    super("LobbyLoginScene");
  }

  create() {
    const { width, height } = this.scale;
    this.username = "";

    // Background
    this.cameras.main.setBackgroundColor("#1a1a1a");

    this.add
      .text(width / 2, height * 0.2, "Professor Race Lobby", {
        fontSize: "40px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.35, "Enter a username:", {
        fontSize: "22px",
        fontFamily: "system-ui, sans-serif",
        color: "#dddddd",
      })
      .setOrigin(0.5);

    // Simple "input box" visual
    this.inputBox = this.add
      .rectangle(width / 2, height * 0.45, 360, 48, 0x222222)
      .setStrokeStyle(2, 0xffffff);

    this.usernameText = this.add
      .text(width / 2, height * 0.45, "", {
        fontSize: "22px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(width / 2, height * 0.6, "", {
        fontSize: "18px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffaaaa",
      })
      .setOrigin(0.5);

    // Login button
    this.loginButton = this.createButton(
      width / 2,
      height * 0.7,
      180,
      48,
      "Login",
      () => {
        this.login();
      }
    );

    this.add
      .text(width / 2, height * 0.82, "Press ENTER to login", {
        fontSize: "16px",
        fontFamily: "system-ui, sans-serif",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    // Keyboard typing
    this.input.keyboard.on("keydown", (event) => {
      if (event.key === "Backspace") {
        this.username = this.username.slice(0, -1);
      } else if (event.key === "Enter") {
        this.login();
      } else if (event.key.length === 1) {
        if (this.username.length < 16) {
          this.username += event.key;
        }
      }
      this.usernameText.setText(this.username);
    });
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

  async login() {
    const name = this.username.trim();
    if (!name) {
      this.statusText.setText("Username cannot be empty.");
      return;
    }

    this.statusText.setText("Logging in...");
    try {
      const res = await fetch(`${LOBBY_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });

      if (!res.ok) {
        this.statusText.setText("Login failed.");
        return;
      }

      const data = await res.json();
      // Save to registry for other scenes
      this.registry.set("sessionId", data.session_id);
      this.registry.set("username", data.username);

      this.scene.start("RoomListScene");
    } catch (err) {
      console.error(err);
      this.statusText.setText("Unable to reach lobby (5000).");
    }
  }
}
