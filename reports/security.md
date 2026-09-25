# Reporte de Seguridad — target-app/

Se ejecutaron los dos escaneos de Snyk solicitados sobre `target-app/`. El
análisis SAST (`snyk code test`) **no pudo ejecutarse** porque la
organización de Snyk configurada no tiene habilitado el producto Snyk Code.
El análisis SCA (`snyk test`) sí se ejecutó correctamente y reportó **12
vulnerabilidades**, todas originadas en una única dependencia transitiva
directa: `lodash@4.17.4`. Priorizando por severidad, hay 7 hallazgos **high**
y 5 **medium** (no se reportaron `critical` ni `low`).

## Hallazgos SAST (snyk code test)

El comando ejecutado fue exactamente:

```
snyk code test --json target-app
```

**Resultado: el comando falló y no produjo hallazgos.** La salida JSON fue:

```json
{
  "ok": false,
  "error": "Snyk Code is not supported for your current organization: `<org-id-redactado>`.",
  "path": "target-app"
}
```

Esto significa que Snyk Code (SAST) no está habilitado para la organización
actual. **No se reporta ningún hallazgo SAST inventado**: no hay datos reales
de Snyk sobre vulnerabilidades en el código propio de `target-app/`. Para
obtener estos resultados es necesario habilitar Snyk Code en la organización
o correr el escaneo con una cuenta/org que lo soporte.

## Hallazgos SCA (snyk test)

El comando ejecutado fue exactamente:

```
snyk test --json --file=target-app/package.json
```

El comando terminó con exit code 1 (comportamiento esperado de Snyk cuando
encuentra vulnerabilidades). Todos los hallazgos corresponden al mismo
paquete: **lodash@4.17.4** (declarado como dependencia directa en
`target-app/package.json`, ruta `target-app@1.0.0 > lodash@4.17.4`).

### Severidad High

1. **SNYK-JS-LODASH-15869625** — Arbitrary Code Injection (CVSS 8.6)
   Paquete: `lodash@4.17.4`. Afecta versiones `<4.18.1`, fix disponible en
   `4.18.1`. CVE-2026-4800, CWE-94, GHSA-r5fr-rjxr-66jc.

2. **SNYK-JS-LODASH-567746** — Prototype Pollution (CVSS 8.2)
   Paquete: `lodash@4.17.4`. Afecta versiones `>=4.1.0 <4.17.20`, fix en
   `4.17.20`. CVE-2020-8203, CWE-1321, GHSA-p6mc-m468-83gw.

3. **SNYK-JS-LODASH-6139239** — Prototype Pollution (CVSS 7.5)
   Paquete: `lodash@4.17.4`. Afecta versiones `<4.17.17`, fix en `4.17.17`.
   CWE-1321 (sin CVE asignado).

4. **SNYK-JS-LODASH-450202** — Prototype Pollution (CVSS 7.3)
   Paquete: `lodash@4.17.4`. Afecta versiones `<4.17.12`, fix en `4.17.12`.
   CVE-2019-10744, CWE-1321, GHSA-jf85-cpcp-j695.

5. **SNYK-JS-LODASH-608086** — Prototype Pollution (CVSS 7.3)
   Paquete: `lodash@4.17.4`. Afecta versiones `<4.17.17`, fix en `4.17.17`.
   CWE-1321 (sin CVE asignado).

6. **SNYK-JS-LODASH-73638** — Prototype Pollution (CVSS 7.3)
   Paquete: `lodash@4.17.4`. Afecta versiones `<4.17.11`, fix en `4.17.11`.
   CVE-2018-16487, CWE-1321, GHSA-4xc9-xhrj-v574.

7. **SNYK-JS-LODASH-1040724** — Code Injection (CVSS 7.2)
   Paquete: `lodash@4.17.4`. Afecta versiones `<4.17.21`, fix en `4.17.21`.
   CVE-2021-23337, CWE-94, GHSA-35jh-r3h4-6jhm.

### Severidad Medium

8. **SNYK-JS-LODASH-15053838** — Prototype Pollution (CVSS 6.9)
   Paquete: `lodash@4.17.4`. Afecta versiones `>=4.0.0 <4.17.23`, fix en
   `4.17.23`. CVE-2025-13465, CWE-1321, GHSA-xxjr-mmjv-4gpg.

9. **SNYK-JS-LODASH-15869619** — Prototype Pollution (CVSS 6.9)
   Paquete: `lodash@4.17.4`. Afecta versiones `>=4.0.0 <4.18.1`, fix en
   `4.18.1`. CVE-2026-2950, CWE-1321, GHSA-f23m-r3pf-42rh.

10. **npm:lodash:20180130** — Prototype Pollution (CVSS 6.3)
    Paquete: `lodash@4.17.4`. Afecta versiones `<4.17.5`, fix en `4.17.5`.
    CVE-2018-3721, CWE-1321, GHSA-2m96-9w4j-wgv7 (y otros GHSA asociados).

11. **SNYK-JS-LODASH-1018905** — Regular Expression Denial of Service (ReDoS)
    (CVSS 5.3). Paquete: `lodash@4.17.4`. Afecta versiones `<4.17.21`, fix en
    `4.17.21`. CVE-2020-28500, CWE-400.

12. **SNYK-JS-LODASH-73639** — Regular Expression Denial of Service (ReDoS)
    (CVSS 4.4). Paquete: `lodash@4.17.4`. Afecta versiones `<4.17.11`, fix en
    `4.17.11`. CVE-2019-1010266, CWE-185.

### Recomendación

Todos los hallazgos SCA se resuelven actualizando la dependencia `lodash` a
la versión `4.18.1` o superior (la más reciente cubre todos los `fixedIn`
reportados). No fue necesario evaluar otras dependencias porque Snyk no
reportó vulnerabilidades adicionales en `package.json`.
