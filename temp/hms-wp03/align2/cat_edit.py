import sys
p = sys.argv[1]
newp = sys.argv[2]
s = open(p, encoding='utf-8', newline='').read().replace('\r\n', '\n')
new = open(newp, encoding='utf-8', newline='').read().replace('\r\n', '\n')
start = s.index('## 4. Platform events of WP-0.3')
end = s.index('## 6. Aliases')
s = s[:start] + new + s[end:]
a = ("  - `tenant`: keyed by the tenant's id, on the platform topic, so all of one tenant's events of this kind stay in order (tenancy and configuration);\n"
     "  - `as its aggregate`: generic events written on other modules' aggregates (`TaskRequested`, §4) take the keying of the aggregate they are written on.\n")
b = "  - `tenant`: keyed by the tenant's id, on the platform topic, so all of one tenant's events of this kind stay in order (tenancy and configuration).\n"
assert s.count(a) == 1
s = s.replace(a, b)
open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n'))
print('ok')
