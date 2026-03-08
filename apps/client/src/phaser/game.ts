import type { SnapshotState } from "@shared/index";
import { type EnemyKind, GAME_HEIGHT, GAME_WIDTH, PLAYER_SPEED, SHIP_OPTIONS, type ShipId } from "@shared/index";
import Phaser from "phaser";

interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
}

interface GameController {
  setSnapshot: (snapshot: SnapshotState | null, selfPlayerId: string | null) => void;
  clear: () => void;
  destroy: () => void;
}

interface PositionTarget {
  x: number;
  y: number;
}

interface PredictedBullet {
  sprite: Phaser.GameObjects.Arc;
  remainingMs: number;
  vy: number;
}

const colorNumber = (value: string) => Number.parseInt(value.replace("#", ""), 16);
const shipTextureKey = (shipId: ShipId) => `player-ship-${shipId}`;
const enemyTextureKey = (kind: EnemyKind) => `enemy-${kind}`;

const inputChanged = (left: InputState, right: InputState) => left.up !== right.up || left.down !== right.down || left.left !== right.left || left.right !== right.right || left.shoot !== right.shoot;

const drawPixelTexture = (
  scene: Phaser.Scene,
  textureKey: string,
  pattern: string[],
  palette: Record<string, string>,
  pixelSize = 4
) => {
  if (scene.textures.exists(textureKey)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  pattern.forEach((row, rowIndex) => {
    [...row].forEach((token, columnIndex) => {
      const color = palette[token];
      if (!color) {
        return;
      }
      graphics.fillStyle(colorNumber(color), 1);
      graphics.fillRect(columnIndex * pixelSize, rowIndex * pixelSize, pixelSize, pixelSize);
    });
  });

  graphics.generateTexture(textureKey, pattern[0]!.length * pixelSize, pattern.length * pixelSize);
  graphics.destroy();
};

const drawShipTexture = (scene: Phaser.Scene, shipId: ShipId) => {
  const ship = SHIP_OPTIONS.find((candidate) => candidate.id === shipId);
  if (!ship || scene.textures.exists(shipTextureKey(shipId))) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  const dark = colorNumber(ship.dark);
  const primary = colorNumber(ship.primary);
  const trim = colorNumber(ship.trim);
  const glow = colorNumber(ship.glow);

  graphics.fillStyle(dark, 1);
  graphics.fillTriangle(48, 10, 18, 54, 35, 72);
  graphics.fillTriangle(48, 10, 78, 54, 61, 72);
  graphics.fillRoundedRect(37, 18, 22, 46, 8);
  graphics.fillRoundedRect(16, 46, 16, 24, 6);
  graphics.fillRoundedRect(64, 46, 16, 24, 6);

  graphics.fillStyle(primary, 1);
  graphics.fillTriangle(48, 14, 24, 54, 39, 67);
  graphics.fillTriangle(48, 14, 72, 54, 57, 67);
  graphics.fillRoundedRect(40, 18, 16, 42, 6);
  graphics.fillRoundedRect(21, 48, 10, 18, 4);
  graphics.fillRoundedRect(65, 48, 10, 18, 4);

  graphics.fillStyle(trim, 1);
  graphics.fillTriangle(48, 16, 42, 32, 54, 32);
  graphics.fillRoundedRect(44, 21, 8, 24, 4);
  graphics.fillRect(33, 39, 8, 18);
  graphics.fillRect(55, 39, 8, 18);
  graphics.fillRect(30, 61, 10, 5);
  graphics.fillRect(56, 61, 10, 5);

  graphics.fillStyle(glow, 0.95);
  graphics.fillCircle(26, 72, 5);
  graphics.fillCircle(70, 72, 5);
  graphics.fillCircle(48, 66, 3);
  graphics.fillStyle(0xffd9ae, 0.8);
  graphics.fillTriangle(26, 72, 21, 88, 31, 88);
  graphics.fillTriangle(70, 72, 65, 88, 75, 88);

  graphics.generateTexture(shipTextureKey(shipId), 96, 96);
  graphics.destroy();
};

const drawEnemyTextures = (scene: Phaser.Scene) => {
  drawPixelTexture(
    scene,
    enemyTextureKey("fighter"),
    [
      "....rr....",
      "...rwwr...",
      "..rrwwrr..",
      ".rrbwwbrr.",
      "rrbbwwbbrr",
      "..bbwwbb..",
      "..bbwwbb..",
      ".bbbyybbb.",
      ".bby..ybb.",
      "..y....y.."
    ],
    {
      r: "#ff4e63",
      b: "#3a89ff",
      w: "#f4f8ff",
      y: "#ffe05b"
    }
  );

  drawPixelTexture(
    scene,
    enemyTextureKey("heavy"),
    [
      "...yy....yy...",
      "..ybb....bby..",
      ".ybbbb..bbbby.",
      "bbbyyy..yyybbb",
      "bbbbyyyyyybbbb",
      ".bbbggggggbbb.",
      "..bbggggggbb..",
      "..bbggggggbb..",
      ".bbbggggggbbb.",
      ".bb..gggg..bb.",
      "..y..gggg..y..",
      "..y........y.."
    ],
    {
      y: "#ffd74f",
      b: "#2d7fff",
      g: "#1e3555"
    },
    3
  );

  drawPixelTexture(
    scene,
    enemyTextureKey("kamikaze"),
    [
      "....pp....",
      "...pttp...",
      "..ptyytp..",
      ".ptyyyytp.",
      "ttgtyytgtt",
      ".gggttggg.",
      "..ggttgg..",
      "..g....g..",
      ".t......t.",
      "t........t"
    ],
    {
      p: "#d79bff",
      t: "#4ef5f0",
      y: "#f8f96d",
      g: "#1a2a43"
    }
  );

  drawPixelTexture(
    scene,
    enemyTextureKey("boss"),
    [
      ".....pppppp.....",
      "...ppttttttpp...",
      "..pttyyyy yyttp..".replace(/ /g, ""),
      ".ptttyyyyyyyttp.",
      ".ttyyggggggyytt.",
      "ttyggggggggggytt",
      "ttyggwwggggwggtt",
      "ttyggggggggggytt",
      ".ttyggggggggytt.",
      "..ttgggttgggtt..",
      "..tggt....tggt..",
      ".ttt........ttt.",
      "tt............tt",
      "t..............t"
    ],
    {
      p: "#a07bff",
      t: "#52f1ec",
      y: "#f4ec69",
      g: "#1d304c",
      w: "#f5fbff"
    },
    4
  );
};

class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    const background = this.make.graphics({ x: 0, y: 0, add: false });
    background.fillStyle(0x07111f, 1);
    background.fillRect(0, 0, 64, 64);
    for (let index = 0; index < 28; index += 1) {
      background.fillStyle(index % 4 === 0 ? 0xa8d8ff : 0xffffff, 1);
      background.fillRect(Phaser.Math.Between(0, 63), Phaser.Math.Between(0, 63), index % 4 === 0 ? 2 : 1, index % 4 === 0 ? 2 : 1);
    }
    background.generateTexture("starfield", 64, 64);
    SHIP_OPTIONS.forEach((ship) => drawShipTexture(this, ship.id));
    drawEnemyTextures(this);
    this.scene.start("game");
  }
}

class GameScene extends Phaser.Scene {
  private readonly players = new Map<string, Phaser.GameObjects.Image>();
  private readonly enemies = new Map<string, Phaser.GameObjects.Image>();
  private readonly pickups = new Map<string, Phaser.GameObjects.Text>();
  private readonly playerTargets = new Map<string, PositionTarget>();
  private readonly enemyTargets = new Map<string, PositionTarget>();
  private readonly predictedBullets: PredictedBullet[] = [];
  private snapshot: SnapshotState | null = null;
  private selfPlayerId: string | null = null;
  private background?: Phaser.GameObjects.TileSprite;
  private bulletLayer?: Phaser.GameObjects.Graphics;
  private hud?: Phaser.GameObjects.Text;
  private inputState: InputState = { up: false, down: false, left: false, right: false, shoot: false };
  private predictedShotCooldownMs = 0;
  private inputRepeatMs = 0;
  private inputKeys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    shoot: Phaser.Input.Keyboard.Key;
    altShoot: Phaser.Input.Keyboard.Key;
    bomb: Phaser.Input.Keyboard.Key;
  };

  constructor(
    private readonly onInput: (input: InputState) => void,
    private readonly onBomb: () => void
  ) {
    super("game");
  }

  create() {
    this.background = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, "starfield");
    this.hud = this.add.text(20, 18, "Waiting for snapshot", {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#d8ecff"
    });
    this.hud.setDepth(100);
    this.bulletLayer = this.add.graphics();
    this.bulletLayer.setDepth(7);

    this.inputKeys = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      shoot: Phaser.Input.Keyboard.KeyCodes.SPACE,
      altShoot: Phaser.Input.Keyboard.KeyCodes.UP,
      bomb: Phaser.Input.Keyboard.KeyCodes.SHIFT
    }, false) as GameScene["inputKeys"];

    this.inputKeys?.bomb.on("down", () => this.onBomb());
  }

  update(_time: number, delta: number) {
    if (this.background) {
      this.background.tilePositionY -= 1.1;
    }
    if (!this.inputKeys || !this.scene.isActive()) {
      return;
    }

    const next: InputState = {
      up: this.inputKeys.up.isDown,
      down: this.inputKeys.down.isDown,
      left: this.inputKeys.left.isDown,
      right: this.inputKeys.right.isDown,
      shoot: this.inputKeys.shoot.isDown || this.inputKeys.altShoot.isDown
    };

    const changed = inputChanged(next, this.inputState);
    const activeInput = next.up || next.down || next.left || next.right || next.shoot;
    this.inputRepeatMs = Math.max(0, this.inputRepeatMs - delta);

    if (changed) {
      this.inputState = next;
      this.onInput(next);
      this.inputRepeatMs = activeInput ? 90 : 0;
    } else if (activeInput && this.inputRepeatMs === 0) {
      this.onInput(next);
      this.inputRepeatMs = 90;
    }

    this.predictedShotCooldownMs = Math.max(0, this.predictedShotCooldownMs - delta);
    this.predictSelfMovement(delta);
    this.spawnPredictedShots();
    this.updatePredictedBullets(delta);
    this.interpolateSprites(delta);
  }

  applySnapshot(snapshot: SnapshotState | null, selfPlayerId: string | null) {
    this.snapshot = snapshot;
    this.selfPlayerId = selfPlayerId;
    if (!snapshot) {
      this.clearObjects();
      this.hud?.setText("Waiting for room to start");
      return;
    }

    this.syncPlayers();
    this.syncEnemies();
    this.syncBullets();
    this.syncPickups();
    this.hud?.setText(`${snapshot.stageLabel}   Score ${snapshot.score}   Team Lives ${snapshot.teamLives}`);
  }

  reset() {
    this.snapshot = null;
    this.selfPlayerId = null;
    this.clearObjects();
    this.hud?.setText("Waiting for room to start");
  }

  private predictSelfMovement(deltaMs: number) {
    if (!this.selfPlayerId) {
      return;
    }
    const sprite = this.players.get(this.selfPlayerId);
    if (!sprite || sprite.alpha < 0.5) {
      return;
    }

    let dx = 0;
    let dy = 0;
    if (this.inputState.left) dx -= 1;
    if (this.inputState.right) dx += 1;
    if (this.inputState.up) dy -= 1;
    if (this.inputState.down) dy += 1;
    if (dx === 0 && dy === 0) {
      return;
    }

    const length = Math.hypot(dx, dy) || 1;
    const nextX = Phaser.Math.Clamp(sprite.x + ((dx / length) * PLAYER_SPEED * deltaMs) / 1000, 40, GAME_WIDTH - 40);
    const nextY = Phaser.Math.Clamp(sprite.y + ((dy / length) * PLAYER_SPEED * deltaMs) / 1000, 80, GAME_HEIGHT - 40);
    sprite.setPosition(nextX, nextY);
  }

  private interpolateSprites(deltaMs: number) {
    const factor = Phaser.Math.Clamp((deltaMs / 1000) * 18, 0.18, 0.42);

    for (const [playerId, sprite] of this.players) {
      const movingSelf = playerId === this.selfPlayerId && (this.inputState.left || this.inputState.right || this.inputState.up || this.inputState.down);
      const target = this.playerTargets.get(playerId);
      if (movingSelf) {
        if (target) {
          const drift = Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y);
          if (drift > 220) {
            sprite.setPosition(target.x, target.y);
          } else if (drift > 96) {
            sprite.x = Phaser.Math.Linear(sprite.x, target.x, 0.12);
            sprite.y = Phaser.Math.Linear(sprite.y, target.y, 0.12);
          }
        }
        continue;
      }
      if (!target) {
        continue;
      }
      sprite.x = Phaser.Math.Linear(sprite.x, target.x, factor);
      sprite.y = Phaser.Math.Linear(sprite.y, target.y, factor);
    }

    for (const [enemyId, sprite] of this.enemies) {
      const target = this.enemyTargets.get(enemyId);
      if (!target) {
        continue;
      }
      sprite.x = Phaser.Math.Linear(sprite.x, target.x, factor);
      sprite.y = Phaser.Math.Linear(sprite.y, target.y, factor);
    }
  }

  private spawnPredictedShots() {
    if (!this.selfPlayerId || !this.inputState.shoot || this.predictedShotCooldownMs > 0) {
      return;
    }

    const sprite = this.players.get(this.selfPlayerId);
    const selfPlayer = this.snapshot?.players.find((player) => player.playerId === this.selfPlayerId);
    if (!sprite || !selfPlayer || !selfPlayer.alive) {
      return;
    }

    const offsets = selfPlayer.weaponLevel >= 3 ? [-14, 0, 14] : selfPlayer.weaponLevel === 2 ? [-8, 8] : [0];
    for (const offset of offsets) {
      const bulletSprite = this.add.circle(sprite.x + offset, sprite.y - 18, 5, 0xbdfcc9, 0.92);
      bulletSprite.setDepth(9);
      this.predictedBullets.push({
        sprite: bulletSprite,
        remainingMs: 260,
        vy: -540
      });
    }

    this.predictedShotCooldownMs = 170;
  }

  private updatePredictedBullets(deltaMs: number) {
    const authoritativePlayerBullets = this.snapshot?.bullets.filter((bullet) => bullet.owner === "player") ?? [];
    for (let index = this.predictedBullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.predictedBullets[index]!;
      bullet.remainingMs -= deltaMs;
      bullet.sprite.y += (bullet.vy * deltaMs) / 1000;

      const matched = authoritativePlayerBullets.some((candidate) =>
        Phaser.Math.Distance.Between(candidate.x, candidate.y, bullet.sprite.x, bullet.sprite.y) <= 24
      );
      if (matched || bullet.remainingMs <= 0 || bullet.sprite.y < -20) {
        bullet.sprite.destroy();
        this.predictedBullets.splice(index, 1);
      }
    }
  }

  private syncTarget(targets: Map<string, PositionTarget>, id: string, x: number, y: number) {
    targets.set(id, { x, y });
  }

  private moveSprite(sprite: Phaser.GameObjects.Image, targets: Map<string, PositionTarget>, id: string, x: number, y: number) {
    const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, x, y);
    this.syncTarget(targets, id, x, y);
    if (distance > 180) {
      sprite.setPosition(x, y);
    }
  }

  private clearObjects() {
    for (const map of [this.players, this.enemies, this.pickups]) {
      for (const object of map.values()) {
        object.destroy();
      }
      map.clear();
    }
    this.playerTargets.clear();
    this.enemyTargets.clear();
    for (const bullet of this.predictedBullets) {
      bullet.sprite.destroy();
    }
    this.predictedBullets.length = 0;
  }

  private syncPlayers() {
    const liveIds = new Set(this.snapshot?.players.map((player) => player.playerId));
    for (const [id, sprite] of this.players) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.players.delete(id);
        this.playerTargets.delete(id);
      }
    }

    for (const player of this.snapshot?.players ?? []) {
      const textureKey = shipTextureKey(player.shipId);
      let sprite = this.players.get(player.playerId);
      if (!sprite) {
        sprite = this.add.image(player.x, player.y, textureKey);
        sprite.setDepth(12);
        this.players.set(player.playerId, sprite);
        this.syncTarget(this.playerTargets, player.playerId, player.x, player.y);
      }
      if (sprite.texture.key !== textureKey) {
        sprite.setTexture(textureKey);
      }
      const movingSelf = player.playerId === this.selfPlayerId && (this.inputState.left || this.inputState.right || this.inputState.up || this.inputState.down);
      if (movingSelf) {
        this.syncTarget(this.playerTargets, player.playerId, player.x, player.y);
      } else {
        this.moveSprite(sprite, this.playerTargets, player.playerId, player.x, player.y);
      }
      sprite.setScale(player.playerId === this.selfPlayerId ? 0.82 : 0.74);
      sprite.setAlpha(player.alive ? 1 : 0.25);
    }
  }

  private syncEnemies() {
    const liveIds = new Set(this.snapshot?.enemies.map((enemy) => enemy.id));
    for (const [id, sprite] of this.enemies) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.enemies.delete(id);
        this.enemyTargets.delete(id);
      }
    }

    for (const enemy of this.snapshot?.enemies ?? []) {
      const textureKey = enemyTextureKey(enemy.kind);
      let sprite = this.enemies.get(enemy.id);
      if (!sprite) {
        sprite = this.add.image(enemy.x, enemy.y, textureKey);
        sprite.setDepth(10);
        this.enemies.set(enemy.id, sprite);
        this.syncTarget(this.enemyTargets, enemy.id, enemy.x, enemy.y);
      }
      if (sprite.texture.key !== textureKey) {
        sprite.setTexture(textureKey);
      }
      const hpRatio = Phaser.Math.Clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1);
      const scale = enemy.kind === "boss" ? 1.08 + hpRatio * 0.2 : 0.72 + hpRatio * 0.28;
      this.moveSprite(sprite, this.enemyTargets, enemy.id, enemy.x, enemy.y);
      sprite.setScale(scale);
      sprite.setAlpha(enemy.kind === "boss" ? 0.78 + hpRatio * 0.22 : 0.55 + hpRatio * 0.45);
    }
  }

  private syncBullets() {
    if (!this.bulletLayer) {
      return;
    }

    this.bulletLayer.clear();
    for (const bullet of this.snapshot?.bullets ?? []) {
      this.bulletLayer.fillStyle(bullet.owner === "player" ? 0xbdfcc9 : 0xffd0d6, bullet.owner === "player" ? 0.88 : 0.82);
      this.bulletLayer.fillCircle(bullet.x, bullet.y, bullet.radius);
    }
  }

  private syncPickups() {
    const liveIds = new Set(this.snapshot?.pickups.map((pickup) => pickup.id));
    for (const [id, sprite] of this.pickups) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.pickups.delete(id);
      }
    }

    for (const pickup of this.snapshot?.pickups ?? []) {
      let sprite = this.pickups.get(pickup.id);
      if (!sprite) {
        sprite = this.add.text(pickup.x, pickup.y, pickup.kind === "weapon" ? "W" : "B", {
          fontFamily: "monospace",
          fontSize: "22px",
          color: pickup.kind === "weapon" ? "#ffe38f" : "#8fffcb"
        });
        sprite.setOrigin(0.5);
        this.pickups.set(pickup.id, sprite);
      }
      sprite.setPosition(pickup.x, pickup.y);
      sprite.setColor(pickup.kind === "weapon" ? "#ffe38f" : "#8fffcb");
    }
  }
}

export const createGame = (
  container: HTMLElement,
  onInput: (input: InputState) => void,
  onBomb: () => void
): GameController => {
  const liveScene = new GameScene(onInput, onBomb);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#040b16",
    scene: [BootScene, liveScene],
    fps: { target: 60 }
  });

  return {
    setSnapshot(snapshot, selfPlayerId) {
      liveScene.applySnapshot(snapshot, selfPlayerId);
    },
    clear() {
      liveScene.reset();
    },
    destroy() {
      game.destroy(true);
    }
  };
};







