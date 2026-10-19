import re,sys
p=sys.argv[1]
lines=open(p,encoding='utf-8').read().split('\n')
out=[]
i=0
pat=re.compile(r'^(\s*)(guards\.\w+)\((.*)\) shouldBe (true|false)$')
while i<len(lines):
    l=lines[i]
    # join "... shouldBe\n   false" pattern
    if len(l)>140 and l.rstrip().endswith('shouldBe') and i+1<len(lines) and lines[i+1].strip() in ('true','false'):
        l=l.rstrip()+' '+lines[i+1].strip(); i+=1
    m=pat.match(l)
    if len(l)>140 and m:
        ind,fn,args,v=m.groups()
        out+= [f"{ind}{fn}(", f"{ind}    {args},", f"{ind}) shouldBe {v}"]
    else:
        out.append(l)
    i+=1
open(p,'w',encoding='utf-8',newline='\n').write('\n'.join(out))
