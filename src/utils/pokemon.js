// Número del último Pokémon de la Pokédex Nacional (Generación 9)
export const MAX_ID = 1025;

export const typeColors = {
  normal: "#A8A77A",
  fire: "#EE8130",
  water: "#6390F0",
  electric: "#F7D02C",
  grass: "#7AC74C",
  ice: "#96D9D6",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  dark: "#705746",
  steel: "#B7B7CE",
  fairy: "#D685AD",
};

export const typeNames = {
  normal: "Normal",
  fire: "Fuego",
  water: "Agua",
  electric: "Eléctrico",
  grass: "Planta",
  ice: "Hielo",
  fighting: "Lucha",
  poison: "Veneno",
  ground: "Tierra",
  flying: "Volador",
  psychic: "Psíquico",
  bug: "Bicho",
  rock: "Roca",
  ghost: "Fantasma",
  dragon: "Dragón",
  dark: "Siniestro",
  steel: "Acero",
  fairy: "Hada",
};

export const statNames = {
  hp: "PS",
  attack: "Ataque",
  defense: "Defensa",
  "special-attack": "At. Especial",
  "special-defense": "Def. Especial",
  speed: "Velocidad",
};

// Devuelve texto oscuro o blanco según qué tan claro sea el color de fondo
export const textColorFor = (hex) => {
  if (!hex || !hex.startsWith("#") || hex.length !== 7) return "#fff";
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7 ? "#1d1d1d" : "#fff";
};

// Color del número de la estadística según qué tan alta es
export const statColor = (value) => {
  if (value < 50) return "#ff6b6b";
  if (value < 80) return "#ffa94d";
  if (value < 100) return "#ffd43b";
  if (value < 130) return "#8ce99a";
  return "#74c0fc";
};

/**
 * Calcula las debilidades reales combinando los tipos del Pokémon.
 * Para cada tipo atacante se multiplica el daño por cada tipo defensor:
 * x2 (double_damage_from), x0.5 (half_damage_from) y x0 (no_damage_from).
 * Solo se devuelven los que quedan en x2 o más, ordenados de mayor a menor.
 */
export const calculateWeaknesses = (typeDataList) => {
  const multipliers = Object.fromEntries(
    Object.keys(typeColors).map((type) => [type, 1])
  );

  for (const { damage_relations: relations } of typeDataList) {
    const apply = (list, factor) =>
      list.forEach(({ name }) => {
        if (name in multipliers) multipliers[name] *= factor;
      });
    apply(relations.double_damage_from, 2);
    apply(relations.half_damage_from, 0.5);
    apply(relations.no_damage_from, 0);
  }

  return Object.entries(multipliers)
    .filter(([, multiplier]) => multiplier >= 2)
    .map(([type, multiplier]) => ({ type, multiplier }))
    .sort((a, b) => b.multiplier - a.multiplier);
};

export const idFromUrl = (url) => Number(url.split("/").filter(Boolean).pop());

export const artworkUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

/**
 * Convierte la cadena evolutiva de la API en etapas:
 * [[bulbasaur], [ivysaur], [venusaur]]  o  [[eevee], [vaporeon, jolteon, ...]]
 */
export const parseEvolutionChain = (node, depth = 0, stages = []) => {
  if (!stages[depth]) stages[depth] = [];
  stages[depth].push({
    name: node.species.name,
    id: idFromUrl(node.species.url),
  });
  node.evolves_to.forEach((next) => parseEvolutionChain(next, depth + 1, stages));
  return stages;
};

/**
 * Limpia lo que escribe el usuario para que la PokeAPI lo entienda:
 * "  Pikachu " -> "pikachu", "#025" -> "25", "Mr. Mime" -> "mr-mime",
 * "Flabébé" -> "flabebe", "Farfetch'd" -> "farfetchd"
 */
export const normalizeQuery = (input) => {
  const text = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’]/g, "")
    .replace(/\s+/g, "-");

  if (/^\d+$/.test(text)) return String(Number(text));
  return text;
};

// Toma la entrada más reciente en español de una lista de textos de la API
export const pickSpanish = (entries, field) => {
  const spanish = (entries || []).filter((e) => e.language?.name === "es");
  if (!spanish.length) return "";
  return spanish[spanish.length - 1][field]
    .replace(/[\n\f\r\u00ad]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};
