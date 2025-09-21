import React, { useState, useRef, useEffect } from "react";

export default function App() {
  const [ballPos, setBallPos] = useState({ x: 175, y: 450 });
  const [isDragging, setIsDragging] = useState(false);
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null); // inicio del arrastre
  const [goals, setGoals] = useState(0);
  const [speed, setSpeed] = useState(3);

  const fieldRef = useRef(null);

  const [obstaculos, setObstaculos] = useState([
    { x: 80, y: 250, width: 60, height: 20, dir: 1 },
    { x: 220, y: 350, width: 60, height: 20, dir: -1 },
  ]);

  const arco = { x: 125, y: 40, width: 150, height: 30 };

  // Cuando inicia el arrastre
  const startDrag = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Cuando suelta: calcular fuerza y dirección
  const stopDrag = (e) => {
    if (isDragging && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      setVelocity({ x: dx / 5, y: dy / 5 }); // divide para ajustar fuerza
    }
    setIsDragging(false);
    setDragStart(null);
  };

  // Movimiento de la pelota
  useEffect(() => {
    let anim;
    const moveBall = () => {
      if (!isDragging) {
        setBallPos((prev) => {
          const newPos = {
            x: prev.x + velocity.x,
            y: prev.y + velocity.y,
          };

          // Verificar colisión con obstáculos
          for (let obs of obstaculos) {
            if (
              newPos.x + 50 > obs.x &&
              newPos.x < obs.x + obs.width &&
              newPos.y + 50 > obs.y &&
              newPos.y < obs.y + obs.height
            ) {
              // 🚫 Choque → reinicia
              setVelocity({ x: 0, y: 0 });
              setGoals(0);
              setSpeed(3);
              return { x: 175, y: 450 };
            }
          }

          return newPos;
        });

        setVelocity((prev) => ({
          x: prev.x * 0.95,
          y: prev.y * 0.95,
        }));

        // Revisar si entra en el arco
        if (
          ballPos.x + 25 > arco.x &&
          ballPos.x + 25 < arco.x + arco.width &&
          ballPos.y < arco.y + arco.height
        ) {
          setGoals((g) => g + 1);
          setSpeed((s) => s + 0.5);
          setBallPos({ x: 175, y: 450 });
          setVelocity({ x: 0, y: 0 });
        }

        // Reset si sale del campo
        if (
          ballPos.y < 0 ||
          ballPos.y > 600 ||
          ballPos.x < 0 ||
          ballPos.x > 400
        ) {
          setBallPos({ x: 175, y: 450 });
          setVelocity({ x: 0, y: 0 });
        }
      }
      anim = requestAnimationFrame(moveBall);
    };
    anim = requestAnimationFrame(moveBall);
    return () => cancelAnimationFrame(anim);
  }, [isDragging, velocity, ballPos, obstaculos]);

  // Movimiento de los obstáculos
  useEffect(() => {
    const interval = setInterval(() => {
      setObstaculos((prev) =>
        prev.map((obs) => {
          let newX = obs.x + obs.dir * speed;
          let newDir = obs.dir;

          if (newX <= 0 || newX + obs.width >= 400) {
            newDir *= -1;
          }

          return { ...obs, x: newX, dir: newDir };
        })
      );
    }, 30);

    return () => clearInterval(interval);
  }, [speed]);

  return (
    <div
      ref={fieldRef}
      onMouseUp={stopDrag}
      style={styles.field}
    >
      <h1 style={{ color: "white" }}>⚽ Juego de Penaltis</h1>
      <h2 style={{ color: "yellow" }}>Goles: {goals}</h2>
      <h3 style={{ color: "orange" }}>Velocidad Obstáculos: {speed.toFixed(1)}</h3>

      {/* Arco */}
      <div
        style={{
          position: "absolute",
          top: arco.y,
          left: arco.x,
          width: arco.width,
          height: arco.height,
          backgroundColor: "rgba(255,255,255,0.5)",
          border: "2px solid black",
          borderRadius: "10px",
        }}
      ></div>

      {/* Obstáculos */}
      {obstaculos.map((obs, i) => (
        <div
          key={i}
          style={{
            ...styles.obstaculo,
            top: obs.y,
            left: obs.x,
            width: obs.width,
            height: obs.height,
          }}
        />
      ))}

      {/* Balón */}
      <div
        onMouseDown={startDrag}
        style={{
          ...styles.ball,
          top: ballPos.y,
          left: ballPos.x,
        }}
      />
    </div>
  );
}

const styles = {
  field: {
    position: "relative",
    width: "400px",
    height: "600px",
    backgroundColor: "#4CAF50",
    margin: "20px auto",
    border: "3px solid white",
    borderRadius: "10px",
    overflow: "hidden",
    userSelect: "none",
  },
  obstaculo: {
    position: "absolute",
    backgroundColor: "red",
    borderRadius: "5px",
  },
  ball: {
    position: "absolute",
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    background: "radial-gradient(circle, white 70%, black 30%)",
    cursor: "grab",
  },
};
