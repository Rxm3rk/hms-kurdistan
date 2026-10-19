const F = new Map([['ي','ی'],['ك','ک'],['ه','ە']]);
export function foldForSearch(text: string): string { let o=''; for (const c of text.normalize('NFC').toLowerCase()) o += F.get(c) ?? c; return o; }
