# Pokédex

Pokédex hecha con **Vue 3**, **Vite** y la [PokeAPI](https://pokeapi.co/).

## Funciones

- Búsqueda por nombre o número, con autocompletado (acepta mayúsculas, tildes, espacios y `#025`)
- Imagen oficial en alta calidad y botón para ver la versión shiny
- Grito del Pokémon
- Tipos y debilidades en español, con el cálculo correcto para doble tipo (incluye x4 e inmunidades)
- Estadísticas con barras animadas y total
- Descripción de la Pokédex y categoría en español
- Cadena evolutiva con imágenes clicables
- Navegación al Pokémon anterior y siguiente
- Mensajes claros cuando no se encuentra un Pokémon o falla la conexión

## Cómo ejecutarlo

```bash
npm install
npm run dev
```

Para generar la versión de producción:

```bash
npm run build
```

## Estructura

```
src/
├── App.vue            # Interfaz y lógica principal
├── main.js            # Punto de entrada
├── style.css          # Estilos globales
└── utils/pokemon.js   # Colores, traducciones, cálculo de debilidades y evolución
```
