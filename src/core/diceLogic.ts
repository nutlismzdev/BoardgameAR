// ตรรกะลูกเต๋า — แยกออกจาก UI เพื่อทดสอบได้ง่าย

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}
