// Les six classes, telles que définies dans le document de règles de la campagne.
// Partagé par la page de création de personnage et la simulation de combat.

export const STATS = [
  ['FOR', 'Force'], ['DEX', 'Dextérité'], ['CON', 'Constitution'],
  ['INT', 'Intelligence'], ['SAG', 'Sagesse'], ['CHA', 'Charisme'],
];

export const STAT_NAME = Object.fromEntries(STATS);

// Statistiques communes à toutes les classes.
export const BASE = { pv: 20, fatigueMax: 3, shortRest: 1 };

export const CLASSES = [
  {
    id: 'policier', name: 'Policier', role: 'Tank', ca: 12, caBonus: 2, caNote: '+2 si bouclier équipé',
    stats: { CON: 2, FOR: 1, DEX: -1 },
    pitch: 'Vous vous mettez entre le groupe et ce qui veut le dévorer.',
    skills: [
      { name: 'Provoquer', cost: 1, text: 'DD 12 Sagesse. Une entité provoquée ne peut attaquer que le Policier pendant 1 tour et passe en position défensive.' },
      { name: 'Position défensive', text: '+3 CA, mais ne peut pas attaquer. Sa vitesse est divisée par 2.' },
    ],
    inventory: [{ name: 'Bouclier anti-émeute', detail: '+2 CA' }, { name: 'Matraque', detail: '1d6 + Force' }],
  },
  {
    id: 'ingenieur', name: 'Ingénieur', role: 'Création', ca: 12,
    stats: { INT: 2, DEX: 1, CHA: -1 },
    pitch: 'Un tas de ferraille, dix minutes, et le groupe a une chance de plus.',
    skills: [
      { name: 'Arme improvisée', text: 'Fabrique une arme, les dégâts sont définis par 1d4 :', list: ['sur 1 ou 2 : 1d4 + Maîtrise', 'sur 3 ou 4 : 1d6 + Maîtrise'] },
      { name: 'Repérer un point faible', cost: 1, text: "Jet d'Intelligence contre Charisme." },
      { name: 'Piège improvisé', cost: 1, text: "10 minutes d'installation. Immobilise un ennemi et lui inflige 1d4 dégâts." },
    ],
    inventory: [{ name: 'Couteau suisse' }],
  },
  {
    id: 'voleur', name: 'Voleur', role: 'Discrétion', ca: 11,
    stats: { DEX: 2, SAG: 1, CON: -1 },
    pitch: 'Personne ne vous voit arriver. Surtout pas eux.',
    skills: [
      { name: 'Attaque sournoise', cost: 1, text: '+1d6 dégâts si la cible est distraite ou ne le voit pas.' },
      { name: "Tapi dans l'arbre", text: "Avantage au jet de Dextérité pour passer d'une cachette à une autre." },
    ],
    inventory: [{ name: 'Couteau', detail: '1d4 + Dextérité' }],
  },
  {
    id: 'medecin', name: 'Médecin', role: 'Support', ca: 11,
    stats: { SAG: 2, INT: 1, FOR: -1 },
    pitch: 'Tant que vous tenez debout, personne ne reste à terre.',
    skills: [
      { name: 'Stabiliser', cost: 1, text: 'Un allié à terre récupère 1 PV.' },
      { name: 'Fabrication de stims', text: 'Combine (Seringue + Médicament) pour fabriquer un stim.' },
    ],
    inventory: [{ name: 'Kit de soin', detail: '1d8 + Sagesse' }, { name: 'Stims ×2', detail: '+1d4 PV bonus et 1d4 sur n’importe quel jet pendant 5 tours' }],
  },
  {
    id: 'influenceur', name: 'Influenceur', role: 'Clown', ca: 12,
    stats: { CHA: 3, SAG: -1 },
    pitch: 'Le monde s’est effondré. Votre audience, elle, vous suit toujours.',
    skills: [
      { name: 'Diversion', text: 'DD 15 Sagesse, affectant les créatures ayant plus de 8 en Intelligence.' },
      { name: 'Motivation', cost: 1, text: 'Accorde un bonus de 1d4 à un allié.' },
    ],
    inventory: [{ name: 'Téléphone' }, { name: 'Kit de maquillage' }],
  },
  {
    id: 'motard', name: 'Motard', role: 'Dégâts', ca: 12, caBonus: 2, caNote: '+2 avec casque et gants',
    stats: { FOR: 2, CON: 1, INT: -1 },
    pitch: 'Quand ça tourne mal, c’est vous qui foncez dans le tas.',
    skills: [
      { name: 'Attaque multiple', cost: 1, text: 'Utilise son action bonus pour effectuer une attaque supplémentaire.' },
      { name: "Pro de l'improvisation", cost: 1, text: "En cas d'échec au toucher avec une arme improvisée, il peut ajouter 1d4 à son jet et ajouter 1 fatigue." },
      { name: 'Soif de bagarre', gain: 1, text: "S'il met le dernier coup à un ennemi, il peut l'exécuter en action bonus et perdre 1 fatigue." },
    ],
    inventory: [{ name: 'Casque moto + gants', detail: '+2 CA' }],
  },
];

export const ICONS = {
  policier: '<rect x="14" y="8" width="26" height="46" rx="5"/><path d="M19 17h16M27 22v26"/><path d="M44 18l12 38M41 25l7-2"/>',
  ingenieur: '<path d="M44 6a11 11 0 0 0-10 15L10 45a5 5 0 0 0 8 8l24-24a11 11 0 0 0 15-10l-7 6-6-2-2-6 6-7c-1-.3-3-.6-4-.6z"/><circle cx="14" cy="49" r="1.5"/><path d="M40 40l14 14M50 44l-6 6"/>',
  voleur: '<path d="M6 26c9-5 18-5 26 0 8-5 17-5 26 0-1 11-7 16-14 16-6 0-9-3-12-6-3 3-6 6-12 6-7 0-13-5-14-16z"/><ellipse cx="19" cy="31" rx="6" ry="3.5"/><ellipse cx="45" cy="31" rx="6" ry="3.5"/><path d="M26 48l-6 10M38 48l6 10"/>',
  medecin: '<g transform="rotate(-45 32 32)"><rect x="18" y="26" width="26" height="12" rx="2"/><path d="M44 32h8M52 26v12M18 32H6M24 26v5M30 26v5M36 26v5"/></g><path d="M48 6v12M42 12h12"/>',
  influenceur: '<circle cx="32" cy="30" r="22" stroke-dasharray="3 5"/><rect x="22" y="12" width="20" height="38" rx="3"/><path d="M29 16h6"/><circle cx="32" cy="30" r="5"/><circle cx="37" cy="44" r="1.6"/><path d="M26 56h12"/>',
  motard: '<path d="M10 42c0-16 10-28 24-28 12 0 20 9 20 22v8H32l-5 7H12z"/><path d="M30 26h24v10H30z"/><path d="M16 34c2-6 6-11 12-13"/>',
};

// « +2 », « −1 » (vrai signe moins), « 0 ».
export const signed = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
