export type IngredientCategory = '肉・魚' | '野菜' | '豆・卵' | '調味料' | 'その他'

export type Ingredient = {
  name: string
  quantity: number
  unit: string
  category: IngredientCategory
  staple?: boolean
}

export type Step = {
  id: string
  title: string
  detail?: string
  minutes?: number
  passive?: boolean
  timerMin?: number
  ingredients?: Ingredient[]
}

export type Recipe = {
  id: string
  title: string
  kind: 'main' | 'side'
  estimatedMinutes: number
  activeMinutes: number
  popularity: number
  tags: string[]
  ingredients: Ingredient[]
  steps: Step[]
}

export type PantryItem = Ingredient & { id: string }

export type MealPlan = {
  id: string
  main: Recipe
  side: Recipe
  estimatedMinutes: number
  score: number
  missing: Ingredient[]
}

export type AppState = {
  pantry: PantryItem[]
  favoriteRecipeIds: string[]
  selectedPlanId?: string
  shoppingChecked: string[]
}
