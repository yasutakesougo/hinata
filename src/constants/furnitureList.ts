export interface FurnitureItem {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  requiredReward: string;
}

export const FURNITURE_LIST: FurnitureItem[] = [
  { id: 'stump_chair', name: 'きりかぶの いす', emoji: '🪵', desc: 'どうぶつたちが すわれる 丸いイス。', requiredReward: 'ぴょんうさぎ' },
  { id: 'mushroom', name: 'カラフルな キノコ', emoji: '🍄', desc: '赤くてかわいい 大きなキノコ。', requiredReward: 'おしゃべりオウム' },
  { id: 'tent', name: 'ちいさな テント', emoji: '⛺', desc: '中に入れる ひみつのテント。', requiredReward: 'まねきねこ' },
  { id: 'flowerbed', name: 'もりの はなだん', emoji: '🌺', desc: 'きれいなお花が たくさん咲くよ。', requiredReward: 'うきうきさる' },
  { id: 'spring_water', name: 'しずくの いずみ', emoji: '⛲', desc: 'きれいな水が わきでる 泉。', requiredReward: 'もぐもぐハムスター' },
  { id: 'blackboard', name: 'おえかき こくばん', emoji: '🎨', desc: 'お絵かきや 算数のお勉強ができるよ。', requiredReward: 'さんすうパンダ' },
  { id: 'throne', name: 'ドラゴンの おうざ', emoji: '👑', desc: '金色にピカピカ光る 豪華なイス。', requiredReward: 'くだものドラゴン' }
];
