#!/bin/sh
wget -q -O- --header="Authorization: Bearer ${CRON_SECRET}" http://payalert:3000/api/internal/webhook-worker >/dev/null 2>&1 || echo "webhook-worker fallo"
