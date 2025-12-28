import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Pause, Trophy } from 'lucide-react';
import { Plane, Runway, Point, GameState, PlaneType, Explosion } from './types';
import { COLORS, PLANE_SPEED, LANDING_SPEED, COLLISION_RADIUS, SPAWN_RATE_INITIAL, SPAWN_RATE_MIN } from './constants';
import { playSound, selectSound, landSound, crashSound } from './sounds'; // Import sound utilities

const HIGH_SCORE_KEY = 'sky-guide-high-score';

const App: React.FC = () => {
  // UI State
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(2);
  const [highScore, setHighScore] = useState(0);

  // Refs for Game Logic (mutable state without re-renders)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const planesRef = useRef<Plane[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const lastSpawnTime = useRef<number>(0);
  const spawnRate = useRef<number>(SPAWN_RATE_INITIAL);
  const runwaysRef = useRef<Runway[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(2);
  const isPausedRef = useRef(false);
  
  // Touch handling refs
  const activePlaneId = useRef<string | null>(null);
  const currentPath = useRef<Point[]>([]);

  // Load High Score on Mount
  useEffect(() => {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  // Initialize Game
  const initGame = useCallback(() => {
    planesRef.current = [];
    explosionsRef.current = [];
    scoreRef.current = 0;
    livesRef.current = 2;
    spawnRate.current = SPAWN_RATE_INITIAL;
    lastSpawnTime.current = performance.now();
    isPausedRef.current = false;
    
    setScore(0);
    setLives(2);
    
    // Setup Runways based on screen size (handled in resize, but init needs empty)
    if (canvasRef.current) {
      setupRunways(canvasRef.current);
    }
  }, []);

  const setupRunways = (canvas: HTMLCanvasElement) => {
    const { width, height } = canvas;
    
    // Create 2 runways: Red and Blue
    const cx = width / 2;
    const cy = height / 2;
    
    runwaysRef.current = [
      {
        id: 'r1',
        x: cx - 80,
        y: cy,
        width: 40,
        height: 180,
        angle: 0, // Red runway: vertical, entry from bottom (positive Y in world space)
        entryPoint: { x: cx - 80, y: cy + 90 } // Bottom entry
      },
      {
        id: 'r2',
        x: cx + 80,
        y: cy,
        width: 40,
        height: 180,
        angle: Math.PI, // Blue runway: vertical, entry from top (negative Y in world space)
        entryPoint: { x: cx + 80, y: cy - 90 } // Top entry
      }
    ];
  };

  // Spawning Logic
  const spawnPlane = (currentTime: number, width: number, height: number) => {
    if (currentTime - lastSpawnTime.current > spawnRate.current) {
      const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      let x = 0, y = 0, angle = 0;
      const buffer = 30;

      switch(edge) {
        case 0: // Top
          x = Math.random() * width;
          y = -buffer;
          angle = Math.PI / 2;
          break;
        case 1: // Right
          x = width + buffer;
          y = Math.random() * height;
          angle = Math.PI;
          break;
        case 2: // Bottom
          x = Math.random() * width;
          y = height + buffer;
          angle = -Math.PI / 2;
          break;
        case 3: // Left
          x = -buffer;
          y = Math.random() * height;
          angle = 0;
          break;
      }

      // Add randomness to angle to point somewhat towards center
      const angleToCenter = Math.atan2((height/2) - y, (width/2) - x);
      angle = angleToCenter + (Math.random() - 0.5) * 0.5;

      const type = Math.random() > 0.5 ? PlaneType.RED : PlaneType.BLUE;

      planesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x,
        y,
        angle,
        speed: PLANE_SPEED,
        type,
        path: [],
        isSelected: false,
        state: 'FLYING',
        landingProgress: 0,
      });

      lastSpawnTime.current = currentTime;
      // Increase difficulty
      spawnRate.current = Math.max(SPAWN_RATE_MIN, spawnRate.current - 10);
    }
  };

  // Main Game Loop
  const loop = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING || isPausedRef.current) {
      requestRef.current = requestAnimationFrame(loop);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    // 1. Clear
    ctx.fillStyle = '#1e293b'; // Slate 800 background
    ctx.fillRect(0, 0, width, height);

    // Draw Grid (Decoration)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<width; i+=50) { ctx.moveTo(i,0); ctx.lineTo(i,height); }
    for(let i=0; i<height; i+=50) { ctx.moveTo(0,i); ctx.lineTo(width,i); }
    ctx.stroke();

    // 2. Spawn
    spawnPlane(time, width, height);

    // 3. Draw Runways
    runwaysRef.current.forEach(runway => {
      ctx.save();
      ctx.translate(runway.x, runway.y);
      ctx.rotate(runway.angle);
      
      // Runway body
      ctx.fillStyle = '#475569';
      ctx.fillRect(-runway.width/2, -runway.height/2, runway.width, runway.height);
      
      // Markings
      ctx.strokeStyle = COLORS[runway.type];
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, -runway.height/2 + 10);
      ctx.lineTo(0, runway.height/2 - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // Threshold highlight
      ctx.fillStyle = COLORS[runway.type];
      ctx.globalAlpha = 0.3;
      // For runway 1 (Red, angle 0), entry is at local y = runway.height/2.
      // For runway 2 (Blue, angle PI), entry is at local y = -runway.height/2.
      // We want to highlight the entry end.
      const entryHighlightY = runway.type === PlaneType.RED ? runway.height/2 - 20 : -runway.height/2;
      ctx.fillRect(-runway.width/2, entryHighlightY, runway.width, 20);
      ctx.globalAlpha = 1; // Reset alpha
      
      ctx.restore();
    });

    // 4. Update & Draw Planes
    // Filter out landed or crashed planes effectively for next frame
    const activePlanes = [];

    for (const plane of planesRef.current) {
      if (plane.state === 'CRASHED' || plane.state === 'LANDED') continue;

      // Logic: Movement
      if (plane.state === 'FLYING') {
        if (plane.path.length > 0) {
          const target = plane.path[0];
          const dx = target.x - plane.x;
          const dy = target.y - plane.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist < 5) { // Reached point, small threshold
            plane.path.shift(); 
          } else {
            // Turn towards target
            const targetAngle = Math.atan2(dy, dx);
            // Smooth turning
            let diff = targetAngle - plane.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            plane.angle += diff * 0.1; 
          }
        }
        
        // Move
        plane.x += Math.cos(plane.angle) * plane.speed;
        plane.y += Math.sin(plane.angle) * plane.speed;

        // Check Landing Trigger
        for (const runway of runwaysRef.current) {
          if (plane.type !== runway.type) continue;
          
          // Distance to entry point
          const distToEntry = Math.hypot(plane.x - runway.entryPoint.x, plane.y - runway.entryPoint.y);
          if (distToEntry < 20 && plane.state === 'FLYING') {
            // Check alignment (angle diff should be small)
            // The approach angle should be the runway's angle (if coming from the "front" relative to rotation)
            // For Red runway (angle 0, entry bottom), plane angle should be Math.PI/2 (upwards)
            // For Blue runway (angle PI, entry top), plane angle should be -Math.PI/2 (downwards)
            let requiredAngle;
            if (runway.type === PlaneType.RED) { // Red runway (angle 0), entry from bottom means plane needs to fly up (+Y)
              requiredAngle = Math.PI / 2; // Pointing upwards
            } else { // Blue runway (angle PI), entry from top means plane needs to fly down (-Y)
              requiredAngle = -Math.PI / 2; // Pointing downwards
            }

            let angleDiff = Math.abs(plane.angle - requiredAngle);
            while (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            
            if (angleDiff < 0.2) { // Within 0.2 radians (approx 11 degrees)
              plane.state = 'LANDING';
              plane.landingProgress = 0;
              plane.path = []; // Clear path once landing
              playSound(landSound, 0.5); // Play land sound
            }
          }
        }
      } else if (plane.state === 'LANDING') {
        // Move plane along runway
        // Find the runway it's landing on, by type and proximity to an entry point
        const runway = runwaysRef.current.find(r => 
          r.type === plane.type && 
          Math.hypot(plane.x - r.entryPoint.x, plane.y - r.entryPoint.y) < 50
        );
        if (runway) {
          // Calculate target point along the runway center line
          const runwayLength = runway.height;
          // Determine starting point on the runway
          let startX, startY;
          let landingDirectionAngle;

          if (runway.type === PlaneType.RED) { // Red runway, angle 0, entry from bottom
            startX = runway.x;
            startY = runway.y + runwayLength / 2;
            landingDirectionAngle = -Math.PI / 2; // Fly towards negative Y
          } else { // Blue runway, angle PI, entry from top
            startX = runway.x;
            startY = runway.y - runwayLength / 2;
            landingDirectionAngle = Math.PI / 2; // Fly towards positive Y
          }

          // Progress the plane along the runway from its entry point
          plane.x += Math.cos(landingDirectionAngle) * LANDING_SPEED;
          plane.y += Math.sin(landingDirectionAngle) * LANDING_SPEED;
          plane.angle = landingDirectionAngle; // Keep aligned with runway

          plane.landingProgress += LANDING_SPEED / runwayLength / 60; // Increment based on speed and frame rate (assuming 60fps)

          if (plane.landingProgress >= 1) {
            plane.state = 'LANDED';
            scoreRef.current += 100;
            setScore(scoreRef.current);
          }
        } else {
          // Lost runway, something went wrong, might crash
          plane.state = 'CRASHED';
          explosionsRef.current.push({ id: Math.random().toString(36).substr(2, 9), x: plane.x, y: plane.y, radius: 0, opacity: 1 });
          playSound(crashSound, 0.7);
          livesRef.current--;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            setGameState(GameState.GAME_OVER);
          }
        }
      }

      // Logic: Collisions (only for flying planes)
      if (plane.state === 'FLYING') {
        for (const otherPlane of planesRef.current) {
          if (plane.id === otherPlane.id || otherPlane.state !== 'FLYING') continue;

          const dist = Math.hypot(plane.x - otherPlane.x, plane.y - otherPlane.y);
          if (dist < COLLISION_RADIUS * 2) {
            // Collision!
            plane.state = 'CRASHED';
            otherPlane.state = 'CRASHED';
            explosionsRef.current.push({ id: Math.random().toString(36).substr(2, 9), x: plane.x, y: plane.y, radius: 0, opacity: 1 });
            explosionsRef.current.push({ id: Math.random().toString(36).substr(2, 9), x: otherPlane.x, y: otherPlane.y, radius: 0, opacity: 1 });
            playSound(crashSound, 0.7);
            livesRef.current -= 1; // Each collision costs 1 life
            setLives(livesRef.current);
            if (livesRef.current <= 0) {
              setGameState(GameState.GAME_OVER);
            }
          }
        }
      }

      // Logic: Out of Bounds
      if (plane.x < -100 || plane.x > width + 100 || plane.y < -100 || plane.y > height + 100) {
        // Plane flew off screen without landing, consider it a crash (lost life)
        if (plane.state !== 'LANDED' && plane.state !== 'CRASHED') {
          plane.state = 'CRASHED';
          livesRef.current--;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            setGameState(GameState.GAME_OVER);
          }
        }
      }

      activePlanes.push(plane);

      // Draw Plane
      ctx.save();
      ctx.translate(plane.x, plane.y);
      ctx.rotate(plane.angle);

      // Body
      ctx.fillStyle = COLORS[plane.type];
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-15, -10);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-15, 10);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(5, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      if (plane.isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-20, -15, 40, 30); // Simple bounding box for selection
      }
      ctx.restore();

      // Draw Path
      if (plane.path.length > 0) {
        ctx.beginPath();
        ctx.moveTo(plane.x, plane.y);
        plane.path.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = plane.isSelected ? '#fff' : COLORS[plane.type];
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    planesRef.current = activePlanes; // Update planes array, removing landed/crashed ones

    // 5. Update & Draw Explosions
    explosionsRef.current = explosionsRef.current.map(exp => {
      exp.radius += 1;
      exp.opacity -= 0.02;
      return exp;
    }).filter(exp => exp.opacity > 0);

    explosionsRef.current.forEach(exp => {
      ctx.fillStyle = `rgba(255, 69, 0, ${exp.opacity})`; // Orange red
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Request next frame
    requestRef.current = requestAnimationFrame(loop);
  }, [gameState, setScore, setLives, setGameState]); // Dependencies

  // Effect for game loop
  useEffect(() => {
    if (gameState === GameState.PLAYING && !isPausedRef.current) {
      requestRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(requestRef.current!);
    }
    return () => cancelAnimationFrame(requestRef.current!);
  }, [gameState, loop]);

  // Effect for canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (gameState === GameState.PLAYING || gameState === GameState.MENU) {
        setupRunways(canvas); // Re-setup runways on resize
      }
    };

    resizeCanvas(); // Initial resize
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [gameState, setupRunways]);

  // Touch/Mouse handlers
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== GameState.PLAYING || isPausedRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = event.clientX - rect.left;
    const touchY = event.clientY - rect.top;

    const clickedPlane = planesRef.current.find(plane => 
      Math.hypot(plane.x - touchX, plane.y - touchY) < COLLISION_RADIUS && plane.state === 'FLYING'
    );

    if (clickedPlane) {
      // Deselect all others
      planesRef.current.forEach(p => p.isSelected = false);
      clickedPlane.isSelected = true;
      activePlaneId.current = clickedPlane.id;
      currentPath.current = [{ x: touchX, y: touchY }];
      playSound(selectSound, 0.5);
    } else if (activePlaneId.current) {
      // If a plane is selected, add point to its path
      currentPath.current.push({ x: touchX, y: touchY });
    }
  }, [gameState]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== GameState.PLAYING || isPausedRef.current || !activePlaneId.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = event.clientX - rect.left;
    const touchY = event.clientY - rect.top;

    if (currentPath.current.length > 0) {
      const lastPoint = currentPath.current[currentPath.current.length - 1];
      if (Math.hypot(lastPoint.x - touchX, lastPoint.y - touchY) > 15) { // Only add if far enough
        currentPath.current.push({ x: touchX, y: touchY });
      }
    }
  }, [gameState]);

  const handlePointerUp = useCallback(() => {
    if (gameState !== GameState.PLAYING || isPausedRef.current || !activePlaneId.current) return;

    const selectedPlane = planesRef.current.find(p => p.id === activePlaneId.current);
    if (selectedPlane) {
      selectedPlane.path = currentPath.current;
      selectedPlane.isSelected = false; // Deselect after path is set
    }
    activePlaneId.current = null;
    currentPath.current = [];
  }, [gameState]);

  const handlePauseToggle = useCallback(() => {
    isPausedRef.current = !isPausedRef.current;
    if (isPausedRef.current) {
      cancelAnimationFrame(requestRef.current!);
    } else if (gameState === GameState.PLAYING) {
      requestRef.current = requestAnimationFrame(loop);
    }
  }, [gameState, loop]);

  const handleRestartGame = useCallback(() => {
    if (scoreRef.current > highScore) {
      localStorage.setItem(HIGH_SCORE_KEY, scoreRef.current.toString());
      setHighScore(scoreRef.current);
    }
    initGame();
    setGameState(GameState.PLAYING);
  }, [initGame, highScore, scoreRef]);

  const handleStartGame = useCallback(() => {
    initGame();
    setGameState(GameState.PLAYING);
  }, [initGame]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-800 text-white font-mono">
      <canvas
        ref={canvasRef}
        className="block"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp} // Treat leaving canvas as pointer up
      />

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70">
          <h1 className="text-6xl font-bold mb-8 text-indigo-400">Sky Guide</h1>
          <button
            onClick={handleStartGame}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-2xl rounded-lg shadow-lg flex items-center gap-2"
          >
            <Play size={28} /> Start Game
          </button>
          <div className="mt-8 text-xl">High Score: {highScore}</div>
        </div>
      )}

      {gameState === GameState.PLAYING && (
        <>
          <div className="absolute top-4 left-4 text-xl">Score: {score}</div>
          <div className="absolute top-4 right-4 text-xl">Lives: {lives}</div>
          <div className="absolute bottom-4 left-4 flex gap-4">
            <button
              onClick={handlePauseToggle}
              className="p-3 bg-slate-700 hover:bg-slate-600 rounded-full shadow-md"
            >
              {isPausedRef.current ? <Play size={24} /> : <Pause size={24} />}
            </button>
          </div>
        </>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70">
          <h2 className="text-5xl font-bold mb-4 text-red-400">Game Over!</h2>
          <p className="text-3xl mb-4">Final Score: {score}</p>
          <p className="text-2xl mb-8 flex items-center gap-2">
            <Trophy size={28} /> High Score: {Math.max(score, highScore)}
          </p>
          <button
            onClick={handleRestartGame}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-2xl rounded-lg shadow-lg flex items-center gap-2"
          >
            <RotateCcw size={28} /> Play Again
          </button>
        </div>
      )}
    </div>
  );
};

export default App;