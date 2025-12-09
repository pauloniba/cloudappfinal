// src/scenes/ResultsScene.js
export default class ResultsScene extends Phaser.Scene {
    constructor() {
      super('ResultsScene');
    }
  
    create() {
      const { width, height } = this.scale;
  
      const score = Math.floor(this.registry.get('lastScore') || 0);
      const finished = this.registry.get('finished') || false;
  
      this.add
        .text(width / 2, height * 0.25, 'Results', {
          fontSize: '36px',
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
        })
        .setOrigin(0.5);
  
      this.add
        .text(width / 2, height * 0.4, `Score: ${score}`, {
          fontSize: '28px',
          fontFamily: 'system-ui, sans-serif',
          color: '#cccccc',
        })
        .setOrigin(0.5);
  
      this.add
        .text(width / 2, height * 0.5, finished ? 'You finished!' : 'Game over', {
          fontSize: '22px',
          fontFamily: 'system-ui, sans-serif',
          color: '#aaaaaa',
        })
        .setOrigin(0.5);
  
      this.add
        .text(width / 2, height * 0.7, 'Press SPACE for Main Menu', {
          fontSize: '18px',
          fontFamily: 'system-ui, sans-serif',
          color: '#888888',
        })
        .setOrigin(0.5);
  
      this.input.keyboard.once('keydown-SPACE', () => {
        this.scene.start('MainMenuScene');
      });
    }
  }
  