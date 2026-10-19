#!/bin/sh
L=/c/Users/Surface/AppData/Local/Temp/wp05/scratch-result/$1.log
shift
sh /c/Users/Surface/AppData/Local/Temp/wp05/gradle.sh "$@" > "$L" 2>&1
echo "exit $?" >> "$L"
