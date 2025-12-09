// src/scenes/PreloadScene.js
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
   
  }

  create() {
    this.scene.start("MainMenuScene");
  }
}
