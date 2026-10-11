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