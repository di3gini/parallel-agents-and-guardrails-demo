#!/usr/bin/env node
"use strict";

/**
 * PreToolUse hook para Write/Edit.
 *
 * Los 4 agentes de la demo sólo pueden escribir dentro de `reports/`. Esto no
 * se puede expresar en `.claude/settings.json`: las permission rules no se
 * pueden scopear por agente (son globales a la sesión), y las reglas de path
 * sobre Write no bloquearon en esta versión (probado: un `deny` de
 * `Write(target-app/*)` dejó pasar la escritura igual).
 *
 * Por eso el límite se aplica acá, resolviendo la ruta de verdad, y sólo
 * cuando la llamada viene de uno de los agentes de la demo (`agent_type`).
 * Una sesión de desarrollo normal (sin `agent_type`) no queda restringida,
 * porque tiene que poder escribir `scripts/`, `README.md`, etc.
 */

const fs = require("fs");
const path = require("path");

const PROJECT_DIR = path.resolve(__dirname, "..", "..");
const REPORTS_DIR = path.join(PROJECT_DIR, "reports");

const RESTRICTED_AGENTS = new Set([
  "security-agent",
  "performance-agent",
  "quality-agent",
  "consolidator-agent",
]);

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function logBlocked({ agent, tool, target, reason }) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const logPath = path.join(REPORTS_DIR, "guardrail-log.md");
  const entry = [
    `## ${new Date().toISOString()}`,
    `- Agente: ${agent}`,
    `- Herramienta: ${tool}`,
    `- Archivo intentado: \`${target}\``,
    `- Patrón bloqueado: ${reason}`,
    "- Resultado: bloqueado antes de escribir (el archivo no se tocó)",
    "",
  ].join("\n");
  fs.appendFileSync(logPath, entry + "\n");
}

function isInsideReports(filePath, cwd) {
  const resolved = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(cwd || PROJECT_DIR, filePath);
  const rel = path.relative(REPORTS_DIR, resolved);
  return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.exit(0);
  }

  const agent = input.agent_type;
  if (!agent || !RESTRICTED_AGENTS.has(agent)) {
    process.exit(0);
  }

  const target = (input.tool_input && input.tool_input.file_path) || "";
  if (!target || isInsideReports(target, input.cwd)) {
    process.exit(0);
  }

  const reason = "escritura fuera de reports/";
  logBlocked({ agent, tool: input.tool_name, target, reason });

  process.stdout.write(
    JSON.stringify({
      systemMessage: `Guardrail: ${agent} intentó escribir fuera de reports/ (${target}). Bloqueado.`,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Bloqueado por guardrail: ${agent} sólo puede escribir dentro de reports/. Intento sobre "${target}" rechazado, el archivo no se tocó.`,
      },
    })
  );
  process.exit(0);
}

main();
