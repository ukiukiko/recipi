import type { Recipe } from '../types'

export const recipes: Recipe[] = [
  {
    id: 'chicken-tofu-nuggets',
    title: '鶏むね豆腐ナゲット',
    kind: 'main',
    estimatedMinutes: 32,
    activeMinutes: 22,
    popularity: 92,
    tags: ['鶏むね', '節約', '子ども向け', 'フライパン'],
    ingredients: [
      { name: '鶏むね肉', quantity: 550, unit: 'g', category: '肉・魚' },
      { name: '木綿豆腐', quantity: 150, unit: 'g', category: '豆・卵' },
      { name: '卵', quantity: 1, unit: '個', category: '豆・卵' },
      { name: '片栗粉', quantity: 36, unit: 'g', category: '調味料', staple: true },
      { name: '鶏がらスープの素', quantity: 4, unit: 'g', category: '調味料', staple: true },
      { name: '醤油', quantity: 9, unit: 'g', category: '調味料', staple: true },
      { name: '油', quantity: 15, unit: 'g', category: '調味料', staple: true }
    ],
    steps: [
      { id: 'n1', title: '豆腐の水気を切る', detail: 'キッチンペーパーで包み、軽く押さえます。', minutes: 2 },
      { id: 'n2', title: '鶏むね肉を細かく切る', detail: '1cm角程度。粗めでもOKです。', minutes: 6 },
      {
        id: 'n3', title: 'ナゲット生地を混ぜる', detail: 'ボウル1つで粘りが出るまで混ぜます。', minutes: 4,
        ingredients: [
          { name: '木綿豆腐', quantity: 150, unit: 'g', category: '豆・卵' },
          { name: '卵', quantity: 1, unit: '個', category: '豆・卵' },
          { name: '片栗粉', quantity: 36, unit: 'g', category: '調味料' },
          { name: '鶏がらスープの素', quantity: 4, unit: 'g', category: '調味料' },
          { name: '醤油', quantity: 9, unit: 'g', category: '調味料' }
        ]
      },
      { id: 'n4', title: 'フライパンを温める', detail: '油を広げ、中火にします。', minutes: 2, ingredients: [{ name: '油', quantity: 15, unit: 'g', category: '調味料' }] },
      { id: 'n5', title: '片面を焼く', detail: 'スプーンで落とし、形を整えます。', minutes: 6, timerMin: 6 },
      { id: 'n6', title: '裏返して仕上げる', detail: '火が通るまで焼きます。', minutes: 6, timerMin: 6 }
    ]
  },
  {
    id: 'pork-ginger',
    title: '豚こま生姜焼き',
    kind: 'main',
    estimatedMinutes: 22,
    activeMinutes: 18,
    popularity: 87,
    tags: ['豚肉', '時短', 'フライパン'],
    ingredients: [
      { name: '豚こま肉', quantity: 300, unit: 'g', category: '肉・魚' },
      { name: '玉ねぎ', quantity: 1, unit: '個', category: '野菜' },
      { name: '醤油', quantity: 18, unit: 'g', category: '調味料', staple: true },
      { name: 'みりん', quantity: 18, unit: 'g', category: '調味料', staple: true },
      { name: '酒', quantity: 15, unit: 'g', category: '調味料', staple: true },
      { name: 'しょうが', quantity: 8, unit: 'g', category: '調味料', staple: true }
    ],
    steps: [
      { id: 'p1', title: '玉ねぎを薄切りにする', minutes: 4 },
      { id: 'p2', title: 'タレをまとめて計量', minutes: 2, ingredients: [
        { name: '醤油', quantity: 18, unit: 'g', category: '調味料' },
        { name: 'みりん', quantity: 18, unit: 'g', category: '調味料' },
        { name: '酒', quantity: 15, unit: 'g', category: '調味料' },
        { name: 'しょうが', quantity: 8, unit: 'g', category: '調味料' }
      ] },
      { id: 'p3', title: '豚肉と玉ねぎを炒める', detail: '中火で火を通します。', minutes: 8, timerMin: 8 },
      { id: 'p4', title: 'タレを絡める', detail: '汁気が少なくなるまで1〜2分。', minutes: 2 }
    ]
  },
  {
    id: 'salmon-butter',
    title: '鮭のバター醤油焼き',
    kind: 'main',
    estimatedMinutes: 20,
    activeMinutes: 14,
    popularity: 82,
    tags: ['魚', '時短', 'フライパン'],
    ingredients: [
      { name: '鮭', quantity: 2, unit: '切', category: '肉・魚' },
      { name: 'しめじ', quantity: 100, unit: 'g', category: '野菜' },
      { name: 'バター', quantity: 12, unit: 'g', category: '調味料' },
      { name: '醤油', quantity: 12, unit: 'g', category: '調味料', staple: true }
    ],
    steps: [
      { id: 's1', title: 'しめじをほぐす', minutes: 2 },
      { id: 's2', title: '鮭を焼く', detail: 'フライパンで片面から焼きます。', minutes: 6, timerMin: 6 },
      { id: 's3', title: '裏返してしめじを加える', minutes: 5, timerMin: 5 },
      { id: 's4', title: 'バター醤油を絡める', minutes: 2, ingredients: [
        { name: 'バター', quantity: 12, unit: 'g', category: '調味料' },
        { name: '醤油', quantity: 12, unit: 'g', category: '調味料' }
      ] }
    ]
  },
  {
    id: 'cabbage-tare',
    title: 'キャベツのタレ和え',
    kind: 'side',
    estimatedMinutes: 14,
    activeMinutes: 6,
    popularity: 90,
    tags: ['キャベツ', '火を使わない', '作り置き'],
    ingredients: [
      { name: 'キャベツ', quantity: 0.25, unit: '玉', category: '野菜' },
      { name: '醤油', quantity: 9, unit: 'g', category: '調味料', staple: true },
      { name: 'ごま油', quantity: 12, unit: 'g', category: '調味料', staple: true },
      { name: '酢', quantity: 10, unit: 'g', category: '調味料', staple: true },
      { name: '砂糖', quantity: 4, unit: 'g', category: '調味料', staple: true }
    ],
    steps: [
      { id: 'c1', title: 'タレを先に作る', detail: 'ボウルに全部まとめて入れます。', minutes: 2, ingredients: [
        { name: '醤油', quantity: 9, unit: 'g', category: '調味料' },
        { name: 'ごま油', quantity: 12, unit: 'g', category: '調味料' },
        { name: '酢', quantity: 10, unit: 'g', category: '調味料' },
        { name: '砂糖', quantity: 4, unit: 'g', category: '調味料' }
      ] },
      { id: 'c2', title: 'キャベツを切って和える', detail: 'ざく切りにしてタレと混ぜます。', minutes: 4 },
      { id: 'c3', title: 'キャベツを置く', detail: '味をなじませます。この間に主菜へ進みます。', minutes: 8, passive: true, timerMin: 8 },
      { id: 'c4', title: 'キャベツを盛り付ける', minutes: 1 }
    ]
  },
  {
    id: 'cucumber-salt',
    title: 'きゅうり塩だれ',
    kind: 'side',
    estimatedMinutes: 8,
    activeMinutes: 5,
    popularity: 84,
    tags: ['きゅうり', '火を使わない', '5分'],
    ingredients: [
      { name: 'きゅうり', quantity: 2, unit: '本', category: '野菜' },
      { name: 'ごま油', quantity: 10, unit: 'g', category: '調味料', staple: true },
      { name: '鶏がらスープの素', quantity: 3, unit: 'g', category: '調味料', staple: true },
      { name: '塩', quantity: 1, unit: 'g', category: '調味料', staple: true }
    ],
    steps: [
      { id: 'q1', title: 'きゅうりを叩いて割る', minutes: 2 },
      { id: 'q2', title: '調味料と和える', minutes: 2, ingredients: [
        { name: 'ごま油', quantity: 10, unit: 'g', category: '調味料' },
        { name: '鶏がらスープの素', quantity: 3, unit: 'g', category: '調味料' },
        { name: '塩', quantity: 1, unit: 'g', category: '調味料' }
      ] },
      { id: 'q3', title: '盛り付ける', minutes: 1 }
    ]
  },
  {
    id: 'pepper-microwave',
    title: 'レンジ無限ピーマン',
    kind: 'side',
    estimatedMinutes: 9,
    activeMinutes: 5,
    popularity: 88,
    tags: ['ピーマン', 'レンジ', '時短'],
    ingredients: [
      { name: 'ピーマン', quantity: 5, unit: '個', category: '野菜' },
      { name: 'ツナ缶', quantity: 1, unit: '缶', category: 'その他' },
      { name: '鶏がらスープの素', quantity: 3, unit: 'g', category: '調味料', staple: true },
      { name: 'ごま油', quantity: 6, unit: 'g', category: '調味料', staple: true }
    ],
    steps: [
      { id: 'g1', title: 'ピーマンを細切りにする', minutes: 3 },
      { id: 'g2', title: '材料を耐熱容器に入れる', minutes: 1, ingredients: [
        { name: 'ツナ缶', quantity: 1, unit: '缶', category: 'その他' },
        { name: '鶏がらスープの素', quantity: 3, unit: 'g', category: '調味料' },
        { name: 'ごま油', quantity: 6, unit: 'g', category: '調味料' }
      ] },
      { id: 'g3', title: 'レンジ加熱', detail: '600Wで約3分。', minutes: 3, timerMin: 3, passive: true },
      { id: 'g4', title: '混ぜて盛り付ける', minutes: 1 }
    ]
  }
]
