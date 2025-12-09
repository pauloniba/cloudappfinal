// src/scenes/GameScene.js
import MultiplayerClient from "../MultiplayerClient.js";

const FINISH_SCORE = 10000;
const CHECKPOINT_INTERVAL = 2000;
const MAX_LIVES = 3;
const GAME_SERVER_URL = "wss://switchyard.proxy.rlwy.net:19296";


export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    const { width, height } = this.scale;

    // =========================
    // CORE STATE
    // =========================
    this.gameWidth = width;
    this.gameHeight = height;
   
    

    this.gravity = 0.55;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem("highScore") || "0", 10);
    this.gameOver = false;
    this.raceFinished = false;
    this.frameCount = 0;
    this.milestoneFlash = 0;

    this.currentCheckpoint = 0; // 0, 2000, 4000, ...
    this.lives = MAX_LIVES;
    this.isDead = false;
    this.matchActive = false;  



    // Selected character from CharacterSelectScene
    this.selectedCharacter =
      this.registry.get("selectedCharacter") || "blacky";

    // Character colors
    this.characterConfig = {
      blacky: {
        label: "Blacky",
        color: 0x333333,
      },
      pinky: {
        label: "Pinky",
        color: 0xff8ec4,
      },
      alterEgo: {
        label: "Alter Ego",
        color: 0x000000, // handled specially (half black, half white)
      },
      greenThumb: {
        label: "Green Thumb",
        color: 0x0b6623, // forest green
      },
    };

    this.characterInfo =
      this.characterConfig[this.selectedCharacter] ||
      this.characterConfig["blacky"];

    // Canvas-style logic constants
    this.GROUND_Y = this.gameHeight - 10;

    // =========================
    // GRAPHICS LAYER
    // =========================
    this.g = this.add.graphics(); // we redraw everything here

    // =========================
    // PLAYER STATE (manual physics)
    // =========================
    this.player = {
      x: 50,
      y: 200,
      width: 44,
      height: 44,
      dy: 0,
      jumping: false,
      ducking: false,
      legFrame: 0,
    };

    // Obstacles
    this.obstacles = [];

    // Clouds
    this.clouds = [
      { x: 100, y: 40 },
      { x: 400, y: 60 },
      { x: 700, y: 30 },
    ];

    // Stars
    this.stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * this.gameWidth,
      y: Math.random() * (this.gameHeight - 60),
      tw: Math.random() * Math.PI * 2,
    }));

    // Day/Night cycle
    this.milestoneFlashAlpha = 0;

    // =========================
    // INPUT
    // =========================
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    // Restart on SPACE after gameOver or finish
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.gameOver || this.raceFinished) {
        this.resetGame();
      }
    });

    // =========================
    // HUD TEXT
    // =========================
    this.scoreText = this.add
      .text(10, 10, "Score: 0", {
        fontSize: "18px",
        fontFamily: "system-ui, sans-serif",
        color: "#000000",
        backgroundColor: "rgba(255,255,255,0.7)",
        padding: { x: 6, y: 3 },
      })
      .setDepth(10);

    this.highScoreText = this.add
      .text(10, 40, `High: ${this.highScore}`, {
        fontSize: "16px",
        fontFamily: "system-ui, sans-serif",
        color: "#000000",
        backgroundColor: "rgba(255,255,255,0.7)",
        padding: { x: 6, y: 3 },
      })
      .setDepth(10);

    this.livesText = this.add
      .text(this.gameWidth - 10, 10, `Lives: ${this.lives}`, {
        fontSize: "18px",
        fontFamily: "system-ui, sans-serif",
        color: "#000000",
        backgroundColor: "rgba(255,255,255,0.7)",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.checkpointText = this.add
      .text(
        this.gameWidth - 10,
        40,
        `Checkpoint: ${this.currentCheckpoint}`,
        {
          fontSize: "16px",
          fontFamily: "system-ui, sans-serif",
          color: "#000000",
          backgroundColor: "rgba(255,255,255,0.7)",
          padding: { x: 6, y: 3 },
        }
      )
      .setOrigin(1, 0)
      .setDepth(10);

    this.statusText = this.add
      .text(this.gameWidth / 2, this.gameHeight * 0.2, "", {
        fontSize: "24px",
        fontFamily: "system-ui, sans-serif",
        color: "#000000",
        backgroundColor: "rgba(255,255,255,0.8)",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0);

    // Player name tag (local player)
    this.nameTag = this.add
      .text(
        this.player.x + this.player.width / 2,
        this.player.y - 30,
        this.characterInfo.label,
        {
          fontSize: "14px",
          fontFamily: "system-ui, sans-serif",
          color: "#ffffff",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: { x: 6, y: 2 },
        }
      )
      .setOrigin(0.5)
      .setDepth(5);

      this.timerText = this.add.text(
        this.gameWidth / 2,
        10,
        "Time: 120",
        {
          fontSize: "18px",
          color: "#000",
          fontFamily: "system-ui"
        }
      ).setOrigin(0.5, 0);
      

    // Start with one obstacle
    this.createObstacle();

    // =========================
// MULTIPLAYER HOOKS
// =========================
this.wsUrl = this.registry.get("wsUrl");
console.log("Using game server:", this.wsUrl);

if (this.wsUrl) {
  this.mpClient = new MultiplayerClient(this, this.wsUrl);
  this.mpClient.connect(this.selectedCharacter, this.player);
} else {
  console.warn("No wsUrl provided — running solo mode.");
}
  }

  // =========================
  // UTILS
  // =========================
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Convert two hex colors to intermediate
  lerpColor(c1, c2, t) {
    const A = Phaser.Display.Color.HexStringToColor(c1);
    const B = Phaser.Display.Color.HexStringToColor(c2);
    const r = this.lerp(A.red, B.red, t);
    const g = this.lerp(A.green, B.green, t);
    const b = this.lerp(A.blue, B.blue, t);
    return Phaser.Display.Color.GetColor(r, g, b);
  }

  collideRect(ax, ay, aw, ah, bx, by, bw, bh, pad = 3) {
    return (
      ax + pad < bx + bw - pad &&
      ax + aw - pad > bx + pad &&
      ay + pad < by + bh - pad &&
      ay + ah - pad > by + pad
    );
  }

 

  getSkyState(scoreVal) {
    const cycleLen = 12000;
    const cycle = (scoreVal % cycleLen) / cycleLen;

    const blue = "#cbeef3";
    const orange = "#f3b49f";
    const purple = "#a36dc4";
    const indigo = "#2e2b75";

    let color;
    let cloudAlpha;
    let starAlpha;

    if (cycle < 0.25) {
      const t = cycle / 0.25;
      color = this.lerpColor(blue, orange, t);
      cloudAlpha = this.lerp(1.0, 0.7, t);
      starAlpha = 0;
    } else if (cycle < 0.5) {
      const t = (cycle - 0.25) / 0.25;
      color = this.lerpColor(orange, purple, t);
      cloudAlpha = this.lerp(0.7, 0.3, t);
      starAlpha = this.lerp(0, 0.3, t);
    } else if (cycle < 0.75) {
      const t = (cycle - 0.5) / 0.25;
      color = this.lerpColor(purple, indigo, t);
      cloudAlpha = this.lerp(0.3, 0, t);
      starAlpha = this.lerp(0.3, 1, t);
    } else {
      const t = (cycle - 0.75) / 0.25;
      color = this.lerpColor(indigo, blue, t);
      cloudAlpha = this.lerp(0, 1, t);
      starAlpha = this.lerp(1, 0, t);
    }

    const angle = (1 - cycle) * Math.PI * 1.333 - Math.PI * 0.166;
    const sunX = this.gameWidth / 2 + Math.cos(angle) * 350;
    const sunY = this.gameHeight + Math.sin(angle) * 300;
    const sunVisible = cycle < 0.6 || cycle > 0.85;

    return { color, cloudAlpha, starAlpha, sunX, sunY, sunVisible };
  }
  // =========================
// MATCH EVENTS FROM SERVER
// =========================
handleCountdown(value) {
  this.statusText.setText(`Starting soon: ${value}`);
  this.statusText.setAlpha(1);
  this.matchActive = false;   // BLOCK gameplay
}

handleMatchStart() {
  this.statusText.setText("GO!");
  this.statusText.setAlpha(1);

  this.time.delayedCall(1000, () => {
    this.statusText.setAlpha(0);
  });

  this.matchActive = true;   // ALLOW gameplay
}

handleMatchOver(data) {
  const name = data.winnerName || "Unknown";
  const char = data.winnerCharacter || "";
  const score = data.winnerScore ?? 0;

  this.add.text(
    this.scale.width / 2,
    this.scale.height * 0.35,
    `${name} Wins!\n(${char})\nScore: ${score}`,
    {
      fontSize: "32px",
      color: "#ffffff",
      fontFamily: "system-ui, sans-serif",
      align: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
      padding: { x: 12, y: 8 }
    }
  ).setOrigin(0.5).setDepth(999);
  
  // Stop gameplay
  this.isDead = true;
  this.physics.pause();
  this.gameOver = true;

  // After 5 sec → return to RoomScene
  this.time.delayedCall(5000, () => {
    this.scene.start("RoomScene");
  });
}


  // =========================
  // OBSTACLES
  // =========================
  createObstacle() {
    // 70% cactus, 30% pterodactyl
    const isCactus = Math.random() < 0.7;

    if (isCactus) {
      const size = 30 + Math.random() * 50;
      const spacing = 350 + Math.random() * 180;
      const yTop = this.GROUND_Y - size;
      this.obstacles.push({
        x: this.gameWidth + spacing,
        y: yTop,
        width: size,
        height: size,
        type: "cactus",
      });
    } else {
      const PTERO_MIN_TOP = Math.max(20, this.GROUND_Y - 85);
      const PTERO_MAX_TOP = 170;
      const baseHeight =
        PTERO_MIN_TOP + Math.random() * (PTERO_MAX_TOP - PTERO_MIN_TOP);
      const spacing = 300 + Math.random() * 400;
      this.obstacles.push({
        x: this.gameWidth + spacing,
        y: baseHeight,
        width: 46,
        height: 40,
        type: "ptero",
        wingUp: true,
      });
    }
  }

  // =========================
  // DRAW HELPERS
  // =========================
  drawBackground(freeze = false) {
    const { color, cloudAlpha, starAlpha, sunX, sunY, sunVisible } =
      this.getSkyState(this.score);

    const g = this.g;

    // Sky
    g.fillStyle(color, 1);
    g.fillRect(0, 0, this.gameWidth, this.gameHeight);

    // Sun (simple circle)
    if (sunVisible) {
      g.fillStyle(0xfff2a0, 0.9);
      g.fillCircle(sunX, sunY, 50);
    }

    // Stars
    if (starAlpha > 0) {
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        const twinkle =
          0.5 + 0.5 * Math.sin(this.frameCount * 0.05 + s.tw + i * 0.13);
        const alpha = starAlpha * (0.6 + 0.4 * twinkle);

        g.fillStyle(0xffffff, alpha);
        g.fillRect(s.x, s.y, 2, 2);
      }
    }

    // Clouds
    if (cloudAlpha > 0.01) {
      g.fillStyle(0xffffff, cloudAlpha);
      this.clouds.forEach((c) => {
        g.fillCircle(c.x, c.y, 15);
        g.fillCircle(c.x + 20, c.y + 5, 15);
        g.fillCircle(c.x + 40, c.y, 15);
      });

      if (!freeze) {
        this.clouds.forEach((c) => {
          c.x -= 0.5;
          if (c.x < -50) {
            c.x = this.gameWidth + 50;
            c.y = 20 + Math.random() * 80;
          }
        });
      }
    }

    // Ground
    g.fillStyle(0xe8c39e, 1);
    g.fillRect(0, this.GROUND_Y, this.gameWidth, 10);
  }

  drawPlayer() {
    const g = this.g;
    const p = this.player;

    const bob = !p.jumping ? Math.sin(this.frameCount * 0.2) * 1.5 : 0;
    const bodyY = p.y + bob;

    // Body
    if (this.selectedCharacter === "alterEgo") {
      // Left half black, right half white
      const halfW = p.width / 2;
      g.fillStyle(0x000000, 1);
      g.fillRect(p.x, bodyY, halfW, p.height);
      g.fillStyle(0xffffff, 1);
      g.fillRect(p.x + halfW, bodyY, halfW, p.height);
    } else {
      g.fillStyle(this.characterInfo.color, 1);
      g.fillRect(p.x, bodyY, p.width, p.height);
    }

    // Head
    g.fillStyle(0xfdebd0, 1);
    g.fillCircle(p.x + p.width / 2, bodyY - 16, 12);

    // Legs
    if (!p.jumping) {
      const legW = 8;
      const legH = 12;
      g.fillStyle(0x222222, 1);

      if (p.legFrame === 0) {
        // Left forward, right back
        g.fillRect(p.x + 6, bodyY + p.height, legW, legH);
        g.fillRect(
          p.x + p.width - legW - 6,
          bodyY + p.height - 4,
          legW,
          legH + 4
        );
      } else {
        // Right forward, left back
        g.fillRect(
          p.x + p.width - legW - 6,
          bodyY + p.height,
          legW,
          legH
        );
        g.fillRect(
          p.x + 6,
          bodyY + p.height - 4,
          legW,
          legH + 4
        );
      }
    }

    // Update local name tag position
    this.nameTag.setPosition(p.x + p.width / 2, p.y - 30);
  }

  // Draw a remote player (full character rendering, but no local nameTag object)
  drawRemotePlayer(remote) {
    const g = this.g;
    const p = remote;

    const bob = !p.jumping ? Math.sin(this.frameCount * 0.2) * 1.5 : 0;
    const bodyY = p.y + bob;

    const cfg =
      this.characterConfig[p.character] || this.characterConfig["blacky"];

    // Body
    if (p.character === "alterEgo") {
      const halfW = p.width / 2;
      g.fillStyle(0x000000, 1);
      g.fillRect(p.x, bodyY, halfW, p.height);
      g.fillStyle(0xffffff, 1);
      g.fillRect(p.x + halfW, bodyY, halfW, p.height);
    } else {
      g.fillStyle(cfg.color, 1);
      g.fillRect(p.x, bodyY, p.width, p.height);
    }

    // Head
    g.fillStyle(0xfdebd0, 1);
    g.fillCircle(p.x + p.width / 2, bodyY - 16, 12);
  }

  drawObstacles(speed, freeze = false) {
    const g = this.g;

    this.obstacles.forEach((o) => {
      if (o.type === "cactus") {
        // Stylized cactus as stacked rectangles
        g.fillStyle(0x1e7d32, 1);
        g.fillRect(o.x, o.y, o.width, o.height);

        const armWidth = o.width * 0.4;
        const armHeight = o.height * 0.6;
        const armX = o.x - armWidth * 0.5 + o.width * 0.5;
        const armY = o.y - armHeight * 0.6;
        g.fillRect(armX, armY, armWidth, armHeight);

        const topWidth = o.width * 0.35;
        const topHeight = o.height * 0.4;
        const topX = o.x - topWidth * 0.5 + o.width * 0.5;
        const topY = armY - topHeight * 0.8;
        g.fillRect(topX, topY, topWidth, topHeight);
      } else if (o.type === "ptero") {
        const amp = 5 + speed * 0.6;
        const bob = freeze
          ? 0
          : Math.sin((this.frameCount + o.x) * 0.05) * amp;
        const bodyY = o.y + bob;

        g.fillStyle(0x8b3a3a, 1);
        g.fillRect(o.x, bodyY, o.width, o.height);

        const wingUp = freeze ? o.wingUp : this.frameCount % 30 < 15;
        o.wingUp = wingUp;

        g.fillStyle(0x6b2626, 1);
        g.beginPath();
        if (wingUp) {
          g.fillTriangle(
            o.x,
            bodyY,
            o.x - 10,
            bodyY - 15,
            o.x + o.width + 10,
            bodyY - 15
          );
        } else {
          g.fillTriangle(
            o.x,
            bodyY + o.height,
            o.x - 10,
            bodyY + o.height + 15,
            o.x + o.width + 10,
            bodyY + o.height + 15
          );
        }
      }
    });
  }

  drawMilestoneFlash() {
    if (this.milestoneFlash > 0) {
      this.g.fillStyle(0xffffff, this.milestoneFlash);
      this.g.fillRect(0, 0, this.gameWidth, this.gameHeight);
      this.milestoneFlash = Math.max(0, this.milestoneFlash - 0.05);
    }
  }

  drawFinishBanner() {
    if (!this.raceFinished) return;
    // Banner text handled by statusText
  }

  // =========================
  // GAME FLOW
  // =========================
  handleHit() {
    this.lives -= 1;
    this.livesText.setText(`Lives: ${this.lives}`);
  
    // Player DEAD but match is NOT over (server decides winner)
    if (this.lives <= 0) {
      this.isDead = true;
      this.statusText.setText("You Died");
      this.statusText.setAlpha(1);
      this.mpClient?.socket.emit("player_game_over"); 
  
      // You can freeze your movement
      this.player.dy = 0;
  
      // Save high score locally
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem("highScore", String(this.highScore));
        this.highScoreText.setText(`High: ${this.highScore}`);
      }
  
      // DO NOT set gameOver = true
      // DO NOT return to lobby
      // DO NOT stop update loop
      // Wait for server match_over
      return;
    }
  
    // Respawn player
    this.statusText.setText("Respawning at checkpoint...");
    this.statusText.setAlpha(1);
  
    this.player.y = 200;
    this.player.dy = 0;
    this.player.jumping = false;
    this.player.ducking = false;
    this.player.legFrame = 0;
  
    this.score = this.currentCheckpoint;
    this.scoreText.setText(`Score: ${this.score}`);
  
    this.obstacles = [];
    this.createObstacle();
  }
  

  resetGame() {
    this.score = 0;
    this.gameOver = false;
    this.raceFinished = false;
    this.frameCount = 0;
    this.milestoneFlash = 0;
    this.currentCheckpoint = 0;
    this.lives = MAX_LIVES;

    this.player.y = 200;
    this.player.dy = 0;
    this.player.jumping = false;
    this.player.ducking = false;
    this.player.legFrame = 0;

    this.obstacles = [];
    this.createObstacle();

    this.statusText.setAlpha(0);
    this.livesText.setText(`Lives: ${this.lives}`);
    this.checkpointText.setText(`Checkpoint: ${this.currentCheckpoint}`);
    this.scoreText.setText("Score: 0");
  }

  // =========================
  // MAIN UPDATE
  // =========================
  update() {
    this.frameCount++;
// SPEED SYSTEM
const effectiveScore = this.matchActive ? this.score : this.currentCheckpoint;
const baseSpeed = 8;
const increment = Math.floor(effectiveScore / 1000) * 2;  
const speed = Math.min(20, baseSpeed + increment);

    if (this.timeLeft !== undefined) {
      if (!this.timerText) {
        this.timerText = this.add.text(
          this.scale.width / 2,
          10,
          "",
          {
            fontSize: "20px",
            fontFamily: "system-ui, sans-serif",
            color: "#000000",
            backgroundColor: "rgba(255,255,255,0.7)",
            padding: { x: 6, y: 3 }
          }
        ).setOrigin(0.5).setDepth(10);
      }
    
      this.timerText.setText(`Time: ${this.timeLeft}`);
    }
    

    // INPUT
    if (!this.isDead && !this.raceFinished && this.matchActive) {

      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        if (!this.player.jumping) {
          this.player.dy = -14.5;
          this.player.jumping = true;
        }
      }

      if (this.cursors.down.isDown) {
        this.player.ducking = true;
      } else {
        this.player.ducking = false;
      }
    }

    // PHYSICS
    if (!this.isDead && !this.raceFinished && this.matchActive) {

      this.player.y += this.player.dy;

      if (this.player.y + this.player.height < this.GROUND_Y) {
        this.player.dy += this.gravity;
        this.player.jumping = true;
      } else {
        this.player.dy = 0;
        this.player.jumping = false;
        this.player.y = this.GROUND_Y - this.player.height;
        if (this.frameCount % 8 === 0) {
          this.player.legFrame = 1 - this.player.legFrame;
        }
      }

      // Move obstacles
      this.obstacles.forEach((o) => {
        o.x -= speed;
      });

      // Spawn new obstacles if needed
      if (
        this.obstacles.length === 0 ||
        this.obstacles[this.obstacles.length - 1].x <
          this.gameWidth - (350 + Math.random() * 180)
      ) {
        this.createObstacle();
      }

      // Remove off-screen
      this.obstacles = this.obstacles.filter((o) => o.x + o.width > -60);

      // Collision
      for (const o of this.obstacles) {
        if (
          this.collideRect(
            this.player.x,
            this.player.y,
            this.player.width,
            this.player.height,
            o.x,
            o.y,
            o.width,
            o.height,
            4
          )
        ) {
          this.handleHit();
          break;
        }
      }

      // Score
      this.score++;
      this.scoreText.setText(`Score: ${this.score}`);

      // Update checkpoint
      const newCheckpoint =
        Math.floor(this.score / CHECKPOINT_INTERVAL) * CHECKPOINT_INTERVAL;
      if (
        newCheckpoint > this.currentCheckpoint &&
        newCheckpoint < FINISH_SCORE
      ) {
        this.currentCheckpoint = newCheckpoint;
        this.checkpointText.setText(`Checkpoint: ${this.currentCheckpoint}`);
      }

      // Milestone flash
      if (this.score > 0 && this.score % 1000 === 0) {
        this.milestoneFlash = 0.6;
      }

      // Finish condition
      if (this.score >= FINISH_SCORE && !this.raceFinished) {
        this.raceFinished = true;
        this.statusText.setText("YOU FINISHED FIRST!");
        this.statusText.setAlpha(1);
      }
    }

    // MULTIPLAYER — send our state to the game server
    if (this.mpClient) {
      this.mpClient.sendPlayerUpdate(this.player, this.time.now, this.score);
    }

    // DRAW EVERYTHING
    this.g.clear();

    const frozen = this.gameOver || this.raceFinished;

    // Background
    this.drawBackground(frozen);

    // Obstacles
    this.drawObstacles(speed, frozen);

    // Remote players (full character rendering)
    if (this.mpClient) {
      for (const [, data] of this.mpClient.remotePlayers.entries()) {
        // Normalize into a "player-like" object
        const remotePlayer = {
          x: data.x,
          y: data.y,
          width: this.player.width,
          height: this.player.height,
          jumping: false,
          ducking: false,
          legFrame: 0,
          character: data.character || "blacky",
        };
        this.drawRemotePlayer(remotePlayer);
      }
    }

    // Local player
    this.drawPlayer();

    // Flash overlay
    this.drawMilestoneFlash();

    // Finish banner
    this.drawFinishBanner();
  }
}
