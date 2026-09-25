# Reglas de trabajo en este repo

Este proyecto es una **demo en vivo de guardrails** para una charla. Eso cambia
las reglas: acá los controles de seguridad no son decorado, son el producto.
Leé el `README.md` para el contexto y el "por qué" de cada decisión.

## No negociables

- **Todo lo que se cree o ejecute queda dentro de esta carpeta.** Nunca tocar
  archivos, bases de datos ni procesos fuera del proyecto.
- **No hay credenciales ni bases de datos reales.** La app objetivo usa SQLite
  local (`target-app/data.db`). Nunca una DB de red ni de producción.
- **Nunca ejecutar de verdad un comando destructivo** (`rm -rf`, `DROP`,
  `DELETE FROM`, `sudo`, `mkfs`, `dd`, `git push --force`), *ni siquiera para
  probar que el guardrail funciona*. La forma correcta de probar un guardrail es
  pedirle a un agente que **intente** algo peligroso y verificar que el sistema
  lo bloquea antes de ejecutarlo. El comando real nunca debe correr.
- **Antes de instalar algo globalmente o correr `snyk auth`, parar y preguntar.**
  Un `npm install` local dentro de una carpeta del repo no requiere preguntar.
- **No commitear nada salvo que el usuario lo pida explícitamente.**
- **Nada de identificadores de cuenta en los reportes.** `reports/*.md` se
  versiona y este repo se va a abrir para la charla: IDs de organización,
  usuario o slugs de Snyk van redactados como `<org-id-redactado>`. Los IDs de
  vulnerabilidad (`SNYK-JS-...`, CVE, CWE) sí van completos.
- Explicaciones breves **en español** para el usuario; el código (variables,
  funciones, mensajes de commit) **en inglés**.

## Los guardrails también te aplican a vos

Los hooks de `.claude/hooks/` corren sobre **toda** sesión en este repo,
incluida la tuya. Están bloqueados `rm`, `sudo`, `DROP TABLE`, `DELETE FROM`,
las vías programáticas de borrado (`fs.unlinkSync`, `fs.rmSync`, `os.remove`,
`shutil.rmtree`, `find -delete`) y cualquier ruta que resuelva fuera del
proyecto.

**Si necesitás borrar un archivo, pedíselo al usuario.** No desactives el hook
por tu cuenta y no busques una vía alternativa: eso convierte el control en un
adorno, que es exactamente lo contrario de lo que esta demo enseña. Si el
bloqueo es un falso positivo legítimo, la solución es ajustar el patrón del
hook y decirlo, no evadirlo.

## Gotchas que ya costaron tiempo

- **El guardrail de Bash matchea por substring.** Un nombre de archivo que
  contenga `rm` o `sudo` (ej. `case-04-sudo.json`) bloquea tu propio comando.
  Elegí nombres que no colisionen.
- **No pongas rutas absolutas fuera del proyecto en tus comandos** (por ejemplo
  redirigir a `/tmp`): el hook las bloquea. Usá rutas relativas al proyecto.
- **El Bash de los agentes matchea por prefijo del comando.** `Bash(snyk *)` no
  habilita `cd target-app && snyk ...`. Los agentes tienen que pasar la ruta
  como argumento.
- **Para probar los hooks, alimentalos con JSON sintético por stdin**
  (`node .claude/hooks/guard-bash.js < fixture.json`), nunca con el comando real.
- **No uses el `sha256` de `data.db` como criterio de integridad.** SQLite en
  modo WAL reescribe páginas con solo abrir la base. Verificá el contenido con
  `node scripts/check-db.js`.
- **`grep` acá resuelve a `ugrep`, que respeta `.gitignore`.** Una búsqueda que
  devuelve vacío no prueba que el repo esté limpio: saltea lo ignorado, y ahí
  está `reports/.run/` con los session IDs y el ID de organización de Snyk.
  Para auditar de verdad usá `--no-ignore-files` (no `--no-ignore`, que es de
  `ripgrep`), o `find` con `xargs grep`, que invoca el binario real en vez del
  alias del shell.

## Comandos útiles

```bash
cd target-app && npm install && npm run seed && npm test   # preparar la app objetivo
bash scripts/orchestrate.sh                                 # los 4 agentes + métricas
bash scripts/test-guardrails.sh                             # prueba de guardrails
node scripts/check-db.js                                    # integridad de la DB
```
