import React, { useEffect, useRef, useState } from 'react';

// Which grid cells (0–8 in a 3×3) are pips for each face value
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Rotation applied to the cube so that each face value faces the camera.
// Face layout: front=1, right=2, bottom=3, top=4, left=5, back=6
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0,   y: 0   }, // front
  2: { x: 0,   y: -90 }, // right  → rotate cube −90° on Y
  3: { x: -90, y: 0   }, // bottom → tilt cube −90° on X
  4: { x: 90,  y: 0   }, // top    → tilt cube +90° on X
  5: { x: 0,   y: 90  }, // left   → rotate cube +90° on Y
  6: { x: 0,   y: 180 }, // back
};

// CSS transform that places each face on the cube (100px side, 50px half-depth)
const FACE_TRANSFORMS: Record<string, string> = {
  front:  'translateZ(50px)',
  back:   'rotateY(180deg) translateZ(50px)',
  right:  'rotateY(90deg) translateZ(50px)',
  left:   'rotateY(-90deg) translateZ(50px)',
  top:    'rotateX(-90deg) translateZ(50px)',
  bottom: 'rotateX(90deg) translateZ(50px)',
};

// Which face-name shows which number
const FACE_VALUES: Record<string, number> = {
  front: 1, back: 6, right: 2, left: 5, top: 4, bottom: 3,
};

// Subtle shading so the cube reads as 3D when stationary
const FACE_BG: Record<string, string> = {
  front:  '#ffffff',
  back:   '#e8e8e8',
  right:  '#f0f0f0',
  left:   '#ececec',
  top:    '#f8f8f8',
  bottom: '#e0e0e0',
};

interface DieProps {
  value: number;
  rollKey: number;
  delay?: number; // stagger offset in ms
}

const Die: React.FC<DieProps> = ({ value, rollKey, delay = 0 }) => {
  // Accumulated rotation — keeps growing so transitions are always forward
  const accX = useRef(0);
  const accY = useRef(0);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (rollKey === 0) return;

    const face = FACE_ROTATIONS[value];
    const spins = 4 + Math.floor(Math.random() * 3); // 4–6 full rotations

    // Shortest-path delta from current angle to target face angle
    const normX = ((accX.current % 360) + 360) % 360;
    const normY = ((accY.current % 360) + 360) % 360;
    const faceX = ((face.x % 360) + 360) % 360;
    const faceY = ((face.y % 360) + 360) % 360;
    const deltaX = (faceX - normX + 360) % 360;
    const deltaY = (faceY - normY + 360) % 360;

    const t = setTimeout(() => {
      accX.current += spins * 360 + deltaX;
      accY.current += spins * 360 + deltaY;
      setTransitioning(true);
      setRot({ x: accX.current, y: accY.current });
    }, delay);

    return () => clearTimeout(t);
  }, [rollKey, value, delay]);

  return (
    <div
      style={{
        perspective: '600px',
        width: 100,
        height: 100,
        // Shadow under the die, gives a floating-on-felt look
        filter: 'drop-shadow(0 16px 12px rgba(0,0,0,0.5))',
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          // easeOutExpo: blazes fast, decelerates hard — looks like a real tumbling die
          transition: transitioning
            ? 'transform 2s cubic-bezier(0.22, 1, 0.36, 1)'
            : 'none',
        }}
      >
        {Object.entries(FACE_TRANSFORMS).map(([faceName, faceTransform]) => {
          const faceValue = FACE_VALUES[faceName];
          const pipCells = PIPS[faceValue];

          return (
            <div
              key={faceName}
              style={{
                position: 'absolute',
                width: 100,
                height: 100,
                transform: faceTransform,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(3, 1fr)',
                padding: 11,
                gap: 4,
                boxSizing: 'border-box',
                borderRadius: 14,
                background: FACE_BG[faceName],
                border: '2px solid #d1d5db',
                backfaceVisibility: 'hidden',
              }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: '50%',
                    background: pipCells.includes(i) ? '#1e293b' : 'transparent',
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Die;
