// ตรรกะลูกเต๋า — แยกออกจาก UI เพื่อทดสอบได้ง่าย

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ทอย 6 = ได้ทอยซ้ำ (โบนัส)
export function isBonusRoll(value: number): boolean {
  return value === 6;
}
