import type { InputState, SnapshotState } from "@shared/index";
import { DRIFT_LERP_THRESHOLD, DRIFT_SNAP_THRESHOLD, type EnemyKind, GAME_HEIGHT, GAME_WIDTH, LERP_FACTOR_MAX, LERP_FACTOR_MIN, LERP_SPEED_FACTOR, PLAYER_CLAMP_X_MAX_OFFSET, PLAYER_CLAMP_X_MIN, PLAYER_CLAMP_Y_MAX_OFFSET, PLAYER_CLAMP_Y_MIN, PLAYER_SPEED, SHIP_OPTIONS, type ShipId } from "@shared/index";
import Phaser from "phaser";

interface GameController {
  setSnapshot: (snapshot: SnapshotState | null, selfPlayerId: string | null) => void;
  clear: () => void;
  destroy: () => void;
  playMusic: (track: "lobby" | "battle") => void;
  setMusicVolume: (volume: number, muted: boolean) => void;
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

  preload() {
    this.load.audio("lobby", "audio/lobby.mp3");
    this.load.audio("battle", "audio/battle.mp3");
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
  private lastSnapshotMs = 0;
  private static readonly STALE_WARN_MS = 5000;
  private static readonly STALE_LOST_MS = 10000;
  private background?: Phaser.GameObjects.TileSprite;
  private bulletLayer?: Phaser.GameObjects.Graphics;
  private hud?: Phaser.GameObjects.Text;
  private effectHud?: Phaser.GameObjects.Text;
  private inputState: InputState = { up: false, down: false, left: false, right: false, shoot: false };
  private predictedShotCooldownMs = 0;
  private inputRepeatMs = 0;
  private currentTrack: "lobby" | "battle" | null = null;
  private pendingTrack: "lobby" | "battle" | null = null;
  private sceneReady = false;
  private lobbyMusic?: Phaser.Sound.BaseSound;
  private battleMusic?: Phaser.Sound.BaseSound;
  private musicVolume = 0.5;
  private musicMuted = false;
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
    this.effectHud = this.add.text(20, 48, "", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#ffffff"
    });
    this.effectHud.setDepth(100);
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

    this.sceneReady = true;
    if (this.pendingTrack) {
      this.startMusic(this.pendingTrack);
      this.pendingTrack = null;
    }
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

    if (this.snapshot && this.selfPlayerId && this.lastSnapshotMs > 0) {
      const staleDuration = performance.now() - this.lastSnapshotMs;
      if (staleDuration > GameScene.STALE_LOST_MS) {
        this.hud?.setText(`${this.snapshot.stageLabel}   Score ${this.snapshot.score}   ⚠ CONNECTION LOST`);
      } else if (staleDuration > GameScene.STALE_WARN_MS) {
        this.hud?.setText(`${this.snapshot.stageLabel}   Score ${this.snapshot.score}   Reconnecting...`);
      }
    }
  }

  applySnapshot(snapshot: SnapshotState | null, selfPlayerId: string | null) {
    this.snapshot = snapshot;
    this.selfPlayerId = selfPlayerId;
    if (!snapshot) {
      this.clearObjects();
      this.hud?.setText("Waiting for room to start");
      return;
    }

    this.lastSnapshotMs = performance.now();
    this.syncPlayers();
    this.syncEnemies();
    this.syncBullets();
    this.syncPickups();
    this.hud?.setText(`${snapshot.stageLabel}   Score ${snapshot.score}   Team Lives ${snapshot.teamLives}`);
    this.syncEffectHud(snapshot);
  }

  reset() {
    this.snapshot = null;
    this.selfPlayerId = null;
    this.lastSnapshotMs = 0;
    this.clearObjects();
    this.hud?.setText("Waiting for room to start");
    this.effectHud?.setText("");
  }

  startMusic(track: "lobby" | "battle") {
    if (!this.sceneReady) {
      this.pendingTrack = track;
      return;
    }
    if (this.currentTrack === track) {
      return;
    }

    const fadeDuration = 500;
    const targetVolume = this.musicMuted ? 0 : this.musicVolume;

    // Fade out the current track
    const outgoing = this.currentTrack === "lobby" ? this.lobbyMusic : this.currentTrack === "battle" ? this.battleMusic : null;
    if (outgoing && (outgoing as Phaser.Sound.WebAudioSound).isPlaying) {
      this.tweens.add({
        targets: outgoing,
        volume: 0,
        duration: fadeDuration,
        onComplete: () => { outgoing.stop(); }
      });
    }

    // Create or resume the incoming track
    if (track === "lobby" && !this.lobbyMusic) {
      this.lobbyMusic = this.sound.add("lobby", { loop: true, volume: 0 });
    }
    if (track === "battle" && !this.battleMusic) {
      this.battleMusic = this.sound.add("battle", { loop: true, volume: 0 });
    }

    const incoming = track === "lobby" ? this.lobbyMusic : this.battleMusic;
    if (incoming) {
      incoming.play({ volume: 0 });
      this.tweens.add({
        targets: incoming,
        volume: targetVolume,
        duration: fadeDuration
      });
    }

    this.currentTrack = track;
  }

  applyMusicVolume(volume: number, muted: boolean) {
    this.musicVolume = volume;
    this.musicMuted = muted;
    const effectiveVolume = muted ? 0 : volume;
    const active = this.currentTrack === "lobby" ? this.lobbyMusic : this.currentTrack === "battle" ? this.battleMusic : null;
    if (active && (active as Phaser.Sound.WebAudioSound).isPlaying) {
      (active as Phaser.Sound.WebAudioSound).setVolume(effectiveVolume);
    }
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
    const nextX = Phaser.Math.Clamp(sprite.x + ((dx / length) * PLAYER_SPEED * deltaMs) / 1000, PLAYER_CLAMP_X_MIN, GAME_WIDTH - PLAYER_CLAMP_X_MAX_OFFSET);
    const nextY = Phaser.Math.Clamp(sprite.y + ((dy / length) * PLAYER_SPEED * deltaMs) / 1000, PLAYER_CLAMP_Y_MIN, GAME_HEIGHT - PLAYER_CLAMP_Y_MAX_OFFSET);
    sprite.setPosition(nextX, nextY);
  }

  private interpolateSprites(deltaMs: number) {
    const factor = Phaser.Math.Clamp((deltaMs / 1000) * LERP_SPEED_FACTOR, LERP_FACTOR_MIN, LERP_FACTOR_MAX);

    for (const [playerId, sprite] of this.players) {
      const movingSelf = playerId === this.selfPlayerId && (this.inputState.left || this.inputState.right || this.inputState.up || this.inputState.down);
      const target = this.playerTargets.get(playerId);
      if (movingSelf) {
        if (target) {
          const drift = Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y);
          if (drift > DRIFT_SNAP_THRESHOLD) {
            sprite.setPosition(target.x, target.y);
          } else if (drift > DRIFT_LERP_THRESHOLD) {
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

  private static readonly PICKUP_LABEL: Record<string, string> = {
    weapon: "W",
    bomb: "B",
    shield: "S",
    rapid_fire: "R"
  };

  private static readonly PICKUP_COLOR: Record<string, string> = {
    weapon: "#ffe38f",
    bomb: "#8fffcb",
    shield: "#62b8ff",
    rapid_fire: "#ff88ff"
  };

  private syncPickups() {
    const liveIds = new Set(this.snapshot?.pickups.map((pickup) => pickup.id));
    for (const [id, sprite] of this.pickups) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.pickups.delete(id);
      }
    }

    for (const pickup of this.snapshot?.pickups ?? []) {
      const label = GameScene.PICKUP_LABEL[pickup.kind] ?? "?";
      const color = GameScene.PICKUP_COLOR[pickup.kind] ?? "#ffffff";
      let sprite = this.pickups.get(pickup.id);
      if (!sprite) {
        sprite = this.add.text(pickup.x, pickup.y, label, {
          fontFamily: "monospace",
          fontSize: "22px",
          color
        });
        sprite.setOrigin(0.5);
        this.pickups.set(pickup.id, sprite);
      }
      sprite.setPosition(pickup.x, pickup.y);
      sprite.setColor(color);
    }
  }

  private syncEffectHud(snapshot: SnapshotState) {
    if (!this.effectHud) {
      return;
    }
    const self = snapshot.players.find((player) => player.playerId === this.selfPlayerId);
    if (!self) {
      this.effectHud.setText("");
      return;
    }
    const badges: string[] = [];
    if (self.shieldActive) {
      badges.push("[SHIELD]");
    }
    if (self.rapidFireActive) {
      badges.push("[RAPID FIRE]");
    }
    this.effectHud.setText(badges.join("  "));
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
    },
    playMusic(track) {
      liveScene.startMusic(track);
    },
    setMusicVolume(volume, muted) {
      liveScene.applyMusicVolume(volume, muted);
    }
  };
};







