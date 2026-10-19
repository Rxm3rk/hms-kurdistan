#!/bin/bash
timeout 20 kubectl get nodes 2>&1 | head
timeout 20 kubectl -n hms-data get cluster,pods -o wide 2>&1 | head -20
free -m | head -2
