export default class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super("CharacterSelectScene");
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.2, "Select Your Character", {
        fontSize: "32px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const options = [
      "1: Blacky",
      "2: Pinky",
      "3: Alter Ego",
      "4: Green Thumb",
    ];

    options.forEach((label, index) => {
      this.add
        .text(width / 2, height * (0.35 + index * 0.1), label, {
          fontSize: "24px",
          fontFamily: "system-ui, sans-serif",
          color: "#cccccc",
        })
        .setOrigin(0.5);
    });

    this.add
      .text(width / 2, height * 0.8, "Press 1–4 to choose", {
        fontSize: "18px",
        fontFamily: "system-ui, sans-serif",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    // 1–4 selects characters, then go to GameScene
    this.input.keyboard.on("keydown", (event) => {
      const selectedIndex = parseInt(event.key, 10);

      if (selectedIndex >= 1 && selectedIndex <= 4) {
        const characterKey = ["blacky", "pinky", "alterEgo", "greenThumb"][
          selectedIndex - 1
        ];

        this.registry.set("selectedCharacter", characterKey);
        this.scene.start("GameScene");
      }
    });
  }
}
