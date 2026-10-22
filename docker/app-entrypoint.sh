#!/bin/sh
# Prepare the bind-mounted storage tree, then exec the container command.
# PHP-FPM master stays root (workers are www-data). Artisan runs as www-data
# so queue/scheduler cannot recreate root:root laravel.log files.
set -eu
# 0664 for new Laravel / tee log files (not world-writable 0666).
umask 002

cd /var/www/html

mkdir -p \
    storage/app/public \
    storage/app/private \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/testing \
    storage/framework/views \
    storage/logs/nginx \
    storage/logs/queue \
    storage/logs/scheduler \
    bootstrap/cache

touch \
    storage/logs/nginx/access.log \
    storage/logs/nginx/error.log \
    storage/logs/queue/queue.log \
    storage/logs/scheduler/scheduler.log \
    2>/dev/null || true

if [ "$(id -u)" = "0" ]; then
    chown -R www-data:www-data storage bootstrap/cache || true
    chmod -R ug+rwX,o+rX storage bootstrap/cache || true
    chmod 2775 storage/logs storage/logs/nginx storage/logs/queue storage/logs/scheduler || true
    # nginx:alpine writes as uid 101. Owner 101 + group www-data + 0664
    # lets nginx and the deploy user append without world-writable 0666.
    chown 101:www-data storage/logs/nginx/access.log storage/logs/nginx/error.log || true
    chmod 0664 \
        storage/logs/nginx/access.log \
        storage/logs/nginx/error.log \
        storage/logs/queue/queue.log \
        storage/logs/scheduler/scheduler.log \
        || true
    for laravel_log in storage/logs/laravel-*.log; do
        if [ -f "$laravel_log" ]; then
            chmod 0664 "$laravel_log" || true
        fi
    done
fi

# public/ lives in the image (not bind-mounted). Recreate the storage symlink
# on every start so `php artisan about` reports public/storage as linked.
if [ -e public/storage ] && [ ! -L public/storage ]; then
    rm -rf public/storage
fi
ln -sfn /var/www/html/storage/app/public /var/www/html/public/storage

if [ "$(id -u)" = "0" ] && [ "${1:-}" != "php-fpm" ]; then
    exec gosu www-data "$@"
fi

exec "$@"
