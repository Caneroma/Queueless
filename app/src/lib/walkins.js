// The paper tokens standing directly before and after `number` in the waiting list, as
// [{ side: 'ahead' | 'behind', number }]. Only when the shop has said nobody is at the counter to
// call them out: then the people beside a walk-in are asked to pass the word on.
export function paperNeighbours(snapshot, number) {
  if (!snapshot || !snapshot.noReceptionist) return [];
  const index = snapshot.waiting.indexOf(number);
  if (index < 0) return [];
  const paper = snapshot.physical || [];
  return [
    { side: 'ahead', number: snapshot.waiting[index - 1] },
    { side: 'behind', number: snapshot.waiting[index + 1] },
  ].filter((n) => n.number !== undefined && paper.includes(n.number));
}
