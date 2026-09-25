#!/usr/bin/env bash
#
# Orquestador de la demo.
#
# 1. Lanza security-agent, performance-agent y quality-agent EN PARALELO
#    (Claude Code headless, cada uno con su propio rol y sus propias tools).
# 2. Espera a que los tres terminen.
# 3. Corre consolidator-agent, que lee los 3 reportes y escribe summary.md.
# 4. Imprime la comparación: tiempo real en paralelo vs. suma de los tiempos
#    individuales (lo que habría tardado en secuencial).
#
# Todo queda dentro de este repo. Los guardrails de .claude/settings.json y
# los hooks PreToolUse siguen activos para cada agente.

set -uo pipefail

cd "$(dirname "$0")/.."

REPORTS_DIR="reports"
RUN_DIR="$REPORTS_DIR/.run"
mkdir -p "$REPORTS_DIR" "$RUN_DIR"

now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }

run_agent() {
  local agent="$1"
  local prompt="$2"
  local start end status

  start=$(now_ms)
  claude -p "$prompt" \
    --agent "$agent" \
    --permission-mode acceptEdits \
    --output-format json \
    >"$RUN_DIR/$agent.json" 2>"$RUN_DIR/$agent.err"
  status=$?
  end=$(now_ms)

  echo "$((end - start))" >"$RUN_DIR/$agent.wall_ms"
  echo "$status" >"$RUN_DIR/$agent.status"
}

echo "=============================================="
echo " Fase paralela: 3 agentes especializados"
echo "=============================================="
echo "Lanzando security-agent, performance-agent y quality-agent en paralelo..."
echo

PARALLEL_START=$(now_ms)

run_agent "security-agent" \
  "Analizá la seguridad de target-app/ siguiendo tus instrucciones y escribí tu reporte en reports/security.md" &
run_agent "performance-agent" \
  "Analizá la performance de target-app/ siguiendo tus instrucciones y escribí tu reporte en reports/performance.md" &
run_agent "quality-agent" \
  "Analizá la calidad de target-app/ siguiendo tus instrucciones y escribí tu reporte en reports/quality.md" &

wait

PARALLEL_END=$(now_ms)
PARALLEL_MS=$((PARALLEL_END - PARALLEL_START))

for agent in security-agent performance-agent quality-agent; do
  status=$(cat "$RUN_DIR/$agent.status" 2>/dev/null || echo "?")
  wall=$(cat "$RUN_DIR/$agent.wall_ms" 2>/dev/null || echo "?")
  if [ "$status" = "0" ]; then
    echo "  [ok]    $agent — ${wall} ms"
  else
    echo "  [FALLO] $agent — exit $status (ver $RUN_DIR/$agent.err)"
  fi
done

echo
echo "=============================================="
echo " Consolidación"
echo "=============================================="

CONSOLIDATOR_START=$(now_ms)
run_agent "consolidator-agent" \
  "Leé reports/security.md, reports/performance.md y reports/quality.md y escribí el resumen ejecutivo en reports/summary.md"
CONSOLIDATOR_END=$(now_ms)
CONSOLIDATOR_MS=$((CONSOLIDATOR_END - CONSOLIDATOR_START))

status=$(cat "$RUN_DIR/consolidator-agent.status" 2>/dev/null || echo "?")
if [ "$status" = "0" ]; then
  echo "  [ok]    consolidator-agent — ${CONSOLIDATOR_MS} ms"
else
  echo "  [FALLO] consolidator-agent — exit $status (ver $RUN_DIR/consolidator-agent.err)"
fi

echo
node scripts/report-metrics.js "$PARALLEL_MS" "$CONSOLIDATOR_MS"
