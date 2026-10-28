// Cent → "12,50 €"
export function formatEuro(cents: number) {
  return (cents / 100).toLocaleString('de-AT', { style: 'currency', currency: 'EUR' });
}

// "12,50" oder "12.5" → 1250 Cent (oder null, wenn ungültig)
export function parseAmount(text: string): number | null {
  const normalized = text.replace(/\s/g, '').replace('€', '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(parseFloat(normalized) * 100);
  return cents > 0 ? cents : null;
}

// Wie parseAmount, aber 0 und leeres Feld sind erlaubt (für einzelne Anteile)
export function parseShare(text: string): number | null {
  if (text.trim() === '') return 0;
  const normalized = text.replace(/\s/g, '').replace('€', '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

export type Balance = { user_id: string; balance_cents: number };
export type Transfer = { from: string; to: string; amount: number };

// Aus den Salden möglichst wenige Überweisungen berechnen
export function simplifyDebts(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.balance_cents > 0)
    .map((b) => ({ id: b.user_id, amount: b.balance_cents }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.balance_cents < 0)
    .map((b) => ({ id: b.user_id, amount: -b.balance_cents }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return transfers;
}

// Welche Überweisungen betreffen mich? Positiv = ich bekomme, negativ = ich zahle
export function myTransfers(transfers: Transfer[], userId: string | null) {
  return transfers
    .filter((t) => t.from === userId || t.to === userId)
    .map((t) => ({
      otherId: t.from === userId ? t.to : t.from,
      amount: t.to === userId ? t.amount : -t.amount,
    }));
}