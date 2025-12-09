// src/main.js

import PreloadScene from "./scenes/PreloadScene.js";
import MainMenuScene from "./scenes/MainMenuScene.js";

// ⭐ NEW LOBBY SCENES ⭐
import LobbyLoginScene from "./scenes/LobbyLoginScene.js";
import RoomListScene from "./scenes/RoomListScene.js";
import RoomScene from "./scenes/RoomScene.js";

// Old scenes (still used)
import CharacterSelectScene from "./scenes/CharacterSelectScene.js";
import GameScene from "./scenes/GameScene.js";
import ResultsScene from "./scenes/ResultsScene.js";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: "#1a1a1a",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1200 },
      debug: false,
    },
  },

  // ⭐IMPORTANT — new order so lobby comes before game ⭐
  scene: [
    PreloadScene,
    MainMenuScene,

    // New scenes for lobby flow
    LobbyLoginScene,
    RoomListScene,
    RoomScene,

    // Still here for reuse or fallback
    CharacterSelectScene,
    GameScene,
    ResultsScene,
  ],
};

window.addEventListener("load", () => {
  new Phaser.Game(config);
});

export { GAME_WIDTH, GAME_HEIGHT };
