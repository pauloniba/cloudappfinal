// src/scenes/MainMenuScene.js
export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#000000");

    this.add
      .text(width / 2, height * 0.3, "Professor Race", {
        fontSize: "48px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.5, "Press SPACE to Start", {
        fontSize: "24px",
        fontFamily: "system-ui, sans-serif",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.7, "v1.0 • Phaser Build", {
        fontSize: "16px",
        fontFamily: "system-ui, sans-serif",
        color: "#888888",
      })
      .setOrigin(0.5);

    // ⭐ New flow — go to LobbyLoginScene
    this.input.keyboard.once("keydown-SPACE", () => {
      this.scene.start("LobbyLoginScene");
    });
  }
}
