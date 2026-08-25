// 한국인 대표 음식 영양정보 미니 DB (100g 기준 근사값 — MVP용 샘플)
export interface FoodItem {
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  unit: string; // 1인분 기준 설명
}

export const FOODS: FoodItem[] = [
  { name: '닭가슴살(구운)', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, unit: '100g' },
  { name: '흰밥', kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, unit: '100g' },
  { name: '현미밥', kcal: 111, proteinG: 2.6, carbsG: 23, fatG: 0.9, unit: '100g' },
  { name: '고구마(찐)', kcal: 128, proteinG: 1.6, carbsG: 30, fatG: 0.2, unit: '100g' },
  { name: '계란(삶은)', kcal: 78, proteinG: 6, carbsG: 0.6, fatG: 5.3, unit: '1개' },
  { name: '바나나', kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, unit: '1개(100g)' },
  { name: '두부(부침용)', kcal: 84, proteinG: 8, carbsG: 2, fatG: 5, unit: '100g' },
  { name: '연어(구운)', kcal: 208, proteinG: 22, carbsG: 0, fatG: 13, unit: '100g' },
  { name: '소고기 안심', kcal: 174, proteinG: 21, carbsG: 0, fatG: 9, unit: '100g' },
  { name: '오트밀', kcal: 68, proteinG: 2.4, carbsG: 12, fatG: 1.4, unit: '100g(조리후)' },
  { name: '그릭요거트', kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4, unit: '100g' },
  { name: '아몬드', kcal: 579, proteinG: 21, carbsG: 22, fatG: 50, unit: '100g' },
  { name: '브로콜리(찐)', kcal: 35, proteinG: 2.4, carbsG: 7, fatG: 0.4, unit: '100g' },
  { name: '샐러드(잎채소)', kcal: 15, proteinG: 1.4, carbsG: 2.9, fatG: 0.2, unit: '100g' },
  { name: '아메리카노', kcal: 5, proteinG: 0, carbsG: 1, fatG: 0, unit: '1잔' },
  { name: '프로틴 쉐이크', kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5, unit: '1스쿱' },
  { name: '김치찌개', kcal: 130, proteinG: 8, carbsG: 6, fatG: 8, unit: '1인분(300g)' },
  { name: '비빔밥', kcal: 560, proteinG: 20, carbsG: 90, fatG: 12, unit: '1인분' },
  { name: '삼겹살', kcal: 331, proteinG: 17, carbsG: 0, fatG: 28, unit: '100g' },
  { name: '라면', kcal: 500, proteinG: 10, carbsG: 76, fatG: 17, unit: '1봉' },
];
