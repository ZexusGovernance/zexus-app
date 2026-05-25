const BASE_POOL_GOAL  = 300
const BASE_MAX_AMOUNT = 60
const BASE_MIN_AMOUNT = 5

export function effectiveEmergencyConfig(scaleFactor: number) {
  const pool_goal   = Math.round(BASE_POOL_GOAL  * scaleFactor)
  const max_amount  = Math.round(BASE_MAX_AMOUNT * scaleFactor)
  const min_amount  = Math.max(1, Math.round(BASE_MIN_AMOUNT * scaleFactor))
  const min_wallets = Math.ceil(pool_goal / max_amount)
  return { pool_goal, max_amount, min_amount, min_wallets }
}
