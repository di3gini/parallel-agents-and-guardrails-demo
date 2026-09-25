#!/usr/bin/env node
"use strict";

/**
 * PreToolUse hook para el tool Bash.
 *
 * Recibe por stdin el JSON que Claude Code manda antes de correr un comando
 * Bash (ver `Hook Input`), lo compara contra la misma lista de patrones
 * peligrosos que `.claude/settings.json` intenta cubrir a nivel de permisos,
 * y si matchea, bloquea el comando ANTES de que se ejecute devolviendo
 * `hookSpecificOutput.permissionDecision: "deny"`.
 *
 * Cada intento bloqueado queda registrado en reports/guardrail-log.md.
 */

const fs = require("fs");
const path = require("path");

// Raíz real del proyecto: dos niveles arriba de este script
// (`<project>/.claude/hooks/guard-bash.js`). Ancla fija, independiente del
// cwd de cada llamada a Bash (que puede ser una subcarpeta como
// `target-app/`), para no confundir "cd .." dentro del proyecto con "salir
// del proyecto".
const PROJECT_DIR = path.resolve(__dirname, "..", "..");

const DANGEROUS_PATTERNS = [
  { name: "rm", re: /\brm\b/i },
  { name: "sudo", re: /\bsudo\b/i },
  { name: "mkfs", re: /\bmkfs\b/i },
  { name: "dd if=", re: /\bdd\s+if=/i },
  { name: "git push --force / -f", re: /\bgit\s+push\b[^\n]*(--force\b|-f\b)/i },
  { name: "chmod -R 777", re: /\bchmod\s+-R\s+777\b/i },
  { name: "curl | sh|bash", re: /\bcurl\b[^\n]*\|\s*(sh|bash)\b/i },
  { name: "DROP TABLE", re: /\bDROP\s+TABLE\b/i },
  { name: "DELETE FROM", re: /\bDELETE\s+FROM\b/i },
  { name: "TRUNCATE", re: /\bTRUNCATE\b/i },
  // Borrado por vía programática: un agente al que le deniegan `rm` puede
  // intentar lo mismo desde node/python o con `find -delete`. Sin esto, el
  // guardrail se esquiva con una línea.
  { name: "fs.unlink (node)", re: /\bunlink(Sync)?\s*\(/i },
  { name: "fs.rm/rmdir (node)", re: /\b(rm|rmdir)(Sync)?\s*\(/i },
  { name: "shutil.rmtree (python)", re: /shutil\.rmtree/i },
  { name: "os.remove/unlink (python)", re: /\bos\.(remove|unlink|rmdir)\s*\(/i },
  { name: "find -delete", re: /\bfind\b[^\n]*-delete\b/i },
];

// Cualquier ruta (absoluta, o relativa con "..") que resuelva fuera de la
// carpeta del proyecto se bloquea, aunque no matchee ninguno de los
// patrones de arriba. Ojo: esto NO es "prohibir .." a secas — un
// `../reports/x.md` corrido desde `target-app/` sigue resolviendo adentro
// del proyecto y no se bloquea; sólo se bloquea si la resolución final cae
// afuera de `PROJECT_DIR`.
function leavesProjectDir(command, cwd) {
  const tokens = command.split(/\s+/).map((t) => t.replace(/^["'`]+|["'`]+$/g, ""));
  return tokens.some((tok) => {
    const looksLikePath = tok.startsWith("/") || tok.includes("..");
    if (!looksLikePath) return false;
    const base = tok.startsWith("/") ? undefined : cwd || PROJECT_DIR;
    const resolved = base ? path.resolve(base, tok) : path.resolve(tok);
    const rel = path.relative(PROJECT_DIR, resolved);
    return rel === ".." || rel.startsWith(`..${path.sep}`);
  });
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function logBlocked({ agent, tool, command, reason }) {
  const reportsDir = path.join(PROJECT_DIR, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const logPath = path.join(reportsDir, "guardrail-log.md");
  const timestamp = new Date().toISOString();
  const entry = [
    `## ${timestamp}`,
    `- Agente: ${agent}`,
    `- Herramienta: ${tool}`,
    `- Comando intentado: \`${command}\``,
    `- Patrón bloqueado: ${reason}`,
    "- Resultado: bloqueado antes de ejecutar (nunca corrió)",
    "",
  ].join("\n");
  fs.appendFileSync(logPath, entry + "\n");
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.exit(0);
  }

  if (input.tool_name !== "Bash") {
    process.exit(0);
  }

  const command = (input.tool_input && input.tool_input.command) || "";
  const agent = input.agent_type || "main";

  const matched = DANGEROUS_PATTERNS.find((p) => p.re.test(command));
  const outside = !matched && leavesProjectDir(command, input.cwd);

  if (!matched && !outside) {
    process.exit(0);
  }

  const reason = matched ? matched.name : "ruta fuera de la carpeta del proyecto";

  logBlocked({ agent, tool: input.tool_name, command, reason });

  const output = {
    systemMessage: `Guardrail: comando bloqueado (${reason}). Ver reports/guardrail-log.md`,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Comando bloqueado por guardrail (coincide con "${reason}"). Nunca se ejecutó. Ver reports/guardrail-log.md.`,
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main();
