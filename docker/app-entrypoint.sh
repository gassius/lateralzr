#!/bin/sh
# Prepare the bind-mounted storage tree, then exec the container command.
# PHP-FPM master stays root (workers are www-data). Artisan runs as www-data
# so queue/scheduler cannot recreate root:root laravel.log files.
set -eu

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
    # nginx:alpine writes as uid 101 into the shared storage/logs/nginx bind.
    chmod 0666 storage/logs/nginx/access.log storage/logs/nginx/error.log || true
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
