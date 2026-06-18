// 영단어 데이터 — Dolch Sight Words + 카테고리별 기초 명사
// image 필드는 Capacitor assets 경로이며, 그림 리소스가 없는 경우
// emoji 필드로 대체 렌더링하여 앱이 즉시 동작하도록 구성했습니다.

export interface WordItem {
  id: string;
  word: string; // "apple"
  emoji: string; // "🍎" — 그림 리소스 대체용
  image: string; // "/assets/images/apple.png"
  category: string; // "fruits"
  level: 1 | 2 | 3; // 난이도
  distractors: string[]; // 오답 보기 ["banana", "orange"]
}

// 헬퍼: 반복 보일러플레이트를 줄이기 위한 팩토리
const w = (
  word: string,
  emoji: string,
  category: string,
  level: 1 | 2 | 3,
  distractors: string[],
): WordItem => ({
  id: `${category}-${word}`,
  word,
  emoji,
  image: `/assets/images/${word}.png`,
  category,
  level,
  distractors,
});

export const wordData: WordItem[] = [
  // ── 과일 (fruits) ──
  w('apple', '🍎', 'fruits', 1, ['banana', 'grape']),
  w('banana', '🍌', 'fruits', 1, ['apple', 'cherry']),
  w('grape', '🍇', 'fruits', 1, ['lemon', 'apple']),
  w('orange', '🍊', 'fruits', 1, ['apple', 'pear']),
  w('strawberry', '🍓', 'fruits', 2, ['cherry', 'peach']),
  w('cherry', '🍒', 'fruits', 2, ['grape', 'apple']),
  w('watermelon', '🍉', 'fruits', 2, ['melon', 'apple']),
  w('lemon', '🍋', 'fruits', 2, ['lime', 'orange']),
  w('peach', '🍑', 'fruits', 2, ['apple', 'pear']),
  w('pineapple', '🍍', 'fruits', 3, ['coconut', 'mango']),
  w('mango', '🥭', 'fruits', 3, ['peach', 'papaya']),
  w('pear', '🍐', 'fruits', 2, ['apple', 'lemon']),
  w('kiwi', '🥝', 'fruits', 3, ['lime', 'melon']),
  w('coconut', '🥥', 'fruits', 3, ['pineapple', 'mango']),

  // ── 동물 (animals) ──
  w('dog', '🐶', 'animals', 1, ['cat', 'pig']),
  w('cat', '🐱', 'animals', 1, ['dog', 'cow']),
  w('pig', '🐷', 'animals', 1, ['cow', 'dog']),
  w('cow', '🐮', 'animals', 1, ['pig', 'horse']),
  w('horse', '🐴', 'animals', 2, ['cow', 'donkey']),
  w('lion', '🦁', 'animals', 2, ['tiger', 'cat']),
  w('tiger', '🐯', 'animals', 2, ['lion', 'cat']),
  w('elephant', '🐘', 'animals', 2, ['hippo', 'rhino']),
  w('monkey', '🐵', 'animals', 2, ['gorilla', 'bear']),
  w('rabbit', '🐰', 'animals', 1, ['mouse', 'cat']),
  w('bear', '🐻', 'animals', 2, ['panda', 'dog']),
  w('panda', '🐼', 'animals', 2, ['bear', 'koala']),
  w('frog', '🐸', 'animals', 2, ['turtle', 'fish']),
  w('chicken', '🐔', 'animals', 2, ['duck', 'bird']),
  w('duck', '🦆', 'animals', 2, ['chicken', 'swan']),
  w('fish', '🐟', 'animals', 1, ['whale', 'crab']),
  w('whale', '🐳', 'animals', 3, ['dolphin', 'shark']),
  w('penguin', '🐧', 'animals', 3, ['seal', 'bird']),
  w('owl', '🦉', 'animals', 3, ['eagle', 'bird']),
  w('bee', '🐝', 'animals', 2, ['ant', 'fly']),
  w('snail', '🐌', 'animals', 3, ['worm', 'slug']),
  w('giraffe', '🦒', 'animals', 3, ['zebra', 'horse']),
  w('zebra', '🦓', 'animals', 3, ['horse', 'donkey']),
  w('fox', '🦊', 'animals', 2, ['wolf', 'dog']),
  w('mouse', '🐭', 'animals', 1, ['rat', 'rabbit']),
  w('turtle', '🐢', 'animals', 2, ['frog', 'snail']),

  // ── 음식 (food) ──
  w('cake', '🍰', 'food', 1, ['pie', 'bread']),
  w('bread', '🍞', 'food', 1, ['cake', 'rice']),
  w('egg', '🥚', 'food', 1, ['milk', 'bread']),
  w('milk', '🥛', 'food', 1, ['water', 'juice']),
  w('cheese', '🧀', 'food', 2, ['butter', 'egg']),
  w('pizza', '🍕', 'food', 2, ['burger', 'pasta']),
  w('burger', '🍔', 'food', 2, ['pizza', 'fries']),
  w('icecream', '🍦', 'food', 2, ['cake', 'candy']),
  w('candy', '🍬', 'food', 1, ['cookie', 'cake']),
  w('cookie', '🍪', 'food', 2, ['candy', 'cake']),
  w('rice', '🍚', 'food', 2, ['bread', 'noodle']),
  w('honey', '🍯', 'food', 3, ['jam', 'milk']),
  w('carrot', '🥕', 'food', 2, ['potato', 'onion']),
  w('corn', '🌽', 'food', 2, ['pea', 'bean']),
  w('tomato', '🍅', 'food', 2, ['apple', 'pepper']),

  // ── 탈것 (vehicles) ──
  w('car', '🚗', 'vehicles', 1, ['bus', 'bike']),
  w('bus', '🚌', 'vehicles', 1, ['car', 'truck']),
  w('train', '🚆', 'vehicles', 2, ['bus', 'tram']),
  w('plane', '✈️', 'vehicles', 2, ['ship', 'rocket']),
  w('ship', '🚢', 'vehicles', 2, ['boat', 'plane']),
  w('boat', '⛵', 'vehicles', 2, ['ship', 'car']),
  w('bike', '🚲', 'vehicles', 1, ['car', 'scooter']),
  w('truck', '🚚', 'vehicles', 2, ['bus', 'van']),
  w('rocket', '🚀', 'vehicles', 3, ['plane', 'ship']),
  w('helicopter', '🚁', 'vehicles', 3, ['plane', 'rocket']),
  w('taxi', '🚕', 'vehicles', 2, ['bus', 'car']),
  w('police', '🚓', 'vehicles', 3, ['taxi', 'car']),
  w('fire', '🚒', 'vehicles', 3, ['truck', 'bus']),
  w('tractor', '🚜', 'vehicles', 3, ['truck', 'car']),

  // ── 자연 (nature) ──
  w('sun', '☀️', 'nature', 1, ['moon', 'star']),
  w('moon', '🌙', 'nature', 1, ['sun', 'star']),
  w('star', '⭐', 'nature', 1, ['sun', 'moon']),
  w('cloud', '☁️', 'nature', 1, ['rain', 'sun']),
  w('rain', '🌧️', 'nature', 2, ['snow', 'cloud']),
  w('snow', '❄️', 'nature', 2, ['rain', 'ice']),
  w('tree', '🌳', 'nature', 1, ['flower', 'bush']),
  w('flower', '🌸', 'nature', 1, ['tree', 'leaf']),
  w('leaf', '🍃', 'nature', 2, ['flower', 'tree']),
  w('mountain', '⛰️', 'nature', 3, ['hill', 'rock']),
  w('rainbow', '🌈', 'nature', 2, ['cloud', 'sun']),
  w('fire2', '🔥', 'nature', 2, ['water', 'ice']),
  w('water', '💧', 'nature', 1, ['fire', 'air']),
  w('volcano', '🌋', 'nature', 3, ['mountain', 'hill']),
  w('cactus', '🌵', 'nature', 3, ['tree', 'plant']),
  w('mushroom', '🍄', 'nature', 2, ['flower', 'tree']),

  // ── 사물 (objects) ──
  w('ball', '⚽', 'objects', 1, ['box', 'book']),
  w('book', '📖', 'objects', 1, ['ball', 'pen']),
  w('pen', '🖊️', 'objects', 1, ['book', 'cup']),
  w('cup', '☕', 'objects', 1, ['pen', 'plate']),
  w('clock', '🕐', 'objects', 2, ['watch', 'bell']),
  w('key', '🔑', 'objects', 2, ['lock', 'pen']),
  w('phone', '📱', 'objects', 2, ['tablet', 'tv']),
  w('camera', '📷', 'objects', 3, ['phone', 'tv']),
  w('umbrella', '☂️', 'objects', 2, ['hat', 'coat']),
  w('gift', '🎁', 'objects', 1, ['box', 'ball']),
  w('balloon', '🎈', 'objects', 1, ['ball', 'kite']),
  w('kite', '🪁', 'objects', 2, ['balloon', 'ball']),
  w('drum', '🥁', 'objects', 2, ['guitar', 'piano']),
  w('guitar', '🎸', 'objects', 3, ['drum', 'piano']),
  w('bell', '🔔', 'objects', 2, ['clock', 'horn']),
  w('lamp', '💡', 'objects', 2, ['candle', 'sun']),
  w('scissors', '✂️', 'objects', 3, ['knife', 'pen']),
  w('hammer', '🔨', 'objects', 3, ['saw', 'nail']),

  // ── 옷 (clothes) ──
  w('hat', '🎩', 'clothes', 1, ['cap', 'shoe']),
  w('shoe', '👟', 'clothes', 1, ['sock', 'hat']),
  w('shirt', '👕', 'clothes', 2, ['pants', 'coat']),
  w('pants', '👖', 'clothes', 2, ['shirt', 'skirt']),
  w('dress', '👗', 'clothes', 2, ['skirt', 'shirt']),
  w('sock', '🧦', 'clothes', 2, ['shoe', 'glove']),
  w('glove', '🧤', 'clothes', 3, ['sock', 'scarf']),
  w('scarf', '🧣', 'clothes', 3, ['glove', 'hat']),
  w('coat', '🧥', 'clothes', 3, ['shirt', 'dress']),
  w('crown', '👑', 'clothes', 2, ['hat', 'ring']),

  // ── 몸 (body) ──
  w('eye', '👁️', 'body', 1, ['ear', 'nose']),
  w('ear', '👂', 'body', 1, ['eye', 'nose']),
  w('nose', '👃', 'body', 1, ['eye', 'mouth']),
  w('hand', '✋', 'body', 1, ['foot', 'ear']),
  w('foot', '🦶', 'body', 2, ['hand', 'leg']),
  w('tooth', '🦷', 'body', 2, ['tongue', 'ear']),
  w('hair', '💇', 'body', 3, ['hand', 'face']),
  w('heart', '❤️', 'body', 1, ['hand', 'eye']),
];

// 레벨별 필터링 헬퍼
export const getWordsByLevel = (level: 1 | 2 | 3): WordItem[] =>
  wordData.filter((item) => item.level <= level);
