#!/bin/bash
ps -eo rss,comm,args --sort=-rss | head -8 | cut -c1-150
docker ps --format '{{.Names}}'
