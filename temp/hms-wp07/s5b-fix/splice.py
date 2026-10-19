import sys

target, body = sys.argv[1], sys.argv[2]
with open(target, encoding='utf-8') as f:
    s = f.read()
with open(body, encoding='utf-8') as f:
    b = f.read()
i = s.index('function SignDialogBody({')
with open(target, 'w', encoding='utf-8', newline='\n') as f:
    f.write(s[:i] + b)
