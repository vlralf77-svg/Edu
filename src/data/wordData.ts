// 영단어 데이터 — Dolch Sight Words + 카테고리별 기초 명사
// image 필드는 Capacitor assets 경로이며, 그림 리소스가 없는 경우
// emoji 필드로 대체 렌더링하여 앱이 즉시 동작하도록 구성했습니다.
// ko 필드는 정답 시 한글 전환/발음에 사용합니다.

export interface WordItem {
  id: string;
  word: string; // "apple"
  ko: string; // "사과" — 정답 시 한글 표시/발음
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
  ko: string,
  category: string,
  level: 1 | 2 | 3,
  distractors: string[],
): WordItem => ({
  id: `${category}-${word}`,
  word,
  ko,
  emoji,
  image: `/assets/images/${word}.png`,
  category,
  level,
  distractors,
});

export const wordData: WordItem[] = [
  // ── 과일 (fruits) ──
  w('apple', '🍎', '사과', 'fruits', 1, ['banana', 'grape']),
  w('banana', '🍌', '바나나', 'fruits', 1, ['apple', 'cherry']),
  w('grape', '🍇', '포도', 'fruits', 1, ['lemon', 'apple']),
  w('orange', '🍊', '오렌지', 'fruits', 1, ['apple', 'pear']),
  w('strawberry', '🍓', '딸기', 'fruits', 2, ['cherry', 'peach']),
  w('cherry', '🍒', '체리', 'fruits', 2, ['grape', 'apple']),
  w('watermelon', '🍉', '수박', 'fruits', 2, ['melon', 'apple']),
  w('lemon', '🍋', '레몬', 'fruits', 2, ['lime', 'orange']),
  w('peach', '🍑', '복숭아', 'fruits', 2, ['apple', 'pear']),
  w('pineapple', '🍍', '파인애플', 'fruits', 3, ['coconut', 'mango']),
  w('mango', '🥭', '망고', 'fruits', 3, ['peach', 'papaya']),
  w('pear', '🍐', '배', 'fruits', 2, ['apple', 'lemon']),
  w('kiwi', '🥝', '키위', 'fruits', 3, ['lime', 'melon']),
  w('coconut', '🥥', '코코넛', 'fruits', 3, ['pineapple', 'mango']),

  // ── 동물 (animals) ──
  w('dog', '🐶', '강아지', 'animals', 1, ['cat', 'pig']),
  w('cat', '🐱', '고양이', 'animals', 1, ['dog', 'cow']),
  w('pig', '🐷', '돼지', 'animals', 1, ['cow', 'dog']),
  w('cow', '🐮', '소', 'animals', 1, ['pig', 'horse']),
  w('horse', '🐴', '말', 'animals', 2, ['cow', 'donkey']),
  w('lion', '🦁', '사자', 'animals', 2, ['tiger', 'cat']),
  w('tiger', '🐯', '호랑이', 'animals', 2, ['lion', 'cat']),
  w('elephant', '🐘', '코끼리', 'animals', 2, ['hippo', 'rhino']),
  w('monkey', '🐵', '원숭이', 'animals', 2, ['gorilla', 'bear']),
  w('rabbit', '🐰', '토끼', 'animals', 1, ['mouse', 'cat']),
  w('bear', '🐻', '곰', 'animals', 2, ['panda', 'dog']),
  w('panda', '🐼', '판다', 'animals', 2, ['bear', 'koala']),
  w('frog', '🐸', '개구리', 'animals', 2, ['turtle', 'fish']),
  w('chicken', '🐔', '닭', 'animals', 2, ['duck', 'bird']),
  w('duck', '🦆', '오리', 'animals', 2, ['chicken', 'swan']),
  w('fish', '🐟', '물고기', 'animals', 1, ['whale', 'crab']),
  w('whale', '🐳', '고래', 'animals', 3, ['dolphin', 'shark']),
  w('penguin', '🐧', '펭귄', 'animals', 3, ['seal', 'bird']),
  w('owl', '🦉', '부엉이', 'animals', 3, ['eagle', 'bird']),
  w('bee', '🐝', '벌', 'animals', 2, ['ant', 'fly']),
  w('snail', '🐌', '달팽이', 'animals', 3, ['worm', 'slug']),
  w('giraffe', '🦒', '기린', 'animals', 3, ['zebra', 'horse']),
  w('zebra', '🦓', '얼룩말', 'animals', 3, ['horse', 'donkey']),
  w('fox', '🦊', '여우', 'animals', 2, ['wolf', 'dog']),
  w('mouse', '🐭', '쥐', 'animals', 1, ['rat', 'rabbit']),
  w('turtle', '🐢', '거북이', 'animals', 2, ['frog', 'snail']),

  // ── 음식 (food) ──
  w('cake', '🍰', '케이크', 'food', 1, ['pie', 'bread']),
  w('bread', '🍞', '빵', 'food', 1, ['cake', 'rice']),
  w('egg', '🥚', '달걀', 'food', 1, ['milk', 'bread']),
  w('milk', '🥛', '우유', 'food', 1, ['water', 'juice']),
  w('cheese', '🧀', '치즈', 'food', 2, ['butter', 'egg']),
  w('pizza', '🍕', '피자', 'food', 2, ['burger', 'pasta']),
  w('burger', '🍔', '햄버거', 'food', 2, ['pizza', 'fries']),
  w('icecream', '🍦', '아이스크림', 'food', 2, ['cake', 'candy']),
  w('candy', '🍬', '사탕', 'food', 1, ['cookie', 'cake']),
  w('cookie', '🍪', '쿠키', 'food', 2, ['candy', 'cake']),
  w('rice', '🍚', '밥', 'food', 2, ['bread', 'noodle']),
  w('honey', '🍯', '꿀', 'food', 3, ['jam', 'milk']),
  w('carrot', '🥕', '당근', 'food', 2, ['potato', 'onion']),
  w('corn', '🌽', '옥수수', 'food', 2, ['pea', 'bean']),
  w('tomato', '🍅', '토마토', 'food', 2, ['apple', 'pepper']),

  // ── 탈것 (vehicles) ──
  w('car', '🚗', '자동차', 'vehicles', 1, ['bus', 'bike']),
  w('bus', '🚌', '버스', 'vehicles', 1, ['car', 'truck']),
  w('train', '🚆', '기차', 'vehicles', 2, ['bus', 'tram']),
  w('plane', '✈️', '비행기', 'vehicles', 2, ['ship', 'rocket']),
  w('ship', '🚢', '배', 'vehicles', 2, ['boat', 'plane']),
  w('boat', '⛵', '보트', 'vehicles', 2, ['ship', 'car']),
  w('bike', '🚲', '자전거', 'vehicles', 1, ['car', 'scooter']),
  w('truck', '🚚', '트럭', 'vehicles', 2, ['bus', 'van']),
  w('rocket', '🚀', '로켓', 'vehicles', 3, ['plane', 'ship']),
  w('helicopter', '🚁', '헬리콥터', 'vehicles', 3, ['plane', 'rocket']),
  w('taxi', '🚕', '택시', 'vehicles', 2, ['bus', 'car']),
  w('police', '🚓', '경찰차', 'vehicles', 3, ['taxi', 'car']),
  w('firetruck', '🚒', '소방차', 'vehicles', 3, ['truck', 'bus']),
  w('tractor', '🚜', '트랙터', 'vehicles', 3, ['truck', 'car']),

  // ── 자연 (nature) ──
  w('sun', '☀️', '해', 'nature', 1, ['moon', 'star']),
  w('moon', '🌙', '달', 'nature', 1, ['sun', 'star']),
  w('star', '⭐', '별', 'nature', 1, ['sun', 'moon']),
  w('cloud', '☁️', '구름', 'nature', 1, ['rain', 'sun']),
  w('rain', '🌧️', '비', 'nature', 2, ['snow', 'cloud']),
  w('snow', '❄️', '눈', 'nature', 2, ['rain', 'ice']),
  w('tree', '🌳', '나무', 'nature', 1, ['flower', 'bush']),
  w('flower', '🌸', '꽃', 'nature', 1, ['tree', 'leaf']),
  w('leaf', '🍃', '나뭇잎', 'nature', 2, ['flower', 'tree']),
  w('mountain', '⛰️', '산', 'nature', 3, ['hill', 'rock']),
  w('rainbow', '🌈', '무지개', 'nature', 2, ['cloud', 'sun']),
  w('fire', '🔥', '불', 'nature', 2, ['water', 'ice']),
  w('water', '💧', '물', 'nature', 1, ['fire', 'air']),
  w('volcano', '🌋', '화산', 'nature', 3, ['mountain', 'hill']),
  w('cactus', '🌵', '선인장', 'nature', 3, ['tree', 'plant']),
  w('mushroom', '🍄', '버섯', 'nature', 2, ['flower', 'tree']),

  // ── 사물 (objects) ──
  w('ball', '⚽', '공', 'objects', 1, ['box', 'book']),
  w('book', '📖', '책', 'objects', 1, ['ball', 'pen']),
  w('pen', '🖊️', '펜', 'objects', 1, ['book', 'cup']),
  w('cup', '☕', '컵', 'objects', 1, ['pen', 'plate']),
  w('clock', '🕐', '시계', 'objects', 2, ['watch', 'bell']),
  w('key', '🔑', '열쇠', 'objects', 2, ['lock', 'pen']),
  w('phone', '📱', '휴대폰', 'objects', 2, ['tablet', 'tv']),
  w('camera', '📷', '카메라', 'objects', 3, ['phone', 'tv']),
  w('umbrella', '☂️', '우산', 'objects', 2, ['hat', 'coat']),
  w('gift', '🎁', '선물', 'objects', 1, ['box', 'ball']),
  w('balloon', '🎈', '풍선', 'objects', 1, ['ball', 'kite']),
  w('kite', '🪁', '연', 'objects', 2, ['balloon', 'ball']),
  w('drum', '🥁', '드럼', 'objects', 2, ['guitar', 'piano']),
  w('guitar', '🎸', '기타', 'objects', 3, ['drum', 'piano']),
  w('bell', '🔔', '종', 'objects', 2, ['clock', 'horn']),
  w('lamp', '💡', '전등', 'objects', 2, ['candle', 'sun']),
  w('scissors', '✂️', '가위', 'objects', 3, ['knife', 'pen']),
  w('hammer', '🔨', '망치', 'objects', 3, ['saw', 'nail']),

  // ── 옷 (clothes) ──
  w('hat', '🎩', '모자', 'clothes', 1, ['cap', 'shoe']),
  w('shoe', '👟', '신발', 'clothes', 1, ['sock', 'hat']),
  w('shirt', '👕', '셔츠', 'clothes', 2, ['pants', 'coat']),
  w('pants', '👖', '바지', 'clothes', 2, ['shirt', 'skirt']),
  w('dress', '👗', '원피스', 'clothes', 2, ['skirt', 'shirt']),
  w('sock', '🧦', '양말', 'clothes', 2, ['shoe', 'glove']),
  w('glove', '🧤', '장갑', 'clothes', 3, ['sock', 'scarf']),
  w('scarf', '🧣', '목도리', 'clothes', 3, ['glove', 'hat']),
  w('coat', '🧥', '외투', 'clothes', 3, ['shirt', 'dress']),
  w('crown', '👑', '왕관', 'clothes', 2, ['hat', 'ring']),

  // ── 몸 (body) ──
  w('eye', '👁️', '눈', 'body', 1, ['ear', 'nose']),
  w('ear', '👂', '귀', 'body', 1, ['eye', 'nose']),
  w('nose', '👃', '코', 'body', 1, ['eye', 'mouth']),
  w('hand', '✋', '손', 'body', 1, ['foot', 'ear']),
  w('foot', '🦶', '발', 'body', 2, ['hand', 'leg']),
  w('tooth', '🦷', '이', 'body', 2, ['tongue', 'ear']),
  w('hair', '💇', '머리카락', 'body', 3, ['hand', 'face']),
  w('heart', '❤️', '하트', 'body', 1, ['hand', 'eye']),
];

// 레벨별 필터링 헬퍼
export const getWordsByLevel = (level: 1 | 2 | 3): WordItem[] =>
  wordData.filter((item) => item.level <= level);
