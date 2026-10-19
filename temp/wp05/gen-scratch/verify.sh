# usage: verify.sh spec.yaml...   (generates into scratch, runs ktlint + detekt; scratch only)
S=/c/Users/Surface/AppData/Local/Temp/wp05/gen-scratch; W=/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/t3-5dcdaa39
rm -rf $S/kt/src; mkdir -p $S/kt/src; cp $W/backend/.editorconfig $S/kt/src/
cd $W && .tools/venv/Scripts/python.exe -I $S/gen.py "$W/tools" "$(cygpath -w $S/kt/src)" "$@" > $S/files.txt || exit 1
cd $S/kt && FILES=$(find src -name "*.kt"); $W/.tools/jdk-25.0.4.1+1/bin/java.exe -cp "$(cat $S/ktlint.cp)" KtlintCheck.java $FILES 2>&1 | grep -E "^(LINT|FORMAT)" | grep -v "final-newline"
echo "ktlint files: $(echo $FILES | wc -w)"
$W/.tools/jdk-25.0.4.1+1/bin/java.exe -cp "$(cat $S/detekt.cp)" io.gitlab.arturbosch.detekt.cli.Main --input "$(cygpath -w $S/kt/src)" --config "$(cygpath -w $W/backend/config/detekt/detekt.yml)" --build-upon-default-config 2>&1 | grep -v "^WARNING"
echo "detekt exit: $?"
