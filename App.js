import { GoogleGenAI } from "@google/genai";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Pause, Trophy } from 'lucide-react';
import { PlaneType, GameState } from './types.js'; // Ensure .js extension for types
import { COLORS, PLANE_SPEED, LANDING_SPEED, COLLISION_RADIUS, SPAWN_RATE_INITIAL, SPAWN_RATE_MIN } from './constants.js'; // Ensure .js extension
import { playSound, selectSound, landSound, crashSound } from './sounds.js'; // Ensure .js extension

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const HIGH_SCORE_KEY = 'sky-guide-high-score';

const App = () => {
  const [gameState, setGameState] = useState(GameState.MENU);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(2);
  const [highScore, setHighScore] = useState(0);
  
  const canvasRef = useRef(null);
  const requestRef = useRef(undefined); // Corrected to match TS type for useRef
  const planesRef = useRef([]);
  const explosionsRef = useRef([]);
  const lastSpawnTime = useRef(0);
  const spawnRate = useRef(SPAWN_RATE_INITIAL);
  const runwaysRef = useRef([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(2);
  const isPausedRef = useRef(false);
  
  const activePlaneId = useRef(null);
  const currentPath = useRef([]);

  useEffect(() => {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

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
    
    if (canvasRef.current) {
      setupRunways(canvasRef.current);
    }
  }, []);

  const setupRunways = (canvas) => {
    const { width, height } = canvas;
    
    const cx = width / 2;
    const cy = height / 2;
    
    runwaysRef.current = [
      {
        id: 'r1',
        x: cx - 80,
        y: cy,
        width: 40,
        height: 180,
        angle: 0,
        entryPoint: { x: cx - 80, y: cy + 90 },
        type: PlaneType.RED, 
      },
      {
        id: 'r2',
        x: cx + 80,
        y: cy,
        width: 40,
        height: 180,
        angle: Math.PI,
        entryPoint: { x: cx + 80, y: cy - 90 },
        type: PlaneType.BLUE,
      }
    ];
  };

  const spawnPlane = (currentTime, width, height) => {
    if (currentTime - lastSpawnTime.current > spawnRate.current) {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0, angle = 0;
      const buffer = 30;

      switch(edge) {
        case 0:
          x = Math.random() * width;
          y = -buffer;
          angle = Math.PI / 2;
          break;
        case 1:
          x = width + buffer;
          y = Math.random() * height;
          angle = Math.PI;
          break;
        case 2:
          x = Math.random() * width;
          y = height + buffer;
          angle = -Math.PI / 2;
          break;
        case 3:
          x = -buffer;
          y = Math.random() * height;
          angle = 0;
          break;
      }

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
      spawnRate.current = Math.max(SPAWN_RATE_MIN, spawnRate.current - 10);
    }
  };

  const loop = useCallback((time) => {
    if (gameState !== GameState.PLAYING || isPausedRef.current) {
      requestRef.current = requestAnimationFrame(loop);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<width; i+=50) { ctx.moveTo(i,0); ctx.lineTo(i,height); }
    for(let i=0; i<height; i+=50) { ctx.moveTo(0,i); ctx.lineTo(width,i); }
    ctx.stroke();

    spawnPlane(time, width, height);

    runwaysRef.current.forEach(runway => {
      ctx.save();
      ctx.translate(runway.x, runway.y);
      ctx.rotate(runway.angle);
      
      ctx.fillStyle = '#475569';
      ctx.fillRect(-runway.width/2, -runway.height/2, runway.width, runway.height);
      
      ctx.strokeStyle = COLORS[runway.type];
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, -runway.height/2 + 10);
      ctx.lineTo(0, runway.height/2 - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS[runway.type];
      ctx.globalAlpha = 0.3;
      const entryHighlightY = runway.type === PlaneType.RED ? runway.height/2 - 20 : -runway.height/2;
      ctx.fillRect(-runway.width/2, entryHighlightY, runway.width, 20);
      ctx.globalAlpha = 1;
      
      ctx.restore();
    });

    const planesCrashedInThisFrame = new Set();

    const activePlanes = [];

    for (const plane of planesRef.current) {
      if (plane.state === 'CRASHED' || plane.state === 'LANDED') continue;

      if (plane.state === 'FLYING') {
        if (plane.path.length > 0) {
          const target = plane.path[0];
          const dx = target.x - plane.x;
          const dy = target.y - plane.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist < 5) {
            plane.path.shift(); 
          } else {
            const targetAngle = Math.atan2(dy, dx);
            let diff = targetAngle - plane.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            plane.angle += diff * 0.1; 
          }
        }
        
        plane.x += Math.cos(plane.angle) * plane.speed;
        plane.y += Math.sin(plane.angle) * plane.speed;

        for (const runway of runwaysRef.current) {
          if (plane.type !== runway.type) continue;
          
          const distToEntry = Math.hypot(plane.x - runway.entryPoint.x, plane.y - runway.entryPoint.y);
          if (distToEntry < 20 && plane.state === 'FLYING') {
            let requiredAngle;
            if (runway.type === PlaneType.RED) {
              requiredAngle = -Math.PI / 2;
            } else {
              requiredAngle = Math.PI / 2;
            }

            let angleDiff = Math.abs(plane.angle - requiredAngle);
            while (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            
            if (angleDiff < 0.2) {
              plane.state = 'LANDING';
              plane.landingProgress = 0;
              plane.path = [];
            }
          }
        }
      } else if (plane.state === 'LANDING') {
        const runway = runwaysRef.current.find(r => r.type === plane.type);
        if (runway) {
          let landingDirectionAngle;

          if (runway.type === PlaneType.RED) {
            landingDirectionAngle = -Math.PI / 2;
          } else {
            landingDirectionAngle = Math.PI / 2;
          }

          plane.x += Math.cos(landingDirectionAngle) * LANDING_SPEED;
          plane.y += Math.sin(landingDirectionAngle) * LANDING_SPEED;
          plane.angle = landingDirectionAngle;

          const landingDurationFrames = 60 * 2;
          plane.landingProgress += (1 / landingDurationFrames); 

          if (plane.landingProgress >= 1) {
            plane.state = 'LANDED';
            scoreRef.current += 100;
            setScore(scoreRef.current);
            playSound(landSound, 0.5);
          }
        } else {
          plane.state = 'CRASHED';
          explosionsRef.current.push({ id: Math.random().toString(36).substr(2, 9), x: plane.x, y: plane.y, radius: 0, opacity: 1 });
          playSound(crashSound, 0.7);
          planesCrashedInThisFrame.add(plane.id);
        }
      }

      activePlanes.push(plane);
    }
    
    for (let i = 0; i < activePlanes.length; i++) {
        for (let j = i + 1; j < activePlanes.length; j++) {
            const p1 = activePlanes[i];
            const p2 = activePlanes[j];
            
            if (p1.state === 'FLYING' && p2.state === 'FLYING') {
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist < COLLISION_RADIUS * 2) {
                    p1.state = 'CRASHED';
                    p2.state = 'CRASHED';
                    
                    planesCrashedInThisFrame.add(p1.id);
                    planesCrashedInThisFrame.add(p2.id);

                    explosionsRef.current.push(
                        { id: p1.id, x: p1.x, y: p1.y, radius: 10, opacity: 1 },
                        { id: p2.id, x: p2.x, y: p2.y, radius: 10, opacity: 1 }
                    );
                    playSound(crashSound, 0.5);
                }
            }
        }
    }

    if (planesCrashedInThisFrame.size > 0) {
        livesRef.current -= 1;
        setLives(livesRef.current);
        if (livesRef.current <= 0) {
            endGame();
        }
    }

    planesRef.current.forEach(plane => {
        if (plane.state === 'FLYING' && plane.path.length === 0) {
            const margin = 100;
            if (plane.x < -margin || plane.x > width + margin || plane.y < -margin || plane.y > height + margin) {
                if (!planesCrashedInThisFrame.has(plane.id)) {
                  plane.state = 'CRASHED';
                  explosionsRef.current.push({ id: plane.id, x: plane.x, y: plane.y, radius: 10, opacity: 1 });
                  playSound(crashSound, 0.5);
                  planesCrashedInThisFrame.add(plane.id);
                }
            }
        }
    });

    if (planesCrashedInThisFrame.size > 0 && livesRef.current > 0) {
    }

    planesRef.current = activePlanes;

    for (const plane of planesRef.current) {
        ctx.save();
        ctx.translate(plane.x, plane.y);
        ctx.rotate(plane.angle);

        ctx.fillStyle = COLORS[plane.type];
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-15, -10);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-15, 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(5, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        if (plane.isSelected) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(-20, -15, 40, 30);
        }
        ctx.restore();

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


    explosionsRef.current = explosionsRef.current.map(exp => {
      exp.radius += 1;
      exp.opacity -= 0.02;
      return exp;
    }).filter(exp => exp.opacity > 0);

    explosionsRef.current.forEach(exp => {
      ctx.fillStyle = `rgba(255, 69, 0, ${exp.opacity})`;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    if (activePlaneId.current && currentPath.current.length > 0) {
        ctx.beginPath();
        const p = planesRef.current.find(pl => pl.id === activePlaneId.current);
        if (p) {
            ctx.moveTo(p.x, p.y);
            currentPath.current.forEach(point => {
                ctx.lineTo(point.x, point.y);
            });
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    requestRef.current = requestAnimationFrame(loop);
  }, [gameState, setScore, setLives, setGameState]);

  const endGame = useCallback(() => {
    setGameState(GameState.GAME_OVER);
    const finalScore = scoreRef.current;
    setHighScore(prev => {
        const newHigh = Math.max(prev, finalScore);
        localStorage.setItem(HIGH_SCORE_KEY, newHigh.toString());
        return newHigh;
    });
  }, [scoreRef, setHighScore]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && !isPausedRef.current) {
      requestRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, loop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (gameState === GameState.PLAYING || gameState === GameState.MENU) {
        setupRunways(canvas);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [gameState, setupRunways]);

  const handlePointerDown = useCallback((event) => {
    if (gameState !== GameState.PLAYING || isPausedRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = event.clientX - rect.left;
    const touchY = event.clientY - rect.top;

    const clickedPlane = planesRef.current.find(plane => 
      Math.hypot(plane.x - touchX, plane.y - touchY) < COLLISION_RADIUS && plane.state === 'FLYING'
    );

    if (activePlaneId.current) {
      const prevActivePlane = planesRef.current.find(p => p.id === activePlaneId.current);
      if (prevActivePlane) {
        prevActivePlane.path = [...currentPath.current];
        prevActivePlane.isSelected = false;
      }
      activePlaneId.current = null;
      currentPath.current = [];
    }

    if (clickedPlane) {
      clickedPlane.isSelected = true;
      activePlaneId.current = clickedPlane.id;
      currentPath.current = [{ x: touchX, y: touchY }];
      playSound(selectSound, 0.5);
    }
  }, [gameState]);

  const handlePointerMove = useCallback((event) => {
    if (gameState !== GameState.PLAYING || isPausedRef.current || !activePlaneId.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = event.clientX - rect.left;
    const touchY = event.clientY - rect.top;

    if (currentPath.current.length > 0) {
      const lastPoint = currentPath.current[currentPath.current.length - 1];
      if (Math.hypot(lastPoint.x - touchX, lastPoint.y - touchY) > 15) {
        currentPath.current.push({ x: touchX, y: touchY });
      }
    }
  }, [gameState]);

  const handlePointerUp = useCallback(() => {
    if (gameState !== GameState.PLAYING || isPausedRef.current || !activePlaneId.current) return;

    const selectedPlane = planesRef.current.find(p => p.id === activePlaneId.current);
    if (selectedPlane) {
      selectedPlane.path = currentPath.current;
      selectedPlane.isSelected = false;
    }
    activePlaneId.current = null;
    currentPath.current = [];
  }, [gameState]);

  const handlePauseToggle = useCallback(() => {
    isPausedRef.current = !isPausedRef.current;
    if (isPausedRef.current) {
      cancelAnimationFrame(requestRef.current);
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
    React.createElement(
      "div",
      { className: "relative w-screen h-screen overflow-hidden bg-slate-800 text-white font-mono" },
      React.createElement("canvas", {
        ref: canvasRef,
        className: "block",
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerUp
      }),
      gameState === GameState.MENU &&
        React.createElement(
          "div",
          { className: "absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70" },
          React.createElement(
            "h1",
            { className: "text-6xl font-bold mb-8 text-indigo-400" },
            "Sky Guide"
          ),
          React.createElement(
            "button",
            {
              onClick: handleStartGame,
              className: "px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-2xl rounded-lg shadow-lg flex items-center gap-2"
            },
            React.createElement(Play, { size: 28 }),
            " Start Game"
          ),
          React.createElement(
            "div",
            { className: "mt-8 text-xl" },
            "High Score: ",
            highScore
          )
        ),
      gameState === GameState.PLAYING &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "div",
            { className: "absolute top-4 left-4 text-xl" },
            "Score: ",
            score
          ),
          React.createElement(
            "div",
            { className: "absolute top-4 right-4 text-xl" },
            "Lives: ",
            lives
          ),
          React.createElement(
            "div",
            { className: "absolute bottom-4 left-4 flex gap-4" },
            React.createElement(
              "button",
              {
                onClick: handlePauseToggle,
                className: "p-3 bg-slate-700 hover:bg-slate-600 rounded-full shadow-md"
              },
              isPausedRef.current ? React.createElement(Play, { size: 24 }) : React.createElement(Pause, { size: 24 })
            )
          )
        ),
      gameState === GameState.GAME_OVER &&
        React.createElement(
          "div",
          { className: "absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70" },
          React.createElement(
            "h2",
            { className: "text-5xl font-bold mb-4 text-red-400" },
            "Game Over!"
          ),
          React.createElement(
            "p",
            { className: "text-3xl mb-4" },
            "Final Score: ",
            score
          ),
          React.createElement(
            "p",
            { className: "text-2xl mb-8 flex items-center gap-2" },
            React.createElement(Trophy, { size: 28 }),
            " High Score: ",
            Math.max(score, highScore)
          ),
          React.createElement(
            "button",
            {
              onClick: handleRestartGame,
              className: "px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-2xl rounded-lg shadow-lg flex items-center gap-2"
            },
            React.createElement(RotateCcw, { size: 28 }),
            " Play Again"
          )
        )
    )
  );
};

export default App;