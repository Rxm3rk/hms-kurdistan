import json, sys, yaml
class L(yaml.SafeLoader): pass
# YAML 1.2 style booleans only
L.yaml_implicit_resolvers = {k: [(t, r) for t, r in v if t != 'tag:yaml.org,2002:bool'] for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
import re
L.add_implicit_resolver('tag:yaml.org,2002:bool', re.compile(r'^(?:true|false)$'), list('tf'))
import jsonschema
schema = json.load(open(sys.argv[1], encoding='utf-8'))
doc = yaml.load(open(sys.argv[2], encoding='utf-8'), Loader=L)
jsonschema.Draft202012Validator.check_schema(schema)
errs = list(jsonschema.Draft202012Validator(schema).iter_errors(doc))
for e in errs: print(list(e.path), e.message[:200])
print("errors:", len(errs), "transitions:", len(doc["transitions"]), "on-key:", doc["transitions"][0].keys())
