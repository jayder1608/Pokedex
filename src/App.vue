<template>
  <div class="app">
    <header class="search-bar" :style="{ borderColor: mainTypeColor }">
      <input
        v-model="pokemonName"
        list="pokemon-names"
        placeholder="Buscar por nombre o número"
        aria-label="Buscar Pokémon por nombre o número"
        :style="{ borderColor: mainTypeColor }"
        @keyup.enter="search"
      />
      <datalist id="pokemon-names">
        <option v-for="name in allNames" :key="name" :value="name" />
      </datalist>
      <button
        :disabled="loading"
        :style="{ backgroundColor: mainTypeColor, color: mainTypeText }"
        @click="search"
      >
        {{ loading ? "Buscando…" : "Buscar" }}
      </button>
    </header>

    <p v-if="error && pokemon" class="error-msg" role="alert">{{ error }}</p>

    <main v-if="pokemon" class="container" :class="{ 'is-loading': loading }">
      <section
        class="card-left"
        :style="{
          background: backgroundGradient,
          color: leftTextColor,
          '--title-shadow': leftTextColor === '#fff' ? '1px 1px 3px rgba(0, 0, 0, 0.5)' : 'none',
        }"
      >
        <h1>{{ displayName }}</h1>
        <p v-if="genus" class="genus">{{ genus }}</p>
        <div class="image-container">
          <img
            :src="imageSrc"
            :alt="pokemon.name"
            @mouseenter="hoverShiny = true"
            @mouseleave="hoverShiny = false"
            @error="imgFallback++"
          />
          <button
            v-if="cryUrl"
            class="cry-button"
            aria-label="Escuchar el grito"
            :style="{ backgroundColor: mainTypeColor, color: mainTypeText }"
            @click="playCry"
          >
            🔊
          </button>
        </div>
        <button
          v-if="hasShiny"
          class="shiny-button"
          :class="{ active: shinyOn }"
          :aria-pressed="shinyOn"
          @click="shinyOn = !shinyOn"
        >
          ✨ {{ shinyOn ? "Ver normal" : "Ver shiny" }}
        </button>
        <p><strong>Altura:</strong> {{ pokemon.height / 10 }} m</p>
        <p><strong>Peso:</strong> {{ pokemon.weight / 10 }} kg</p>
      </section>

      <section class="card-center">
        <div class="dex-nav">
          <button
            class="nav-btn"
            aria-label="Pokémon anterior"
            :disabled="loading || baseId <= 1"
            @click="fetchPokemon(baseId - 1)"
          >
            ◀
          </button>
          <p class="dex-number" :style="{ color: mainTypeColor }">#{{ baseId }}</p>
          <button
            class="nav-btn"
            aria-label="Pokémon siguiente"
            :disabled="loading || baseId >= MAX_ID"
            @click="fetchPokemon(baseId + 1)"
          >
            ▶
          </button>
        </div>

        <p v-if="description" class="description">{{ description }}</p>

        <h3>Tipo(s)</h3>
        <div class="types">
          <span
            v-for="t in pokemon.types"
            :key="t.type.name"
            class="type-badge"
            :style="badgeStyle(t.type.name)"
          >
            {{ typeNames[t.type.name] || t.type.name }}
          </span>
        </div>

        <h3>Debilidades</h3>
        <div v-if="weaknesses.length" class="weaknesses">
          <span
            v-for="w in weaknesses"
            :key="w.type"
            class="weak-badge"
            :style="badgeStyle(w.type)"
          >
            {{ typeNames[w.type] || w.type }}
            <small v-if="w.multiplier >= 4" class="x4">x{{ w.multiplier }}</small>
          </span>
        </div>
        <p v-else class="muted">No tiene debilidades.</p>
      </section>

      <section class="card-right">
        <h2>Estadísticas</h2>
        <div class="stats-container">
          <div v-for="(stat, index) in stats" :key="`${pokemon.id}-${stat.key}`" class="stat">
            <div class="stat-row">
              <span class="stat-name">{{ stat.label.toUpperCase() }}</span>
              <span class="stat-value">
                <span :style="{ color: statColor(stat.value) }">{{ stat.value }}</span>/255
              </span>
            </div>
            <div class="stat-bar">
              <div
                class="bar"
                :style="{
                  width: (stat.value / 255) * 100 + '%',
                  background: backgroundGradient,
                  animationDelay: index * 0.2 + 's',
                }"
              ></div>
            </div>
          </div>
          <div class="stat-total">
            <span>TOTAL</span>
            <span>{{ totalStats }}</span>
          </div>
        </div>
      </section>

      <section class="card-evolution">
        <h2>Evolución</h2>
        <div v-if="evolutionStages.length > 1" class="evo-chain">
          <template v-for="(stage, i) in evolutionStages" :key="i">
            <span v-if="i > 0" class="evo-arrow" aria-hidden="true">➜</span>
            <div class="evo-stage">
              <button
                v-for="evo in stage"
                :key="evo.id"
                class="evo-item"
                :class="{ current: evo.id === baseId }"
                :style="evo.id === baseId ? { borderColor: mainTypeColor } : null"
                :disabled="loading || evo.id === baseId"
                @click="fetchPokemon(evo.id)"
              >
                <img :src="artworkUrl(evo.id)" :alt="evo.name" loading="lazy" />
                <span class="evo-name">{{ evo.name.replace(/-/g, " ") }}</span>
                <span class="evo-id">#{{ evo.id }}</span>
              </button>
            </div>
          </template>
        </div>
        <p v-else class="muted">Este Pokémon no evoluciona.</p>
      </section>
    </main>

    <p v-else-if="loading" class="loading">Cargando Pokémon...</p>

    <div v-else class="loading">
      <p>{{ error }}</p>
      <button class="retry-button" @click="fetchRandom">Cargar un Pokémon al azar</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import axios from "axios";
import {
  MAX_ID,
  typeColors,
  typeNames,
  statNames,
  textColorFor,
  statColor,
  calculateWeaknesses,
  parseEvolutionChain,
  artworkUrl,
  normalizeQuery,
  pickSpanish,
} from "./utils/pokemon";

const API = "https://pokeapi.co/api/v2";
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="white" stroke-width="6" opacity=".5"/><text x="50" y="66" font-size="48" text-anchor="middle" fill="white" opacity=".6" font-family="sans-serif">?</text></svg>'
  );

const pokemon = ref(null);
const species = ref(null);
const weaknesses = ref([]);
const evolutionStages = ref([]);
const pokemonName = ref("");
const allNames = ref([]);
const loading = ref(false);
const error = ref("");
const shinyOn = ref(false);
const hoverShiny = ref(false);
const imgFallback = ref(0);
const cryUrl = ref(null);
let audio = null;
let lastRequest = 0;

// Caché: si ya se pidió una URL, no se vuelve a pedir
const cache = new Map();
const getJSON = (url) => {
  if (!cache.has(url)) {
    const request = axios.get(url).then((res) => res.data);
    request.catch(() => cache.delete(url));
    cache.set(url, request);
  }
  return cache.get(url);
};

// Algunos nombres de especie (ej. "deoxys") no existen en /pokemon,
// así que si falla se busca la especie y se usa su forma por defecto.
const loadPokemonData = async (query) => {
  try {
    return { data: await getJSON(`${API}/pokemon/${query}`), speciesData: null };
  } catch (err) {
    if (err.response?.status !== 404 || /^\d+$/.test(query)) throw err;
    const speciesData = await getJSON(`${API}/pokemon-species/${query}`);
    const variety = speciesData.varieties.find((v) => v.is_default) ?? speciesData.varieties[0];
    return { data: await getJSON(variety.pokemon.url), speciesData };
  }
};

const fetchPokemon = async (input) => {
  const query = normalizeQuery(input);
  if (!query) {
    error.value = "Escribe el nombre o el número de un Pokémon.";
    return;
  }

  // Si el usuario hace otra búsqueda antes de que termine esta, se descarta
  const requestId = ++lastRequest;
  loading.value = true;
  error.value = "";

  try {
    const { data, speciesData: preloaded } = await loadPokemonData(query);

    const [typeData, speciesData] = await Promise.all([
      Promise.all(data.types.map((t) => getJSON(t.type.url))),
      preloaded ?? getJSON(data.species.url),
    ]);

    let stages = [];
    try {
      const evolution = await getJSON(speciesData.evolution_chain.url);
      stages = parseEvolutionChain(evolution.chain);
    } catch {
      stages = [];
    }

    if (requestId !== lastRequest) return;

    pokemon.value = data;
    species.value = speciesData;
    weaknesses.value = calculateWeaknesses(typeData);
    evolutionStages.value = stages;
    shinyOn.value = false;
    imgFallback.value = 0;
    setupCry(data);
  } catch (err) {
    if (requestId !== lastRequest) return;
    error.value =
      err.response?.status === 404
        ? `No se encontró "${String(input).trim()}". Revisa el nombre o usa un número del 1 al ${MAX_ID}.`
        : "No se pudo conectar con la PokeAPI. Revisa tu conexión e inténtalo de nuevo.";
  } finally {
    if (requestId === lastRequest) loading.value = false;
  }
};

const search = () => fetchPokemon(pokemonName.value);

const fetchRandom = () => fetchPokemon(Math.floor(Math.random() * MAX_ID) + 1);

const setupCry = (data) => {
  if (audio) audio.pause();
  cryUrl.value = data.cries?.latest || data.cries?.legacy || null;
  audio = cryUrl.value ? new Audio(cryUrl.value) : null;
  if (audio) audio.volume = 0.4;
};

const playCry = () => {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
};

const badgeStyle = (type) => {
  const bg = typeColors[type] || "#888";
  return { backgroundColor: bg, color: textColorFor(bg) };
};

const baseId = computed(() => species.value?.id ?? pokemon.value?.id ?? 0);

const displayName = computed(() => pokemon.value.name.replace(/-/g, " ").toUpperCase());

const genus = computed(() => pickSpanish(species.value?.genera, "genus"));

const description = computed(() => pickSpanish(species.value?.flavor_text_entries, "flavor_text"));

const showShiny = computed(() => shinyOn.value || hoverShiny.value);

const hasShiny = computed(() => {
  const s = pokemon.value?.sprites;
  return Boolean(s?.other?.["official-artwork"]?.front_shiny || s?.front_shiny);
});

// Imagen oficial en alta calidad, con respaldo si alguna no existe o falla
const imageSrc = computed(() => {
  const s = pokemon.value.sprites;
  const art = s.other?.["official-artwork"];
  const candidates = (
    showShiny.value ? [art?.front_shiny, s.front_shiny] : [art?.front_default, s.front_default]
  ).filter(Boolean);
  return candidates[imgFallback.value] || PLACEHOLDER;
});

watch(showShiny, () => {
  imgFallback.value = 0;
});

const stats = computed(() =>
  pokemon.value.stats.map((s) => ({
    key: s.stat.name,
    label: statNames[s.stat.name] || s.stat.name,
    value: s.base_stat,
  }))
);

const totalStats = computed(() => stats.value.reduce((sum, s) => sum + s.value, 0));

const mainTypeColor = computed(() => {
  if (!pokemon.value) return "#999";
  return typeColors[pokemon.value.types[0].type.name] || "#999";
});

const mainTypeText = computed(() => textColorFor(mainTypeColor.value));

const leftTextColor = computed(() => textColorFor(mainTypeColor.value));

const backgroundGradient = computed(() => {
  if (!pokemon.value) return "#333";
  const colors = pokemon.value.types.map((t) => typeColors[t.type.name] || "#555");
  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
});

onMounted(() => {
  fetchRandom();
  getJSON(`${API}/pokemon-species?limit=${MAX_ID}`)
    .then((data) => {
      allNames.value = data.results.map((r) => r.name);
    })
    .catch(() => {});
});
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: #222;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow-x: hidden;
}

* {
  box-sizing: border-box;
}

button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>

<style scoped>
.app {
  width: 100%;
  min-height: 100vh;
  background-color: #222;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 20px;
  position: relative;
}

.search-bar {
  width: 100%;
  max-width: 400px;
  display: flex;
  gap: 8px;
  border: 2px solid #fff;
  border-radius: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 30px;
}

.search-bar input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 2px solid #fff;
  border-radius: 8px;
  outline: none;
  background: transparent;
  color: white;
  font-size: 16px;
  transition: background 0.2s;
}

.search-bar input:focus {
  background: rgba(255, 255, 255, 0.08);
}

.search-bar input::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.search-bar button {
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: opacity 0.2s;
}

.search-bar button:hover {
  opacity: 0.9;
}

.search-bar button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.error-msg {
  width: 100%;
  max-width: 400px;
  margin: -18px 0 20px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 90, 90, 0.12);
  color: #ff9c9c;
  font-size: 0.95rem;
}

.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 25px;
  width: 100%;
  max-width: 1200px;
  align-items: start;
  justify-items: center;
  margin: 0 auto;
  transition: opacity 0.2s;
}

.container.is-loading {
  opacity: 0.6;
}

.card-left,
.card-center,
.card-right {
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 380px;
  min-height: 450px;
}

.card-left {
  text-align: center;
  position: relative;
}

.card-left h1 {
  margin-top: 0;
  margin-bottom: 0;
  font-size: 1.8rem;
  text-shadow: var(--title-shadow);
}

.image-container {
  position: relative;
  display: inline-block;
  margin: 15px auto;
}

.card-left img {
  width: 180px;
  height: 180px;
  object-fit: contain;
  transition: transform 0.3s;
  filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.3));
}

.card-left img:hover {
  transform: scale(1.1);
}

.cry-button {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: white;
  cursor: pointer;
  transition: transform 0.2s;
}

.cry-button:hover {
  transform: scale(1.1);
}

.shiny-button {
  align-self: center;
  margin-bottom: 8px;
  padding: 5px 14px;
  border: 2px solid currentColor;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
  font-weight: bold;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.shiny-button:hover,
.shiny-button.active {
  background: rgba(255, 255, 255, 0.35);
}

.card-left p {
  margin: 8px 0;
  font-size: 1.1rem;
}

.card-left .genus {
  margin: 4px 0 0;
  font-size: 0.95rem;
  opacity: 0.9;
}

.card-center {
  text-align: center;
  background: rgba(255, 255, 255, 0.05);
  justify-content: flex-start;
}

.dex-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.nav-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.dex-number {
  font-size: 4rem;
  font-weight: 900;
  margin: 10px 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.description {
  margin: 0 0 5px;
  font-size: 0.95rem;
  line-height: 1.5;
  font-style: italic;
  opacity: 0.85;
}

.card-center h3 {
  margin: 15px 0 10px;
  font-size: 1.3rem;
}

.types,
.weaknesses {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 10px;
}

.type-badge,
.weak-badge {
  padding: 6px 12px;
  border-radius: 10px;
  text-transform: capitalize;
  color: white;
  font-weight: bold;
  font-size: 0.9rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.x4 {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  font-size: 0.75em;
}

.muted {
  opacity: 0.6;
}

.card-right {
  background: rgba(255, 255, 255, 0.05);
  justify-content: flex-start;
}

.card-right h2,
.card-evolution h2 {
  text-align: center;
  font-size: 1.6rem;
  margin-top: 0;
  margin-bottom: 20px;
}

.stats-container {
  width: 100%;
}

.stat {
  margin: 12px 0;
}

.stat-row,
.stat-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;
  font-weight: bold;
  font-size: 0.95rem;
  margin-bottom: 6px;
}

.stat-total {
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 1.05rem;
}

.stat-bar {
  width: 100%;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.bar {
  height: 100%;
  border-radius: 8px;
  transform-origin: left;
  animation: fillBar 1s ease both;
}

@keyframes fillBar {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.card-evolution {
  grid-column: 1 / -1;
  width: 100%;
  padding: 20px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.evo-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.evo-stage {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  max-width: 540px;
}

.evo-item {
  width: 120px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border: 2px solid transparent;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.evo-item:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.3);
}

.evo-item.current {
  cursor: default;
  background: rgba(255, 255, 255, 0.1);
}

.evo-item img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.evo-name {
  font-weight: bold;
  font-size: 0.9rem;
  text-transform: capitalize;
}

.evo-id {
  font-size: 0.8rem;
  opacity: 0.7;
}

.evo-arrow {
  font-size: 1.5rem;
  opacity: 0.6;
}

.loading {
  font-size: 1.5rem;
  margin-top: 50px;
  text-align: center;
  width: 100%;
}

.retry-button {
  margin-top: 10px;
  padding: 10px 18px;
  border: 2px solid #fff;
  border-radius: 8px;
  background: transparent;
  color: white;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .container {
    grid-template-columns: 1fr;
    max-width: 600px;
  }

  .card-left, .card-center, .card-right {
    max-width: 100%;
  }

  .dex-number {
    font-size: 3.5rem;
  }
}

@media (max-width: 768px) {
  .app {
    padding: 15px;
  }

  .search-bar {
    max-width: 100%;
  }

  .card-left img {
    width: 150px;
    height: 150px;
  }

  .dex-number {
    font-size: 3rem;
  }

  .card-left h1 {
    font-size: 1.6rem;
  }
}

@media (max-width: 480px) {
  .app {
    padding: 10px;
  }

  .card-left, .card-center, .card-right {
    padding: 15px;
    min-height: 400px;
  }

  .card-left img {
    width: 130px;
    height: 130px;
  }

  .dex-number {
    font-size: 2.5rem;
  }

  .type-badge, .weak-badge {
    font-size: 0.8rem;
    padding: 5px 10px;
  }

  .evo-item {
    width: 100px;
  }

  .evo-arrow {
    transform: rotate(90deg);
    width: 100%;
  }
}
</style>
