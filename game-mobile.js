const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 600 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);

let bike, cursors, score = 0, coins = 0, scoreText, coinsText;
let platforms, coinGroup, obstacles;
let canJump = true, isFlipping = false, flipStartAngle = 0, flipDirection = 0;
let dustParticles, trickTrail, wasInAir = false;
let wheelieTime = 0, isWheelying = false, wheelieText = null;
let comboCount = 0, comboMultiplier = 1, tricksThisCombo = [];
let currentBike = 0, unlockedBikes = [true, false, false, false, false, false], currentLevel = 1;
let bikeStats = [
    { name: 'Red Rider', color: 0xFF0000, speed: 350, jump: 450, cost: 0, trail: false },
    { name: 'Blue Streak', color: 0x0000FF, speed: 450, jump: 400, cost: 100, trail: true },
    { name: 'Green Machine', color: 0x00FF00, speed: 300, jump: 550, cost: 150, trail: false },
    { name: 'Purple Phantom', color: 0x9400D3, speed: 500, jump: 420, cost: 200, trail: true },
    { name: 'Gold Thunder', color: 0xFFD700, speed: 380, jump: 600, cost: 250, trail: true },
    { name: 'Silver Shadow', color: 0xC0C0C0, speed: 420, jump: 480, cost: 300, trail: true }
];

let isMuted = false;
let audioReady = false;
let levelComplete = false;
let bikeMenuOpen = false;
let musicStarted = false;
let godMode = false;
let zeroGravity = false;
let mobileLeftBtn = null, mobileRightBtn = null, mobileJumpBtn = null, mobileBackflipBtn = null, mobileFrontflipBtn = null;
let touchActive = { left: false, right: false, jump: false, backflip: false, frontflip: false };

function preload() {
    // Load music files if on local server
    const isLocalServer = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    if (isLocalServer) {
        try {
            this.load.audio('bluey-level1', 'Bluey - Keepy Uppy.mp3');
            this.load.audio('bluey-level2', 'Bluey - Dance Mode (ctcruz Remix).mp3');
            this.load.audio('bluey-level3', 'bluey-theme.mp3');
            this.load.audio('bluey-level4', 'Rondo Alla Turca (from _Bluey_).mp3');
        } catch (e) {
            console.log('Could not preload audio files');
        }
    }
}

function create() {
    // Reset level complete flag and music flag
    levelComplete = false;
    musicStarted = false;

    // Create bike FIRST
    bike = this.add.container(200, 450);
    const bikeData = bikeStats[currentBike];
    const body = this.add.rectangle(0, 0, 50, 20, bikeData.color);
    const seat = this.add.rectangle(-5, -10, 30, 8, 0x8B0000);
    const handles = this.add.rectangle(15, -8, 15, 4, 0x333333);
    const fw = this.add.circle(20, 15, 12, 0x000000);
    fw.setStrokeStyle(2, 0x444444);
    const fr = this.add.circle(20, 15, 6, 0x888888);
    const bw = this.add.circle(-20, 15, 12, 0x000000);
    bw.setStrokeStyle(2, 0x444444);
    const br = this.add.circle(-20, 15, 6, 0x888888);
    const rb = this.add.rectangle(-5, -25, 12, 20, 0x0066CC);
    const rh = this.add.circle(-5, -38, 8, 0xFFDBAC);
    const helm = this.add.circle(-5, -40, 9, 0xFFFFFF);
    helm.setStrokeStyle(2, 0xFF0000);

    bike.add([bw, br, fw, fr, body, seat, handles, rb, rh, helm]);
    this.physics.add.existing(bike);
    bike.body.setBounce(0.1).setMaxVelocity(500, 1000).setSize(50, 40).setOffset(-25, -20);
    bike.setDepth(100);
    bike.frontWheel = fw;
    bike.backWheel = bw;
    console.log('Bike created at level', currentLevel, 'position:', bike.x, bike.y);

    // UI
    scoreText = this.add.text(20, 20, 'Score: 0', { fontSize: '32px', fill: '#000', fontStyle: 'bold', stroke: '#fff', strokeThickness: 4 }).setScrollFactor(0).setDepth(500);
    coinsText = this.add.text(20, 60, 'Coins: 0', { fontSize: '32px', fill: '#FFD700', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(500);
    this.add.text(20, 110, '← → : Move  |  ↑ : Jump  |  SPACE : Backflip  |  ↓ : Frontflip  |  B : Bikes', { fontSize: '16px', fill: '#000', backgroundColor: '#ffffff99', padding: { x: 8, y: 4 } }).setScrollFactor(0).setDepth(500);
    this.add.text(600, 20, 'LEVEL ' + currentLevel, { fontSize: '28px', fill: '#FF6600', fontStyle: 'bold', backgroundColor: '#00000088', padding: { x: 10, y: 6 } }).setScrollFactor(0).setDepth(500);

    // Particles
    dustParticles = this.add.particles(0, 0, 'white', { speed: { min: 50, max: 150 }, angle: { min: 60, max: 120 }, scale: { start: 0.4, end: 0 }, alpha: { start: 0.6, end: 0 }, lifespan: 600, tint: 0xDEB887, emitting: false });
    trickTrail = this.add.particles(0, 0, 'white', { speed: 20, scale: { start: 0.3, end: 0 }, alpha: { start: 0.8, end: 0 }, lifespan: 400, tint: 0xFF4500, emitting: false, frequency: 30 });

    // Bike info
    const bikeInfoText = this.add.text(950, 20, '', { fontSize: '20px', fill: '#FFF', fontStyle: 'bold', backgroundColor: '#00000088', padding: { x: 10, y: 6 } }).setScrollFactor(0).setDepth(500);
    const updateBikeInfo = () => { const b = bikeStats[currentBike]; bikeInfoText.setText(b.name + ' | Speed: ' + b.speed + ' | Jump: ' + b.jump); };
    updateBikeInfo();

    // Bike menu
    let bikeMenu = null;

    const openBikeMenu = () => {
        bikeMenuOpen = true;
        bikeMenu = this.add.container(600, 300).setScrollFactor(0);
        const bg = this.add.rectangle(0, 0, 600, 300, 0x000000, 0.9);
        const title = this.add.text(0, -120, 'BIKE GARAGE (Press B to close)', { fontSize: '24px', fill: '#FFD700', fontStyle: 'bold' }).setOrigin(0.5);
        bikeMenu.add([bg, title]);
        bikeStats.forEach((bikeData, index) => {
            const yPos = -130 + (index * 45);
            const unlocked = unlockedBikes[index];
            const statusText = unlocked ? ' [UNLOCKED]' : ' [Cost: ' + bikeData.cost + ' coins]';
            const bikeText = this.add.text(-280, yPos, (index + 1) + '. ' + bikeData.name + ' | Spd:' + bikeData.speed + ' Jump:' + bikeData.jump + statusText, { fontSize: '13px', fill: unlocked ? '#00FF00' : '#FFFFFF' });
            bikeMenu.add(bikeText);
        });
        const hint = this.add.text(0, 150, 'Press 1-6 to select/unlock bikes', { fontSize: '14px', fill: '#FFFF00' }).setOrigin(0.5);
        bikeMenu.add(hint);
    };

    const closeBikeMenu = () => {
        if (bikeMenu) bikeMenu.destroy();
        bikeMenuOpen = false;
    };

    this.input.keyboard.on('keydown-B', () => {
        if (bikeMenuOpen) closeBikeMenu();
        else openBikeMenu();
    });

    // Cheat codes
    this.input.keyboard.on('keydown-C', () => {
        coins += 100;
        coinsText.setText('Coins: ' + coins);
        console.log('Coins cheat activated! Total coins:', coins);
    });

    this.input.keyboard.on('keydown-S', () => {
        score += 500;
        scoreText.setText('Score: ' + score);
        console.log('Score cheat activated! Total score:', score);
    });

    this.input.keyboard.on('keydown-G', () => {
        godMode = !godMode;
        console.log('God mode:', godMode ? 'ON (pass through barrels)' : 'OFF');
    });

    this.input.keyboard.on('keydown-D', () => {
        if (currentLevel === 3) {
            zeroGravity = !zeroGravity;
            this.physics.world.gravity.y = zeroGravity ? 0 : 600;
            console.log('Zero gravity (Level 3):', zeroGravity ? 'ON' : 'OFF');
        }
    });

    // Enable audio on first user interaction
    const scene = this;
    this.input.keyboard.once('keydown', () => { audioReady = true; });
    this.input.on('pointerdown', () => { audioReady = true; });

    // Store keys for checking in update
    const key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    const key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    const key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    const key4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
    const key5 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE);
    const key6 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SIX);
    const keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // Store references for level selection logic
    scene.levelKeys = { key1, key2, key3, key4, key5, key6, keyR, scene };
    scene.levelSelectFuncs = {
        select: (level) => {
            console.log('Selecting level:', level);
            currentLevel = level;
            score = 0;
            coins = 0;
            levelComplete = false;
            scene.scene.restart();
        },
        retry: () => {
            console.log('Retrying level:', currentLevel);
            score = 0;
            coins = 0;
            levelComplete = false;
            scene.scene.restart();
        },
        selectBike: (index) => {
            console.log('Selecting bike:', index);
            const unlocked = unlockedBikes[index];
            if (unlocked) {
                currentBike = index;
                showUnlockEffect(scene, bikeStats[index].name);
                scene.scene.restart();
            }
            else if (coins >= bikeStats[index].cost) {
                coins -= bikeStats[index].cost;
                unlockedBikes[index] = true;
                coinsText.setText('Coins: ' + coins);
                showUnlockEffect(scene, bikeStats[index].name + ' UNLOCKED!');
                closeBikeMenu();
                scene.time.delayedCall(1000, () => scene.scene.restart());
            }
        }
    };

    // Add mobile touch controls
    createMobileControls(this);

    // Play Bluey theme music using Web Audio API (all levels)
    console.log('Music check - isMuted:', isMuted, 'audioReady:', audioReady, 'Level:', currentLevel);
    if (!isMuted && audioReady) {
        console.log('Calling playBlueyTheme for level', currentLevel);
        playBlueyTheme(this);
    }

    // Add mute button next to score
    const muteBtn = this.add.text(20, 100, 'MUTE: OFF', {
        fontSize: '16px',
        fill: '#000',
        backgroundColor: '#FFD700',
        padding: { x: 8, y: 4 },
        fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(500).setInteractive();

    muteBtn.on('pointerdown', () => {
        isMuted = !isMuted;
        muteBtn.setText('MUTE: ' + (isMuted ? 'ON' : 'OFF'));
        muteBtn.setBackgroundColor(isMuted ? '#FF0000' : '#FFD700');
        if (blueyAudio) {
            if (isMuted) {
                blueyAudio.pause();
            } else {
                blueyAudio.resume();
            }
        }
    });

    // NOW Create level
    if (currentLevel === 1) createLevel1(this);
    else if (currentLevel === 2) createLevel2(this);
    else if (currentLevel === 3) createLevel3(this);
    else if (currentLevel === 4) createLevel4(this);

    cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
}

function update() {
    if (!bike) return;

    // Start music once audio is ready
    if (audioReady && !musicStarted) {
        console.log('Audio ready, starting music');
        musicStarted = true;
        playBlueyTheme(this);
    }

    // Handle level selection keys
    if (this.levelKeys) {
        if (Phaser.Input.Keyboard.JustDown(this.levelKeys.key1)) {
            if (levelComplete && !bikeMenuOpen) this.levelSelectFuncs.select(1);
            else if (bikeMenuOpen) this.levelSelectFuncs.selectBike(0);
        }
        if (Phaser.Input.Keyboard.JustDown(this.levelKeys.key2)) {
            if (levelComplete && !bikeMenuOpen) this.levelSelectFuncs.select(2);
            else if (bikeMenuOpen) this.levelSelectFuncs.selectBike(1);
        }
        if (Phaser.Input.Keyboard.JustDown(this.levelKeys.key3)) {
            if (levelComplete && !bikeMenuOpen) this.levelSelectFuncs.select(3);
            else if (bikeMenuOpen) this.levelSelectFuncs.selectBike(2);
        }
        if (Phaser.Input.Keyboard.JustDown(this.levelKeys.key4)) {
            if (levelComplete && !bikeMenuOpen) this.levelSelectFuncs.select(4);
            else if (bikeMenuOpen) this.levelSelectFuncs.selectBike(3);
        }
        if (Phaser.Input.Keyboard.JustDown(this.levelKeys.key5)) {
            if (bikeMenuOpen) this.levelSelectFuncs.selectBike(4);
        }
        if (Phaser.Input.Keyboard.JustDown(this.levelKeys.key6)) {
            if (bikeMenuOpen) this.levelSelectFuncs.selectBike(5);
        }
        if (Phaser.Input.Keyboard.JustDown(this.levelKeys.keyR)) {
            if (levelComplete && !bikeMenuOpen) this.levelSelectFuncs.retry();
            else if (!bikeMenuOpen) this.scene.restart();
        }
    }

    // Check if reached finish line (x >= 5100)
    if (bike.x >= 5100 && !levelComplete) {
        levelComplete = true;
        this.physics.pause();
        const bg = this.add.rectangle(600, 300, 1200, 600, 0x000000, 0.9).setScrollFactor(0).setDepth(1000);
        const title = this.add.text(600, 100, 'LEVEL ' + currentLevel + ' COMPLETE!', { fontSize: '56px', fill: '#FFD700', fontStyle: 'bold', stroke: '#000', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const stats = this.add.text(600, 180, 'Score: ' + score + '  |  Coins: ' + coins, { fontSize: '32px', fill: '#FFFFFF', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const chooseText = this.add.text(600, 280, 'CHOOSE NEXT LEVEL:', { fontSize: '28px', fill: '#FFFF00', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const btn1 = this.add.text(300, 380, 'LEVEL 1\n(Press 1)', { fontSize: '24px', fill: '#000', fontStyle: 'bold', backgroundColor: '#0066FF', padding: { x: 20, y: 20 }, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const btn2 = this.add.text(600, 380, 'LEVEL 2\n(Press 2)', { fontSize: '24px', fill: '#000', fontStyle: 'bold', backgroundColor: '#FF6600', padding: { x: 20, y: 20 }, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const btn3 = this.add.text(900, 380, 'LEVEL 3\n(Press 3)', { fontSize: '24px', fill: '#000', fontStyle: 'bold', backgroundColor: '#FF0099', padding: { x: 20, y: 20 }, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const retryText = this.add.text(600, 500, 'RETRY (Press R)', { fontSize: '26px', fill: '#000', fontStyle: 'bold', backgroundColor: '#00DD00', padding: { x: 20, y: 15 } }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    }

    const bikeData = bikeStats[currentBike];
    if (cursors.left.isDown || touchActive.left) bike.body.setVelocityX(-250);
    else if (cursors.right.isDown || touchActive.right) bike.body.setVelocityX(bikeData.speed);
    else bike.body.setVelocityX(bike.body.velocity.x * 0.92);

    if (bike.frontWheel && bike.backWheel) {
        const wr = bike.body.velocity.x * 0.05;
        bike.frontWheel.rotation += wr;
        bike.backWheel.rotation += wr;
    }

    if ((cursors.up.isDown || touchActive.jump) && bike.body.touching.down) {
        if (Math.abs(bike.body.velocity.x) > 150 && canJump) {
            isWheelying = true;
            bike.angle = -15;
        } else if (canJump) {
            bike.body.setVelocityY(-bikeData.jump);
            canJump = false;
            isWheelying = false;
        }
    } else if (isWheelying && bike.body.touching.down) {
        isWheelying = false;
        if (wheelieTime > 1) {
            const wp = Math.floor(wheelieTime * 5);
            score += wp;
            scoreText.setText('Score: ' + score);
            showTrickText(this, bike.x, bike.y - 60, 'WHEELIE +' + wp, '#00FF00');
        }
        wheelieTime = 0;
    }

    if (isWheelying && bike.body.touching.down) {
        wheelieTime += 0.016;
        if (wheelieText) wheelieText.destroy();
        wheelieText = this.add.text(bike.x, bike.y - 70, 'WHEELIE!', { fontSize: '20px', fill: '#00FF00', fontStyle: 'bold' });
        this.time.delayedCall(100, () => { if (wheelieText) wheelieText.destroy(); });
    }

    if (bike.body.touching.down && !isWheelying) canJump = true;

    if ((this.spaceKey.isDown || touchActive.backflip) && !bike.body.touching.down) {
        if (!isFlipping) { flipStartAngle = bike.angle; isFlipping = true; flipDirection = 1; }
        bike.angle += 6;
    }

    if ((cursors.down.isDown || touchActive.frontflip) && !bike.body.touching.down) {
        if (!isFlipping) { flipStartAngle = bike.angle; isFlipping = true; flipDirection = -1; }
        bike.angle -= 6;
    }

    if (isFlipping) {
        const ra = Math.abs(bike.angle - flipStartAngle);
        if (ra >= 360 && ra < 420) {
            const fn = flipDirection === 1 ? 'BACKFLIP' : 'FRONTFLIP';
            tricksThisCombo.push({ name: fn, points: 100 });
            comboCount++;
            showTrickText(this, bike.x, bike.y - 60, fn + '!', '#FF4500');
            isFlipping = false;
        }
        if (ra >= 720 && ra < 780) {
            const fn = flipDirection === 1 ? 'DOUBLE BACK' : 'DOUBLE FRONT';
            tricksThisCombo.push({ name: fn, points: 250 });
            comboCount++;
            showTrickText(this, bike.x, bike.y - 60, fn + '!', '#FF0000');
            isFlipping = false;
        }
    }

    if (bike.body.touching.down && !this.spaceKey.isDown && !isWheelying) {
        const ta = Math.round(bike.angle / 360) * 360;
        const aba = bike.angle % 360;
        bike.angle = Phaser.Math.Linear(bike.angle, ta, 0.15);
        isFlipping = false;

        if (wasInAir && Math.abs(bike.body.velocity.y) > 100) {
            dustParticles.emitParticleAt(bike.x, bike.y + 25, 8);

            if (tricksThisCombo.length > 0) {
                let cp = 0;
                tricksThisCombo.forEach(t => { cp += t.points; });
                const pl = Math.abs(aba) < 10 || Math.abs(aba - 360) < 10;
                if (pl) { cp += 50; showTrickText(this, bike.x + 30, bike.y - 40, 'PERFECT!', '#00FF00'); }
                if (comboCount > 1) { comboMultiplier = comboCount; cp *= comboMultiplier; showTrickText(this, bike.x, bike.y - 90, 'x' + comboMultiplier + ' COMBO!', '#FFD700'); }
                score += cp;
                scoreText.setText('Score: ' + score);
                showTrickText(this, bike.x, bike.y - 60, '+' + cp, '#FFFFFF');
                tricksThisCombo = [];
                comboCount = 0;
                comboMultiplier = 1;
            }
        }
    }

    wasInAir = !bike.body.touching.down;
    if (isFlipping) trickTrail.emitParticleAt(bike.x, bike.y, 2);

    // Special bike trail effects for certain bikes
    if (bikeData && bikeData.trail && bike.body.velocity.x > 200) {
        const trailColor = bikeData.color;
        const trail = this.add.circle(bike.x - 30, bike.y, 5, trailColor, 0.6);
        this.tweens.add({ targets: trail, alpha: 0, scale: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => trail.destroy() });
    }

    if (bike.y > 800) {
        this.add.text(this.cameras.main.scrollX + 600, 300, 'YOU FELL!\nPress R to Restart', { fontSize: '48px', fill: '#FF0000', fontStyle: 'bold', stroke: '#000', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setScrollFactor(0);
    }
}

function createLevel1(scene) {
    // Background layers
    const skyGradient = scene.add.rectangle(2500, 300, 5000, 600, 0xFF9933).setScrollFactor(0).setDepth(-10);
    const sun = scene.add.circle(800, 120, 80, 0xFFAA00);
    sun.setStrokeStyle(8, 0xFFDD00).setScrollFactor(0.1).setDepth(-5);

    // Sand dunes - parallax effect
    const dune1 = scene.add.ellipse(400, 480, 700, 150, 0xD2B48C, 0.6);
    dune1.setScrollFactor(0.3).setDepth(-2);
    const dune2 = scene.add.ellipse(1200, 500, 800, 160, 0xDEB887, 0.5);
    dune2.setScrollFactor(0.35).setDepth(-2);
    const dune3 = scene.add.ellipse(1900, 480, 750, 140, 0xD2B48C, 0.6);
    dune3.setScrollFactor(0.3).setDepth(-2);
    const dune4 = scene.add.ellipse(2700, 500, 900, 180, 0xDEB887, 0.5);
    dune4.setScrollFactor(0.4).setDepth(-2);

    // Decorative cacti, rocks, and tumbleweeds
    drawCactus(scene, 300, 500, 0.5);
    drawCactus(scene, 1100, 480, 0.4);
    drawCactus(scene, 1650, 490, 0.45);
    drawCactus(scene, 2100, 500, 0.5);
    drawCactus(scene, 3000, 510, 0.5);
    drawCactus(scene, 4000, 495, 0.45);

    // Rocks
    for (let x = 500; x <= 4500; x += 800) {
        const rockSize = 20 + Math.random() * 15;
        const rock = scene.add.circle(x + Math.random() * 300, 540, rockSize, 0x8B7355);
        rock.setScrollFactor(0.5);
    }

    platforms = scene.physics.add.staticGroup();
    const g = scene.add.rectangle(2500, 560, 5000, 80, 0xD2691E);
    scene.physics.add.existing(g, true);
    platforms.add(g);

    const pdata = [
        {x:400,y:500,w:300,h:20},{x:700,y:480,w:200,h:20},{x:1000,y:420,w:250,h:20},
        {x:1300,y:450,w:250,h:20},{x:1600,y:350,w:200,h:20},{x:1900,y:380,w:250,h:20},
        {x:2200,y:450,w:250,h:20},{x:2450,y:500,w:150,h:20},{x:2700,y:480,w:150,h:20},
        {x:2950,y:450,w:150,h:20},{x:3300,y:400,w:300,h:20},{x:3700,y:300,w:300,h:20},
        {x:3950,y:320,w:100,h:20},{x:4100,y:340,w:100,h:20},{x:4250,y:360,w:100,h:20},
        {x:4500,y:450,w:250,h:20},{x:4800,y:350,w:250,h:20}
    ];
    pdata.forEach(p => {
        const pt = scene.add.rectangle(p.x, p.y, p.w, p.h, 0xCD853F);
        pt.setStrokeStyle(2, 0x8B4513);
        scene.physics.add.existing(pt, true);
        platforms.add(pt);
    });

    const fl = scene.add.rectangle(5100, 480, 200, 20, 0x00FF00);
    scene.physics.add.existing(fl, true);
    fl.label = 'finish';

    obstacles = scene.physics.add.staticGroup();
    const bpos = [600, 850, 1100, 1400, 1700, 2000, 2300, 2600, 2900, 3200, 3600, 3900, 4200, 4500, 4700, 5000];
    bpos.forEach(x => {
        const b = createBarrel(scene, x, 450);
        obstacles.add(b);
    });

    coinGroup = scene.physics.add.staticGroup();
    const cpos = [{x:450,y:450},{x:650,y:420},{x:850,y:380},{x:1050,y:360},{x:1250,y:330},{x:1450,y:300},{x:1650,y:310},{x:1850,y:350},{x:2050,y:400},
                   {x:2250,y:420},{x:2450,y:380},{x:2650,y:340},{x:2850,y:310},{x:3050,y:330},{x:3250,y:280},{x:3450,y:250},{x:3650,y:260},
                   {x:3850,y:300},{x:4050,y:350},{x:4250,y:320},{x:4450,y:280},{x:4650,y:300},{x:4850,y:340},{x:5000,y:380}];
    cpos.forEach(p => {
        const c = scene.add.circle(p.x, p.y, 15, 0xFFD700);
        c.setStrokeStyle(3, 0xFFA500);
        coinGroup.add(c);
    });

    scene.physics.add.collider(bike, platforms, () => { canJump = true; });
    scene.physics.add.overlap(bike, obstacles, (b, o) => hitObstacle(b, o, scene));
    scene.physics.add.overlap(bike, coinGroup, (b, c) => collectCoin(b, c, scene));
    scene.physics.add.overlap(bike, fl, (b, p) => checkFinish(b, p, scene));
    scene.cameras.main.setBounds(0, 0, 5200, 600).startFollow(bike, true, 0.08, 0.08);
}

function createLevel2(scene) {
    // Mountain background
    const skyBg = scene.add.rectangle(2500, 300, 5000, 600, 0x87CEEB).setScrollFactor(0).setDepth(-10);

    // Distant mountains (parallax)
    const m1 = scene.add.polygon(400, 350, [0,0,600,400,300,100], 0x555555);
    m1.setScrollFactor(0.2).setDepth(-5);
    const m2 = scene.add.polygon(1600, 320, [0,0,700,450,350,80], 0x444444);
    m2.setScrollFactor(0.2).setDepth(-5);
    const m3 = scene.add.polygon(2800, 340, [0,0,800,480,400,60], 0x555555);
    m3.setScrollFactor(0.25).setDepth(-5);
    const m4 = scene.add.polygon(4200, 330, [0,0,700,420,350,90], 0x444444);
    m4.setScrollFactor(0.25).setDepth(-5);

    // Clouds
    for (let x = 200; x <= 5000; x += 1200) {
        const cloud1 = scene.add.ellipse(x, 150, 150, 50, 0xFFFFFF, 0.6);
        cloud1.setScrollFactor(0.15).setDepth(-4);
        const cloud2 = scene.add.ellipse(x + 600, 200, 120, 40, 0xFFFFFF, 0.5);
        cloud2.setScrollFactor(0.18).setDepth(-4);
    }

    // Pine trees
    for (let x = 300; x <= 4800; x += 900) {
        drawTree(scene, x, 470, 0.6);
    }

    platforms = scene.physics.add.staticGroup();
    obstacles = scene.physics.add.staticGroup();

    const g = scene.add.rectangle(2500, 560, 5000, 80, 0x8B7355);
    scene.physics.add.existing(g, true);
    platforms.add(g);

    const rp = [{x:400,y:500,w:300,h:20},{x:650,y:470,w:200,h:20},{x:950,y:420,w:250,h:20},
               {x:1250,y:380,w:200,h:20},{x:1550,y:350,w:250,h:20},{x:1800,y:320,w:200,h:20},
               {x:2100,y:380,w:300,h:20},{x:2450,y:420,w:250,h:20},{x:2750,y:460,w:200,h:20},
               {x:3050,y:380,w:300,h:20},{x:3400,y:340,w:250,h:20},{x:3750,y:300,w:250,h:20},
               {x:4100,y:340,w:200,h:20},{x:4400,y:400,w:250,h:20},{x:4750,y:380,w:300,h:20}];
    rp.forEach(p => {
        const pt = scene.add.rectangle(p.x, p.y, p.w, p.h, 0x8B7355);
        pt.setStrokeStyle(2, 0x654321);
        scene.physics.add.existing(pt, true);
        platforms.add(pt);
    });

    const fl = scene.add.rectangle(5100, 480, 200, 20, 0x00FF00);
    scene.physics.add.existing(fl, true);
    fl.label = 'finish';

    for (let i = 0; i < 16; i++) {
        const x = 400 + i * 300 + Math.random() * 100;
        const y = Math.random() * 120 + 320;
        const b = createBarrel(scene, x, y);
        obstacles.add(b);
    }

    coinGroup = scene.physics.add.staticGroup();
    const cp = [{x:400,y:450},{x:600,y:430},{x:800,y:400},{x:1000,y:360},{x:1200,y:330},{x:1400,y:310},{x:1600,y:280},{x:1800,y:270},{x:2000,y:310},
               {x:2200,y:350},{x:2400,y:380},{x:2600,y:410},{x:2800,y:390},{x:3000,y:350},{x:3200,y:320},{x:3400,y:290},{x:3600,y:260},
               {x:3800,y:250},{x:4000,y:280},{x:4200,y:320},{x:4400,y:360},{x:4600,y:340},{x:4800,y:310},{x:5000,y:360}];
    cp.forEach(p => {
        const c = scene.add.circle(p.x, p.y, 15, 0xFFD700);
        c.setStrokeStyle(3, 0xFFA500);
        coinGroup.add(c);
    });

    scene.physics.add.collider(bike, platforms, () => { canJump = true; });
    scene.physics.add.overlap(bike, obstacles, (b, o) => hitObstacle(b, o, scene));
    scene.physics.add.overlap(bike, coinGroup, (b, c) => collectCoin(b, c, scene));
    scene.physics.add.overlap(bike, fl, (b, p) => checkFinish(b, p, scene));
    scene.cameras.main.setBounds(0, 0, 5200, 600).startFollow(bike, true, 0.08, 0.08);
}

function createLevel3(scene) {
    // Space background gradient
    const spaceBg = scene.add.rectangle(2500, 300, 5000, 600, 0x000511).setScrollFactor(0).setDepth(-10);

    // Nebula/space clouds
    const nebula1 = scene.add.ellipse(1000, 200, 800, 300, 0xFF00AA, 0.15);
    nebula1.setScrollFactor(0.1).setDepth(-8);
    const nebula2 = scene.add.ellipse(3500, 350, 900, 250, 0x00FFFF, 0.12);
    nebula2.setScrollFactor(0.15).setDepth(-8);

    // Twinkling stars (static background)
    for (let i = 0; i < 120; i++) {
        const star = scene.add.circle(Math.random() * 5200, Math.random() * 600, 1 + Math.random() * 1.5, 0xFFFFFF);
        star.setScrollFactor(0).setDepth(-9);
    }

    // Distant asteroids (parallax)
    for (let i = 0; i < 8; i++) {
        const ax = 400 + i * 600;
        const ay = 100 + Math.random() * 200;
        const asteroidSize = 15 + Math.random() * 20;
        const asteroid = scene.add.circle(ax, ay, asteroidSize, 0x8B7355);
        asteroid.setScrollFactor(0.1).setDepth(-7);
    }

    platforms = scene.physics.add.staticGroup();
    obstacles = scene.physics.add.staticGroup();

    const g = scene.add.rectangle(2500, 560, 5000, 80, 0x1a1a2e);
    scene.physics.add.existing(g, true);
    platforms.add(g);

    const lp = [{x:400,y:500,w:200,h:20},{x:650,y:480,w:120,h:20},{x:850,y:460,w:120,h:20},
               {x:1050,y:440,w:120,h:20},{x:1300,y:380,w:300,h:20},{x:1700,y:300,w:150,h:20},
               {x:2000,y:250,w:150,h:20},{x:2300,y:200,w:150,h:20},{x:2600,y:280,w:200,h:20},
               {x:3000,y:400,w:200,h:20},{x:3350,y:320,w:120,h:20},{x:3550,y:280,w:120,h:20},
               {x:3750,y:240,w:120,h:20},{x:4000,y:300,w:300,h:20},{x:4450,y:380,w:200,h:20},
               {x:4800,y:420,w:200,h:20}];
    lp.forEach((p, i) => {
        const colors = [0xFF00FF, 0x00FFFF, 0x00FF00, 0xFFFF00, 0xFF0080];
        const color = colors[i % colors.length];
        const pt = scene.add.rectangle(p.x, p.y, p.w, p.h, color);
        pt.setStrokeStyle(2, 0xFFFFFF);
        scene.physics.add.existing(pt, true);
        platforms.add(pt);
    });

    const fl = scene.add.rectangle(5100, 480, 200, 20, 0x00FF00);
    scene.physics.add.existing(fl, true);
    fl.label = 'finish';

    for (let i = 0; i < 25; i++) {
        const x = 300 + i * 200 + Math.random() * 80;
        const y = Math.random() * 180 + 280;
        const b = createBarrel(scene, x, y);
        obstacles.add(b);
    }

    coinGroup = scene.physics.add.staticGroup();
    const lc = [{x:450,y:420},{x:650,y:400},{x:850,y:380},{x:1050,y:350},{x:1300,y:300},{x:1550,y:260},{x:1800,y:200},
               {x:2050,y:150},{x:2300,y:180},{x:2550,y:240},{x:2800,y:300},{x:3050,y:320},{x:3300,y:280},{x:3550,y:240},
               {x:3800,y:180},{x:4050,y:150},{x:4300,y:200},{x:4550,y:260},{x:4800,y:310},{x:5050,y:360}];
    lc.forEach(p => {
        const c = scene.add.circle(p.x, p.y, 15, 0xFFFFFF);
        c.setStrokeStyle(3, 0x00FFFF);
        coinGroup.add(c);
    });

    scene.physics.add.collider(bike, platforms, () => { canJump = true; });
    scene.physics.add.overlap(bike, obstacles, (b, o) => hitObstacle(b, o, scene));
    scene.physics.add.overlap(bike, coinGroup, (b, c) => collectCoin(b, c, scene));
    scene.physics.add.overlap(bike, fl, (b, p) => checkFinish(b, p, scene));
    scene.cameras.main.setBounds(0, 0, 5200, 600).startFollow(bike, true, 0.08, 0.08);
}

function createLevel4(scene) {
    // Volcano/lava background
    const volcanoBg = scene.add.rectangle(2500, 300, 5000, 600, 0x330000).setScrollFactor(0).setDepth(-10);

    // Smoke clouds
    for (let x = 300; x <= 4800; x += 900) {
        const smoke1 = scene.add.ellipse(x, 100, 200, 100, 0x666666, 0.4);
        smoke1.setScrollFactor(0.1).setDepth(-8);
        const smoke2 = scene.add.ellipse(x + 400, 150, 180, 80, 0x555555, 0.35);
        smoke2.setScrollFactor(0.12).setDepth(-8);
    }

    // Lava pools/flows (animated effect with circles)
    for (let x = 600; x <= 4500; x += 1200) {
        const lavaPool = scene.add.ellipse(x, 520, 400, 80, 0xFF4500, 0.7);
        lavaPool.setScrollFactor(0.5).setDepth(-3);
    }

    // Hot rocks scattered around
    for (let x = 400; x <= 4800; x += 600) {
        const rockSize = 15 + Math.random() * 25;
        const rock = scene.add.circle(x + Math.random() * 400, 480 + Math.random() * 60, rockSize, 0xFF6347);
        rock.setScrollFactor(0.5).setDepth(-2);
    }

    platforms = scene.physics.add.staticGroup();
    obstacles = scene.physics.add.staticGroup();

    // Main ground
    const g = scene.add.rectangle(2500, 560, 5000, 80, 0x4a2c2a);
    scene.physics.add.existing(g, true);
    platforms.add(g);

    // Lava platforms (darker red with glow effect)
    const lp = [{x:400,y:500,w:280,h:20},{x:680,y:480,w:180,h:20},{x:950,y:420,w:220,h:20},
               {x:1250,y:380,w:200,h:20},{x:1580,y:350,w:240,h:20},{x:1880,y:320,w:200,h:20},
               {x:2150,y:380,w:280,h:20},{x:2500,y:420,w:240,h:20},{x:2850,y:460,w:200,h:20},
               {x:3150,y:380,w:280,h:20},{x:3500,y:340,w:240,h:20},{x:3850,y:300,w:240,h:20},
               {x:4150,y:340,w:200,h:20},{x:4450,y:400,w:240,h:20},{x:4800,y:380,w:280,h:20}];
    lp.forEach((p, i) => {
        const pt = scene.add.rectangle(p.x, p.y, p.w, p.h, 0xCC3300);
        pt.setStrokeStyle(2, 0xFF6347);
        scene.physics.add.existing(pt, true);
        platforms.add(pt);
    });

    // Finish line (lava waterfall themed)
    const fl = scene.add.rectangle(5100, 480, 200, 20, 0x00FFFF);
    fl.setStrokeStyle(3, 0x00FF00);
    scene.physics.add.existing(fl, true);
    fl.label = 'finish';

    // Magma obstacles
    obstacles = scene.physics.add.staticGroup();
    for (let i = 0; i < 20; i++) {
        const x = 400 + i * 260 + Math.random() * 100;
        const y = 300 + Math.random() * 150;
        const b = createMagmaBlob(scene, x, y);
        obstacles.add(b);
    }

    coinGroup = scene.physics.add.staticGroup();
    const lc = [{x:450,y:420},{x:650,y:400},{x:850,y:370},{x:1050,y:340},{x:1250,y:310},{x:1450,y:280},{x:1650,y:260},
               {x:1850,y:280},{x:2050,y:320},{x:2250,y:360},{x:2450,y:380},{x:2650,y:350},{x:2850,y:310},
               {x:3050,y:280},{x:3250,y:260},{x:3450,y:280},{x:3650,y:310},{x:3850,y:340},{x:4050,y:360},{x:4250,y:340},
               {x:4450,y:310},{x:4650,y:280},{x:4850,y:300},{x:5050,y:350}];
    lc.forEach(p => {
        const c = scene.add.circle(p.x, p.y, 15, 0xFFFF00);
        c.setStrokeStyle(3, 0xFF8800);
        coinGroup.add(c);
    });

    scene.physics.add.collider(bike, platforms, () => { canJump = true; });
    scene.physics.add.overlap(bike, obstacles, (b, o) => hitObstacle(b, o, scene));
    scene.physics.add.overlap(bike, coinGroup, (b, c) => collectCoin(b, c, scene));
    scene.physics.add.overlap(bike, fl, (b, p) => checkFinish(b, p, scene));
    scene.cameras.main.setBounds(0, 0, 5200, 600).startFollow(bike, true, 0.08, 0.08);
}

function createMagmaBlob(scene, x, y) {
    const blob = scene.add.circle(x, y, 25, 0xFF4500);
    blob.setStrokeStyle(2, 0xFF6347);
    return blob;
}

function drawCactus(scene, x, y, sf) {
    const t = scene.add.rectangle(x, y, 20, 60, 0x2D5016);
    t.setScrollFactor(sf);
    const la = scene.add.rectangle(x - 15, y - 10, 25, 12, 0x2D5016);
    la.setScrollFactor(sf);
    const ra = scene.add.rectangle(x + 15, y - 5, 25, 12, 0x2D5016);
    ra.setScrollFactor(sf);
    for (let i = 0; i < 5; i++) {
        const sp = scene.add.line(0, 0, 0, 0, 3, 0, 0x1a300a);
        sp.setLineWidth(2).setOrigin(0).setPosition(x - 10 + Math.random() * 20, y - 30 + i * 15).setScrollFactor(sf);
    }
}

function drawTree(scene, x, y, sf) {
    // Trunk
    const trunk = scene.add.rectangle(x, y - 20, 15, 60, 0x654321);
    trunk.setScrollFactor(sf);

    // Foliage (triangle shape made of circles)
    const top = scene.add.circle(x, y - 70, 40, 0x228B22);
    top.setScrollFactor(sf);
    const mid = scene.add.circle(x, y - 30, 50, 0x2E8B57);
    mid.setScrollFactor(sf);
    const bot = scene.add.circle(x, y + 10, 45, 0x228B22);
    bot.setScrollFactor(sf);
}

function createBarrel(scene, x, y) {
    const b = scene.add.rectangle(x, y, 30, 40, 0xFF0000);
    b.setStrokeStyle(3, 0x8B0000);
    const w = scene.add.text(x, y, '!', { fontSize: '28px', fill: '#FFFF00', fontStyle: 'bold' }).setOrigin(0.5);
    b.warningText = w;
    return b;
}

function collectCoin(bikeObj, coin, scene) {
    coin.destroy();
    coins += 10;
    score += 10;
    coinsText.setText('Coins: ' + coins);
    scoreText.setText('Score: ' + score);
    showTrickText(scene, coin.x, coin.y, '+10', '#FFD700');

    // Play coin sound - simple beep
    if (!isMuted && audioReady) {
        try {
            const audioContext = scene.sound.context;
            if (audioContext) {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.frequency.value = 800;
                gain.gain.setValueAtTime(0.3, audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                osc.start(audioContext.currentTime);
                osc.stop(audioContext.currentTime + 0.1);
            }
        } catch (e) {}
    }
}

function hitObstacle(bikeObj, obstacle, scene) {
    // God mode - pass through barrels
    if (godMode) {
        console.log('God mode active - barrel passed through!');
        return;
    }

    if (obstacle.warningText) obstacle.warningText.destroy();
    const exp = scene.add.particles(obstacle.x, obstacle.y, 'white', {
        speed: { min: 100, max: 200 }, scale: { start: 0.6, end: 0 }, tint: [0xFF0000, 0xFF4500, 0xFFFF00], lifespan: 500, quantity: 15
    });
    scene.time.delayedCall(500, () => exp.destroy());
    obstacle.destroy();
    score = Math.max(0, score - 50);
    scoreText.setText('Score: ' + score);
    showTrickText(scene, obstacle.x, obstacle.y - 40, '-50!', '#FF0000');

    // Play barrel explosion sound - simple noise burst
    if (!isMuted && audioReady) {
        try {
            const audioContext = scene.sound.context;
            if (audioContext) {
                const bufferSize = audioContext.sampleRate * 0.1;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const source = audioContext.createBufferSource();
                const gain = audioContext.createGain();
                source.buffer = buffer;
                source.connect(gain);
                gain.connect(audioContext.destination);
                gain.gain.setValueAtTime(0.4, audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                source.start(audioContext.currentTime);
            }
        } catch (e) {}
    }
}

function checkFinish(bikeObj, platform, scene) {
    if (!levelComplete) {
        levelComplete = true;
        scene.physics.pause();

        const bg = scene.add.rectangle(600, 300, 1200, 600, 0x000000, 0.9).setScrollFactor(0).setDepth(1000);
        const title = scene.add.text(600, 80, 'LEVEL ' + currentLevel + ' COMPLETE!', { fontSize: '52px', fill: '#FFD700', fontStyle: 'bold', stroke: '#000', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const stats = scene.add.text(600, 160, 'Score: ' + score + '  |  Coins: ' + coins, { fontSize: '28px', fill: '#FFFFFF', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        const chooseText = scene.add.text(600, 240, 'CHOOSE NEXT LEVEL:', { fontSize: '24px', fill: '#FFFF00', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        const btn1 = scene.add.text(180, 320, 'L1\n(1)', { fontSize: '16px', fill: '#000', fontStyle: 'bold', backgroundColor: '#0066FF', padding: { x: 12, y: 10 }, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const btn2 = scene.add.text(400, 320, 'L2\n(2)', { fontSize: '16px', fill: '#000', fontStyle: 'bold', backgroundColor: '#FF6600', padding: { x: 12, y: 10 }, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const btn3 = scene.add.text(620, 320, 'L3\n(3)', { fontSize: '16px', fill: '#000', fontStyle: 'bold', backgroundColor: '#FF0099', padding: { x: 12, y: 10 }, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        const btn4 = scene.add.text(840, 320, 'L4\n(4)', { fontSize: '16px', fill: '#000', fontStyle: 'bold', backgroundColor: '#FF3300', padding: { x: 12, y: 10 }, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        const retryText = scene.add.text(600, 420, 'RETRY (Press R)', { fontSize: '22px', fill: '#000', fontStyle: 'bold', backgroundColor: '#00DD00', padding: { x: 20, y: 12 } }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    }
}

function showTrickText(scene, x, y, text, color) {
    const tt = scene.add.text(x, y, text, { fontSize: '28px', fill: color, fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    scene.tweens.add({ targets: tt, alpha: 0, y: y - 70, duration: 1200, ease: 'Cubic.easeOut', onComplete: () => tt.destroy() });
}

function createMobileControls(scene) {
    const w = scene.scale.width;
    const h = scene.scale.height;
    const btnSize = 50;
    const btnGap = 10;

    // Left button
    mobileLeftBtn = scene.add.rectangle(btnSize, h - btnSize, btnSize, btnSize, 0x0066FF, 0.7)
        .setScrollFactor(0).setDepth(500).setInteractive();
    scene.add.text(btnSize, h - btnSize, '◀', { fontSize: '32px', fill: '#FFF', fontStyle: 'bold' })
        .setScrollFactor(0).setDepth(501).setOrigin(0.5);

    // Right button
    mobileRightBtn = scene.add.rectangle(btnSize * 3 + btnGap * 2, h - btnSize, btnSize, btnSize, 0x0066FF, 0.7)
        .setScrollFactor(0).setDepth(500).setInteractive();
    scene.add.text(btnSize * 3 + btnGap * 2, h - btnSize, '▶', { fontSize: '32px', fill: '#FFF', fontStyle: 'bold' })
        .setScrollFactor(0).setDepth(501).setOrigin(0.5);

    // Jump button
    mobileJumpBtn = scene.add.rectangle(w - btnSize, h - btnSize, btnSize, btnSize, 0x00DD00, 0.7)
        .setScrollFactor(0).setDepth(500).setInteractive();
    scene.add.text(w - btnSize, h - btnSize, 'JUMP', { fontSize: '12px', fill: '#000', fontStyle: 'bold' })
        .setScrollFactor(0).setDepth(501).setOrigin(0.5);

    // Backflip button
    mobileBackflipBtn = scene.add.rectangle(w - btnSize, h - btnSize * 3 - btnGap * 2, btnSize, btnSize, 0xFF6600, 0.7)
        .setScrollFactor(0).setDepth(500).setInteractive();
    scene.add.text(w - btnSize, h - btnSize * 3 - btnGap * 2, 'FLIP\nBACK', { fontSize: '10px', fill: '#000', fontStyle: 'bold', align: 'center' })
        .setScrollFactor(0).setDepth(501).setOrigin(0.5);

    // Frontflip button
    mobileFrontflipBtn = scene.add.rectangle(w - btnSize, h - btnSize * 2 - btnGap, btnSize, btnSize, 0xFF0099, 0.7)
        .setScrollFactor(0).setDepth(500).setInteractive();
    scene.add.text(w - btnSize, h - btnSize * 2 - btnGap, 'FLIP\nFRONT', { fontSize: '10px', fill: '#000', fontStyle: 'bold', align: 'center' })
        .setScrollFactor(0).setDepth(501).setOrigin(0.5);

    // Touch events for buttons
    setupButtonTouchEvents(scene, mobileLeftBtn, 'left');
    setupButtonTouchEvents(scene, mobileRightBtn, 'right');
    setupButtonTouchEvents(scene, mobileJumpBtn, 'jump');
    setupButtonTouchEvents(scene, mobileBackflipBtn, 'backflip');
    setupButtonTouchEvents(scene, mobileFrontflipBtn, 'frontflip');
}

function setupButtonTouchEvents(scene, button, action) {
    button.on('pointerdown', () => { touchActive[action] = true; button.setAlpha(1); });
    button.on('pointerup', () => { touchActive[action] = false; button.setAlpha(0.7); });
    button.on('pointerout', () => { touchActive[action] = false; button.setAlpha(0.7); });
}

function showUnlockEffect(scene, bikeName) {
    const unlockText = scene.add.text(600, 300, bikeName, { fontSize: '48px', fill: '#FFD700', fontStyle: 'bold', stroke: '#000', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    for (let i = 0; i < 30; i++) {
        const star = scene.add.polygon(600 + Math.random() * 400 - 200, 300 + Math.random() * 300 - 150, [0, 10, 5, 0, 10, 5], 0xFFFF00);
        star.setScrollFactor(0).setDepth(1999);
        scene.tweens.add({
            targets: star,
            x: 600 + Math.random() * 600 - 300,
            y: 300 + Math.random() * 400 - 200,
            alpha: 0,
            scale: 0,
            duration: 1500,
            ease: 'Quad.easeOut',
            onComplete: () => star.destroy()
        });
    }
    scene.tweens.add({
        targets: unlockText,
        scale: 1.2,
        duration: 300,
        yoyo: true,
        onComplete: () => {
            scene.time.delayedCall(700, () => unlockText.destroy());
        }
    });
}

let blueyAudio = null;

function playBlueyTheme(scene) {
    console.log('playBlueyTheme called, isMuted:', isMuted);
    if (!scene || !scene.sound) return;
    if (isMuted) {
        if (blueyAudio) blueyAudio.stop();
        return;
    }

    // Stop previous audio
    if (blueyAudio) blueyAudio.stop();
    blueyAudio = null;

    const isLocalServer = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    console.log('isLocalServer:', isLocalServer);

    // Resume audio context for iOS
    if (scene.sound.context && scene.sound.context.state === 'suspended') {
        console.log('Resuming audio context for iOS');
        scene.sound.context.resume();
    }

    // Try to load level-specific music if on local server
    if (isLocalServer) {
        try {
            const audioKey = 'bluey-level' + currentLevel;
            console.log('Trying to load audio key:', audioKey);
            blueyAudio = scene.sound.add(audioKey);
            console.log('Audio loaded, playing...');
            blueyAudio.play({ loop: true, volume: 0.5 });
            return;
        } catch (e) {
            console.log('Could not load audio file for level ' + currentLevel, e);
        }
    }

    // Fallback: synthesized Web Audio API
    const audioContext = scene.sound.context;
    if (!audioContext) return;

    try {
        const now = audioContext.currentTime;
        const notes = [
            { freq: 523, time: 0.3 },    // C5
            { freq: 659, time: 0.3 },    // E5
            { freq: 784, time: 0.3 },    // G5
            { freq: 659, time: 0.3 },    // E5
            { freq: 523, time: 0.6 },    // C5
            { freq: 659, time: 0.3 },    // E5
            { freq: 784, time: 0.3 },    // G5
            { freq: 880, time: 0.6 }     // A5
        ];

        let currentTime = now;
        notes.forEach(note => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = note.freq;
            gain.gain.setValueAtTime(0.2, currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, currentTime + note.time);
            osc.start(currentTime);
            osc.stop(currentTime + note.time);
            currentTime += note.time;
        });

        // Loop the theme
        scene.time.delayedCall(3000, () => {
            if (!isMuted) playBlueyTheme(scene);
        });
    } catch (e) {
        console.log('Could not play theme:', e);
    }
}
