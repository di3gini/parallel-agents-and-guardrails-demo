#!/usr/bin/env node
"use strict";

// Imprime las métricas de la corrida del orquestador: tiempo de cada agente,
// tiempo real de la fase paralela, y cuánto habría tardado en secuencial
// (suma de los tiempos individuales medidos por separado).

const fs = require("fs");
const path = require("path");

const PROJECT_DIR = path.resolve(__dirname, "..");
const RUN_DIR = path.join(PROJECT_DIR, "reports", ".run");

const PARALLEL_AGENTS = ["security-agent", "performance-agent", "quality-agent"];

const parallelMs = Number(process.argv[2] || 0);
const consolidatorMs = Number(process.argv[3] || 0);

function readAgent(agent) {
  const wallPath = path.join(RUN_DIR, `${agent}.wall_ms`);
  const jsonPath = path.join(RUN_DIR, `${agent}.json`);
  const wallMs = fs.existsSync(wallPath)
    ? Number(fs.readFileSync(wallPath, "utf8").trim())
    : null;

  let selfMs = null;
  let turns = null;
  let costUsd = null;
  let isError = null;
  if (fs.existsSync(jsonPath)) {
    try {
      const d = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      selfMs = d.duration_ms ?? null;
      turns = d.num_turns ?? null;
      costUsd = d.total_cost_usd ?? null;
      isError = d.is_error ?? null;
    } catch {
      /* deja los campos en null: el JSON no se pudo parsear */
    }
  }
  return { agent, wallMs, selfMs, turns, costUsd, isError };
}

const s = (ms) => (ms == null ? "?" : (ms / 1000).toFixed(1) + "s");
const pad = (v, n) => String(v).padEnd(n);

const rows = PARALLEL_AGENTS.map(readAgent);
const consolidator = readAgent("consolidator-agent");

console.log("==============================================");
console.log(" Métricas");
console.log("==============================================");
console.log(pad("agente", 20) + pad("wall", 9) + pad("interno", 9) + pad("turnos", 8) + "costo USD");
for (const r of [...rows, consolidator]) {
  console.log(
    pad(r.agent, 20) +
      pad(s(r.wallMs), 9) +
      pad(s(r.selfMs), 9) +
      pad(r.turns ?? "?", 8) +
      (r.costUsd == null ? "?" : r.costUsd.toFixed(4))
  );
}

const sumWall = rows.reduce((acc, r) => acc + (r.wallMs || 0), 0);
const costs = [...rows, consolidator]
  .map((r) => r.costUsd)
  .filter((c) => typeof c === "number");
const totalCost = costs.reduce((a, b) => a + b, 0);

console.log();
console.log("--- Paralelo vs. secuencial (los 3 agentes de análisis) ---");
console.log(`  Suma de tiempos individuales (secuencial): ${s(sumWall)}`);
console.log(`  Tiempo real de la fase paralela:          ${s(parallelMs)}`);

if (parallelMs > 0 && sumWall > 0) {
  const saved = sumWall - parallelMs;
  const speedup = sumWall / parallelMs;
  console.log(`  Ahorro:                                   ${s(saved)}`);
  console.log(`  Speedup:                                  ${speedup.toFixed(2)}x`);
}

console.log();
console.log(`  Consolidación (secuencial por diseño):    ${s(consolidatorMs)}`);
console.log(`  Total de la corrida:                      ${s(parallelMs + consolidatorMs)}`);
if (costs.length > 0) {
  console.log(`  Costo total de la corrida:                 USD ${totalCost.toFixed(4)}`);
}

const failed = [...rows, consolidator].filter((r) => r.isError === true);
if (failed.length > 0) {
  console.log();
  console.log(`  ATENCIÓN: ${failed.length} agente(s) terminaron con error: ${failed
    .map((r) => r.agent)
    .join(", ")}`);
}
