import { recipes } from '../data/recipes'
import type { Ingredient, MealPlan, PantryItem, Recipe, Step } from '../types'

function sameAmountAvailable(ingredient: Ingredient, pantry: PantryItem[]) {
  if (ingredient.staple) return true
  const item = pantry.find((p) => p.name === ingredient.name)
  if (!item) return false
  if (item.unit !== ingredient.unit) return true
  return item.quantity >= ingredient.quantity
}

export function getMissingIngredients(recipeList: Recipe[], pantry: PantryItem[]): Ingredient[] {
  const grouped = new Map<string, Ingredient>()
  recipeList.flatMap((recipe) => recipe.ingredients).forEach((ingredient) => {
    if (sameAmountAvailable(ingredient, pantry)) return
    const key = `${ingredient.name}|${ingredient.unit}`
    const current = grouped.get(key)
    grouped.set(key, current ? { ...current, quantity: current.quantity + ingredient.quantity } : { ...ingredient })
  })
  return [...grouped.values()]
}

function combinedMinutes(main: Recipe, side: Recipe) {
  const overlapBenefit = side.steps.some((step) => step.passive) ? side.activeMinutes * 0.7 : side.activeMinutes * 0.35
  return Math.round(Math.max(main.estimatedMinutes, side.estimatedMinutes) + Math.max(1, overlapBenefit * 0.45))
}

export function buildPlans(pantry: PantryItem[], targetMinutes: number, pantryFirst = false): MealPlan[] {
  const mains = recipes.filter((r) => r.kind === 'main')
  const sides = recipes.filter((r) => r.kind === 'side')
  const plans: MealPlan[] = []

  for (const main of mains) {
    for (const side of sides) {
      const estimatedMinutes = combinedMinutes(main, side)
      const missing = getMissingIngredients([main, side], pantry)
      const ingredientCount = main.ingredients.filter((i) => !i.staple).length + side.ingredients.filter((i) => !i.staple).length
      const ownedCount = Math.max(0, ingredientCount - missing.filter((i) => !i.staple).length)
      const coverage = ingredientCount ? ownedCount / ingredientCount : 1
      const timePenalty = Math.max(0, estimatedMinutes - targetMinutes) * 7
      const pantryBonus = coverage * (pantryFirst ? 58 : 30)
      const popularity = (main.popularity + side.popularity) / 2
      const missingPenalty = missing.filter((i) => !i.staple).length * (pantryFirst ? 18 : 8)
      const score = popularity + pantryBonus - timePenalty - missingPenalty
      plans.push({
        id: `${main.id}__${side.id}`,
        main,
        side,
        estimatedMinutes,
        missing,
        score
      })
    }
  }
  return plans.sort((a, b) => b.score - a.score)
}

export function buildCookingSteps(plan: MealPlan): Array<Step & { recipeTitle: string }> {
  const sideSteps = plan.side.steps
  const passiveIndex = sideSteps.findIndex((step) => step.passive)

  if (passiveIndex >= 0) {
    return [
      ...sideSteps.slice(0, passiveIndex + 1).map((step) => ({ ...step, recipeTitle: plan.side.title })),
      ...plan.main.steps.map((step) => ({ ...step, recipeTitle: plan.main.title })),
      ...sideSteps.slice(passiveIndex + 1).map((step) => ({ ...step, recipeTitle: plan.side.title }))
    ]
  }

  return [
    ...sideSteps.slice(0, Math.min(2, sideSteps.length)).map((step) => ({ ...step, recipeTitle: plan.side.title })),
    ...plan.main.steps.map((step) => ({ ...step, recipeTitle: plan.main.title })),
    ...sideSteps.slice(Math.min(2, sideSteps.length)).map((step) => ({ ...step, recipeTitle: plan.side.title }))
  ]
}

export function formatIngredient(ingredient: Ingredient) {
  const q = Number.isInteger(ingredient.quantity) ? ingredient.quantity.toString() : ingredient.quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${ingredient.name} ${q}${ingredient.unit}`
}
