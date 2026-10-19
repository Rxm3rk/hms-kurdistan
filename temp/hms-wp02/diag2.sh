#!/bin/bash
docker inspect -f '{{.Name}} restarts={{.RestartCount}} started={{.State.StartedAt}} exit={{.State.ExitCode}}' k3d-hms-proto-server-0 k3d-hms-proto-server-1 k3d-hms-proto-server-2
docker logs --since 10m k3d-hms-proto-server-0 2>&1 | grep -iE 'fatal|level=error|panic|"level":"(error|fatal|panic)"' | tail -8 | cut -c1-300
uptime
