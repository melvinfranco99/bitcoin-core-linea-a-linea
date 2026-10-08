# Bitcoin Core, línea a línea

Curso web en español, por niveles y con juegos interactivos, para entender y auditar por tu cuenta el código de [Bitcoin Core](https://github.com/bitcoin/bitcoin) (versión **v31.1**, commit `9be056a8a72b624dae9623b2f7bded92c2a21c91`).

**Web:** https://melvinfranco99.github.io/bitcoin-core-linea-a-linea/

## Contenido

- 14 niveles (0–13): verificación del código, bytes y hashes, claves y firmas, transacciones, Script, bloques y prueba de trabajo, validación, UTXO y disco, red P2P, mempool y minería, soft forks, cartera, arranque y RPC, y método de auditoría.
- Más de 100 fragmentos de código real con ~500 notas explicativas intercaladas línea a línea.
- 18 juegos y simuladores con cálculos reales (SHA-256 y RIPEMD-160 propios en JS, reconstrucción del bloque génesis, minería, árbol de Merkle, ajuste de dificultad, máquina de Script, UTXO, reorganizaciones, BIP9…).
- Explorador con los 2.923 archivos del repositorio: descripción, comentario de cabecera, funciones detectadas y código descargado directamente de GitHub en el commit fijado, con las notas de los niveles intercaladas.

## No te fíes de esta web: regénerala

Ningún fragmento está copiado a mano. `build.py` los extrae del repositorio oficial en el commit fijado y **falla** si alguno no existe exactamente:

```sh
python3 build.py            # clona bitcoin/bitcoin@v31.1 en ./bitcoin-src si no existe y genera ./docs
python3 -m http.server -d docs 8000
```

Estructura: `content/` (lecciones con etiquetas `<code-ref>` / `<n>` / `<auto-table>`), `assets/` (estilos, juegos, explorador), `descriptions.py` (descripciones de carpetas y archivos), `docs/` (sitio generado que publica GitHub Pages).

Proyecto educativo independiente, sin relación oficial con los desarrolladores de Bitcoin Core. El código de Bitcoin Core se distribuye bajo licencia MIT.
