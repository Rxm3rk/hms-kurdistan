const {parse} = await import(process.argv[2]);
const m = "a😀b {x} it's c'{'d {n, plural, one {# x'#'} other {<b>q</b> #}}";
const ast = parse(m, {captureLocation:true});
const show = (els, d=0) => { for (const e of els) { const s=e.location; console.log(' '.repeat(d), e.type, JSON.stringify(e.value), s && [s.start.offset, s.end.offset, JSON.stringify(m.slice(s.start.offset, s.end.offset))]); if (e.options) for (const [k,o] of Object.entries(e.options)) { console.log(' '.repeat(d+1), 'opt', k, o.location && [o.location.start.offset,o.location.end.offset]); show(o.value, d+2);} if (e.children) show(e.children, d+2);} };
show(ast);
